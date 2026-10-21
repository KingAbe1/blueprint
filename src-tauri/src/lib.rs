use serde::{Deserialize, Serialize};
use std::fs;
use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HandoffFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HandoffExportResult {
    written: Vec<String>,
    overwritten: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CodebaseSource {
    root_name: String,
    root_path: String,
    paths: Vec<String>,
    directories: Vec<String>,
    source_metrics: SourceContentMetrics,
    source_contents: BTreeMap<String, String>,
    manifests: BTreeMap<String, String>,
    truncated: bool,
    git: GitRepositoryInfo,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QualityReviewSourceFile {
    path: String,
    content: String,
    truncated: bool,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct SourceContentMetrics {
    analyzed_files: usize,
    skipped_files: usize,
    lines_of_code: usize,
    todo_markers: usize,
    large_files: Vec<SourceFileMetric>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceFileMetric {
    path: String,
    lines: usize,
    todo_markers: usize,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct GitRepositoryInfo {
    tracked: bool,
    branch: Option<String>,
    remote: Option<String>,
    changed_files: Option<usize>,
    untracked_files: Option<usize>,
    latest_commit: Option<String>,
}

fn git_output(root: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git").arg("-C").arg(root).args(args).output().ok()?;
    if !output.status.success() { return None; }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn sanitize_git_remote(remote: String) -> String {
    if let Some((scheme, address)) = remote.split_once("://") {
        let host_path = address.rsplit_once('@').map(|(_, host_path)| host_path).unwrap_or(address);
        return format!("{scheme}://{host_path}");
    }
    remote
}

fn is_source_code_file(path: &Path) -> bool {
    matches!(path.extension().and_then(|extension| extension.to_str()).unwrap_or("").to_lowercase().as_str(),
        "ts" | "tsx" | "mts" | "cts" | "js" | "jsx" | "mjs" | "cjs" | "py" | "pyw"
        | "rs" | "go" | "java" | "kt" | "kts" | "swift" | "dart" | "php" | "rb"
        | "cs" | "c" | "h" | "cc" | "cpp" | "hpp" | "css" | "scss" | "html"
        | "vue" | "svelte" | "sql" | "sh" | "bash" | "yaml" | "yml")
}

fn add_source_content_metric(path: String, content: &str, metrics: &mut SourceContentMetrics) {
    let lines = content.lines().filter(|line| !line.trim().is_empty()).count();
    let lower = content.to_ascii_lowercase();
    let todo_markers = ["todo", "fixme", "xxx", "hack"].iter().map(|marker| {
        lower.match_indices(marker).filter(|(index, _)| {
            let before_is_word = lower[..*index].chars().next_back()
                .map(|character| character.is_ascii_alphanumeric() || character == '_')
                .unwrap_or(false);
            let after_is_word = lower[*index + marker.len()..].chars().next()
                .map(|character| character.is_ascii_alphanumeric() || character == '_')
                .unwrap_or(false);
            !before_is_word && !after_is_word
        }).count()
    }).sum::<usize>();
    metrics.analyzed_files += 1;
    metrics.lines_of_code += lines;
    metrics.todo_markers += todo_markers;
    if lines > 500 {
        metrics.large_files.push(SourceFileMetric { path, lines, todo_markers });
        metrics.large_files.sort_by(|left, right| right.lines.cmp(&left.lines));
        metrics.large_files.truncate(20);
    }
}

fn inspect_git_repository(root: &Path) -> GitRepositoryInfo {
    if git_output(root, &["rev-parse", "--is-inside-work-tree"]).as_deref() != Some("true") {
        return GitRepositoryInfo::default();
    }
    let status = git_output(root, &["status", "--porcelain"]);
    let (changed_files, untracked_files) = status.map(|output| {
        let mut changed = 0;
        let mut untracked = 0;
        for line in output.lines() {
            if line.starts_with("??") { untracked += 1; } else if !line.trim().is_empty() { changed += 1; }
        }
        (Some(changed), Some(untracked))
    }).unwrap_or((None, None));
    GitRepositoryInfo {
        tracked: true,
        branch: git_output(root, &["symbolic-ref", "--short", "HEAD"]).or_else(|| git_output(root, &["rev-parse", "--short", "HEAD"]).map(|head| format!("detached at {head}"))),
        remote: git_output(root, &["remote", "get-url", "origin"]).map(sanitize_git_remote),
        changed_files,
        untracked_files,
        latest_commit: git_output(root, &["log", "-1", "--format=%h %s"]),
    }
}

fn inspect_codebase_directory(
    root: &Path,
    paths: &mut Vec<String>,
    directories: &mut Vec<String>,
    source_metrics: &mut SourceContentMetrics,
    source_contents: &mut BTreeMap<String, String>,
    manifests: &mut BTreeMap<String, String>,
    truncated: &mut bool,
) -> Result<(), String> {
    const MAX_FILES: usize = 15_000;
    const MAX_ENTRIES: usize = 30_000;
    const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
    const MAX_LOCKFILE_BYTES: u64 = 10 * 1024 * 1024;
    const MAX_SOURCE_FILE_BYTES: u64 = 512 * 1024;
    const MAX_SOURCE_TOTAL_BYTES: u64 = 24 * 1024 * 1024;

    let ignored = [
        ".git", ".hg", ".svn", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache",
        ".idea", ".vscode", ".venv", "venv", "__pycache__", "node_modules", "vendor",
        "target", "dist", "build", "coverage", "out", "Pods", "bin", "obj",
    ];

    let mut pending = vec![root.to_path_buf()];
    let mut entries_scanned = 0;
    let mut source_bytes_read = 0_u64;
    while let Some(directory) = pending.pop() {
        let entries = fs::read_dir(&directory)
            .map_err(|error| format!("Could not read {}: {error}", directory.display()))?;
        for entry in entries {
            let entry = entry.map_err(|error| format!("Could not inspect {}: {error}", directory.display()))?;
            entries_scanned += 1;
            if entries_scanned >= MAX_ENTRIES {
                *truncated = true;
                return Ok(());
            }
            let file_type = entry.file_type()
                .map_err(|error| format!("Could not inspect {}: {error}", entry.path().display()))?;
            let path = entry.path();
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if ignored.contains(&name.as_str()) {
                    continue;
                }
                let relative = path.strip_prefix(root)
                    .map_err(|error| format!("Could not make a repository path relative: {error}"))?;
                directories.push(relative.to_string_lossy().replace('\\', "/"));
                pending.push(path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            if paths.len() >= MAX_FILES {
                *truncated = true;
                return Ok(());
            }

            let relative = path.strip_prefix(root)
                .map_err(|error| format!("Could not make a repository path relative: {error}"))?;
            let relative_string = relative.to_string_lossy().replace('\\', "/");
            paths.push(relative_string.clone());

            let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or("").to_lowercase();
            let is_source = is_source_code_file(&path);
            let is_workflow = relative_string.starts_with(".github/workflows/")
                && (file_name.ends_with(".yml") || file_name.ends_with(".yaml"));
            let is_manifest = is_workflow || matches!(
                file_name.as_str(),
                "package.json" | "cargo.toml" | "pyproject.toml" | "requirements.txt" | "go.mod"
                    | "package-lock.json" | "npm-shrinkwrap.json"
                    | "gemfile" | "composer.json" | "pubspec.yaml" | "pom.xml" | "build.gradle"
                    | "build.gradle.kts" | "settings.gradle" | "settings.gradle.kts" | "readme.md"
                    | "vite.config.ts" | "vite.config.js" | "vitest.config.ts" | "jest.config.js"
                    | "playwright.config.ts" | "pytest.ini" | "makefile"
            );
            if is_manifest {
                if let Ok(metadata) = entry.metadata() {
                    let max_bytes = if matches!(file_name.as_str(), "package-lock.json" | "npm-shrinkwrap.json") { MAX_LOCKFILE_BYTES } else { MAX_MANIFEST_BYTES };
                    if metadata.len() <= max_bytes {
                        if let Ok(content) = fs::read_to_string(&path) {
                            manifests.insert(relative_string.clone(), content);
                        }
                    }
                }
            }
            if is_source {
                let metadata = entry.metadata().ok();
                let file_size = metadata.map(|value| value.len()).unwrap_or(MAX_SOURCE_FILE_BYTES + 1);
                if file_size <= MAX_SOURCE_FILE_BYTES && source_bytes_read + file_size <= MAX_SOURCE_TOTAL_BYTES {
                    if let Ok(content) = fs::read_to_string(&path) {
                        source_bytes_read += file_size;
                        add_source_content_metric(relative_string.clone(), &content, source_metrics);
                        source_contents.insert(relative_string, content);
                    } else {
                        source_metrics.skipped_files += 1;
                    }
                } else {
                    source_metrics.skipped_files += 1;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn read_codebase(root_path: String) -> Result<CodebaseSource, String> {
    let selected_root = PathBuf::from(&root_path);
    if !selected_root.is_absolute() || !selected_root.is_dir() {
        return Err("Choose an existing codebase folder.".into());
    }
    let root = fs::canonicalize(&selected_root)
        .map_err(|error| format!("Could not access {}: {error}", selected_root.display()))?;
    let root_name = root.file_name().and_then(|name| name.to_str()).unwrap_or("Codebase").to_string();
    let mut paths = Vec::new();
    let mut directories = Vec::new();
    let mut source_metrics = SourceContentMetrics::default();
    let mut source_contents = BTreeMap::new();
    let mut manifests = BTreeMap::new();
    let mut truncated = false;
    inspect_codebase_directory(&root, &mut paths, &mut directories, &mut source_metrics, &mut source_contents, &mut manifests, &mut truncated)?;
    paths.sort();
    directories.sort();

    Ok(CodebaseSource {
        root_name,
        root_path: root.to_string_lossy().into_owned(),
        paths,
        directories,
        source_metrics,
        source_contents,
        manifests,
        truncated,
        git: inspect_git_repository(&root),
    })
}

#[tauri::command]
fn read_codebase_files(root_path: String, relative_paths: Vec<String>) -> Result<Vec<QualityReviewSourceFile>, String> {
    const MAX_FILES: usize = 6;
    const MAX_FILE_CHARS: usize = 6_000;
    const MAX_TOTAL_CHARS: usize = 24_000;
    const MAX_FILE_BYTES: u64 = 256 * 1024;
    let allowed_extensions = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs", "py", "rs", "go", "java", "kt", "swift", "php", "rb", "cs", "c", "cpp", "h", "hpp", "sql"];
    let selected_root = PathBuf::from(root_path);
    let root = fs::canonicalize(&selected_root).map_err(|error| format!("Could not access selected codebase: {error}"))?;
    if !root.is_dir() { return Err("The selected codebase folder is no longer available.".into()); }

    let mut result = Vec::new();
    let mut remaining_chars = MAX_TOTAL_CHARS;
    for relative in relative_paths.into_iter().take(MAX_FILES) {
        let relative_path = Path::new(&relative);
        if relative.trim().is_empty() || relative_path.is_absolute()
            || relative_path.components().any(|part| matches!(part, Component::ParentDir | Component::RootDir | Component::Prefix(_))) {
            return Err("A selected review path is outside the codebase folder.".into());
        }
        let extension = relative_path.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase();
        if !allowed_extensions.contains(&extension.as_str()) || relative_path.components().any(|part| part.as_os_str().to_string_lossy().to_lowercase().starts_with(".env")) {
            continue;
        }
        let path = fs::canonicalize(root.join(relative_path)).map_err(|_| format!("Could not read selected file: {relative}"))?;
        if !path.starts_with(&root) || !path.is_file() {
            return Err("A selected review file is outside the codebase folder.".into());
        }
        let metadata = fs::metadata(&path).map_err(|_| format!("Could not inspect selected file: {relative}"))?;
        if metadata.len() > MAX_FILE_BYTES { continue; }
        let content = fs::read_to_string(&path).map_err(|_| format!("Could not read selected file as text: {relative}"))?;
        let allowance = MAX_FILE_CHARS.min(remaining_chars);
        if allowance == 0 { break; }
        let clipped: String = content.chars().take(allowance).collect();
        let truncated = clipped.chars().count() < content.chars().count();
        remaining_chars = remaining_chars.saturating_sub(clipped.chars().count());
        result.push(QualityReviewSourceFile { path: relative, content: clipped, truncated });
    }
    Ok(result)
}

fn safe_handoff_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if relative.trim().is_empty()
        || path.is_absolute()
        || path.components().any(|part| matches!(part, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return Err(format!("Unsafe handoff path: {relative}"));
    }

    let canonical_root = fs::canonicalize(root)
        .map_err(|error| format!("Could not access {}: {error}", root.display()))?;
    let destination = canonical_root.join(path);
    let mut cursor = canonical_root.clone();
    for component in path.components() {
        cursor.push(component.as_os_str());
        if cursor.exists() {
            let resolved = fs::canonicalize(&cursor)
                .map_err(|error| format!("Could not inspect {}: {error}", cursor.display()))?;
            if !resolved.starts_with(&canonical_root) {
                return Err(format!("Handoff path leaves the selected project folder: {relative}"));
            }
        }
    }
    Ok(destination)
}

#[tauri::command]
fn inspect_handoff_conflicts(target_dir: String, paths: Vec<String>) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&target_dir);
    if !root.is_absolute() || !root.is_dir() {
        return Err("Choose an existing project folder.".into());
    }

    let mut conflicts = Vec::new();
    for relative in paths {
        if safe_handoff_path(&root, &relative)?.exists() {
            conflicts.push(relative);
        }
    }
    Ok(conflicts)
}

#[tauri::command]
fn export_handoff_files(
    target_dir: String,
    files: Vec<HandoffFile>,
    overwrite: bool,
) -> Result<HandoffExportResult, String> {
    let root = PathBuf::from(&target_dir);
    if !root.is_absolute() || !root.is_dir() {
        return Err("Choose an existing project folder.".into());
    }

    let prepared = files.into_iter().map(|file| {
        let destination = safe_handoff_path(&root, &file.path)?;
        let existed = destination.exists();
        Ok((file, destination, existed))
    }).collect::<Result<Vec<_>, String>>()?;

    let existing = prepared.iter()
        .filter(|(_, _, existed)| *existed)
        .map(|(file, _, _)| file.path.clone())
        .collect::<Vec<_>>();
    if !overwrite && !existing.is_empty() {
        return Err(format!(
            "{} handoff file{} already exist. Review conflicts before exporting.",
            existing.len(),
            if existing.len() == 1 { "" } else { "s" },
        ));
    }

    let mut written = Vec::new();
    let mut overwritten = Vec::new();
    for (file, destination, existed) in prepared {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
        }
        fs::write(&destination, file.content.as_bytes())
            .map_err(|error| format!("Could not write {}: {error}", destination.display()))?;
        if existed {
            overwritten.push(file.path.clone());
        }
        written.push(file.path);
    }

    Ok(HandoffExportResult { written, overwritten })
}

#[tauri::command]
fn write_export_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let destination = PathBuf::from(&path);
    if !destination.is_absolute() {
        return Err("Export path must be absolute.".into());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    fs::write(&destination, data)
        .map_err(|error| format!("Could not write {}: {error}", destination.display()))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("URL is empty.".into());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("Could not open link: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|error| format!("Could not open link: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("Could not open link: {error}"))?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = url;
        Err("Opening system links is not supported on this platform.".into())
    }
}

/// Prefer IDE CLI / `open -a` so macOS does not show a buried custom-URL allow dialog.
fn ide_binary_and_app(ide_id: &str) -> Result<(&'static str, Option<&'static str>), String> {
    match ide_id {
        "vscode" => Ok(("code", Some("Visual Studio Code"))),
        "cursor" => Ok(("cursor", Some("Cursor"))),
        "windsurf" => Ok(("windsurf", Some("Windsurf"))),
        "webstorm" => Ok(("webstorm", Some("WebStorm"))),
        "idea" => Ok(("idea", Some("IntelliJ IDEA"))),
        "zed" => Ok(("zed", Some("Zed"))),
        "sublime" => Ok(("subl", Some("Sublime Text"))),
        _ => Err(format!("Unsupported IDE id: {ide_id}")),
    }
}

fn push_unique(candidates: &mut Vec<String>, path: impl Into<String>) {
    let path = path.into();
    if path.is_empty() || candidates.iter().any(|existing| existing == &path) {
        return;
    }
    candidates.push(path);
}

fn join_home(segments: &[&str]) -> Option<PathBuf> {
    let home = home_dir()?;
    Some(segments.iter().fold(home, |acc, segment| acc.join(segment)))
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

/// Bundled / default-install CLIs (GUI apps are often missing from PATH when launched from Tauri).
fn ide_bundle_cli_candidates(ide_id: &str) -> Vec<String> {
    let mut out = Vec::new();

    #[cfg(target_os = "macos")]
    {
        let mac: &[&str] = match ide_id {
            "cursor" => &[
                "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
                "/Applications/Cursor.app/Contents/Resources/app/bin/code",
            ],
            "vscode" => &[
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                "/Applications/VSCodium.app/Contents/Resources/app/bin/codium",
            ],
            "windsurf" => &["/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf"],
            "zed" => &[
                "/Applications/Zed.app/Contents/MacOS/zed",
                "/Applications/Zed.app/Contents/MacOS/cli",
            ],
            "sublime" => &["/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"],
            "webstorm" => &["/Applications/WebStorm.app/Contents/MacOS/webstorm"],
            "idea" => &["/Applications/IntelliJ IDEA.app/Contents/MacOS/idea"],
            _ => &[],
        };
        for path in mac {
            push_unique(&mut out, (*path).to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
        let program_files = std::env::var_os("ProgramFiles").map(PathBuf::from);
        let program_files_x86 = std::env::var_os("ProgramFiles(x86)").map(PathBuf::from);

        let mut push_under = |base: &Option<PathBuf>, rel: &[&str]| {
            if let Some(base) = base {
                let path = rel.iter().fold(base.clone(), |acc, segment| acc.join(segment));
                push_unique(&mut out, path.to_string_lossy().to_string());
            }
        };

        match ide_id {
            "cursor" => {
                push_under(&local, &["Programs", "cursor", "resources", "app", "bin", "cursor.cmd"]);
                push_under(&local, &["Programs", "cursor", "resources", "app", "bin", "cursor.exe"]);
                push_under(&local, &["Programs", "Cursor", "resources", "app", "bin", "cursor.cmd"]);
            }
            "vscode" => {
                push_under(
                    &local,
                    &["Programs", "Microsoft VS Code", "bin", "code.cmd"],
                );
                push_under(&local, &["Programs", "Microsoft VS Code", "bin", "code.exe"]);
                push_under(&program_files, &["Microsoft VS Code", "bin", "code.cmd"]);
                push_under(&program_files_x86, &["Microsoft VS Code", "bin", "code.cmd"]);
                push_under(&local, &["Programs", "VSCodium", "bin", "codium.cmd"]);
            }
            "windsurf" => {
                push_under(&local, &["Programs", "Windsurf", "bin", "windsurf.cmd"]);
                push_under(
                    &local,
                    &["Programs", "Windsurf", "resources", "app", "bin", "windsurf.cmd"],
                );
            }
            "zed" => {
                push_under(&local, &["Programs", "Zed", "zed.exe"]);
                push_under(&local, &["Programs", "Zed", "bin", "zed.exe"]);
            }
            "sublime" => {
                push_under(&program_files, &["Sublime Text", "subl.exe"]);
                push_under(&program_files_x86, &["Sublime Text 3", "subl.exe"]);
            }
            "webstorm" => {
                // JetBrains Toolbox installs under LOCALAPPDATA\JetBrains\Toolbox\scripts
                push_under(&local, &["JetBrains", "Toolbox", "scripts", "webstorm.cmd"]);
                push_under(&local, &["JetBrains", "Toolbox", "scripts", "webstorm"]);
            }
            "idea" => {
                push_under(&local, &["JetBrains", "Toolbox", "scripts", "idea.cmd"]);
                push_under(&local, &["JetBrains", "Toolbox", "scripts", "idea64.exe"]);
            }
            _ => {}
        }
    }

    #[cfg(target_os = "linux")]
    {
        let home_bin = join_home(&[".local", "bin"]);
        let push_home_bin = |name: &str, out: &mut Vec<String>| {
            if let Some(dir) = &home_bin {
                push_unique(out, dir.join(name).to_string_lossy().to_string());
            }
        };

        match ide_id {
            "cursor" => {
                push_home_bin("cursor", &mut out);
                push_unique(&mut out, "/usr/share/cursor/bin/cursor".into());
                push_unique(&mut out, "/opt/Cursor/bin/cursor".into());
                push_unique(&mut out, "/opt/cursor/bin/cursor".into());
            }
            "vscode" => {
                push_home_bin("code", &mut out);
                push_home_bin("codium", &mut out);
                push_unique(&mut out, "/usr/share/code/bin/code".into());
                push_unique(&mut out, "/usr/bin/code".into());
                push_unique(&mut out, "/snap/bin/code".into());
                push_unique(&mut out, "/usr/share/codium/bin/codium".into());
            }
            "windsurf" => {
                push_home_bin("windsurf", &mut out);
                push_unique(&mut out, "/usr/share/windsurf/bin/windsurf".into());
                push_unique(&mut out, "/opt/Windsurf/bin/windsurf".into());
            }
            "zed" => {
                push_home_bin("zed", &mut out);
                push_unique(&mut out, "/usr/bin/zed".into());
                push_unique(&mut out, "/usr/local/bin/zed".into());
                if let Some(path) = join_home(&[".local", "zed", "bin", "zed"]) {
                    push_unique(&mut out, path.to_string_lossy().to_string());
                }
            }
            "sublime" => {
                push_home_bin("subl", &mut out);
                push_unique(&mut out, "/usr/bin/subl".into());
                push_unique(&mut out, "/opt/sublime_text/sublime_text".into());
            }
            "webstorm" => {
                push_home_bin("webstorm", &mut out);
                if let Some(path) = join_home(&[".local", "share", "JetBrains", "Toolbox", "scripts", "webstorm"]) {
                    push_unique(&mut out, path.to_string_lossy().to_string());
                }
            }
            "idea" => {
                push_home_bin("idea", &mut out);
                if let Some(path) = join_home(&[".local", "share", "JetBrains", "Toolbox", "scripts", "idea"]) {
                    push_unique(&mut out, path.to_string_lossy().to_string());
                }
            }
            _ => {}
        }
    }

    out
}

fn require_absolute_path(path: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} is empty."));
    }
    let buf = PathBuf::from(trimmed);
    if !buf.is_absolute() {
        return Err(format!("{label} must be an absolute path."));
    }
    Ok(buf)
}

fn path_is_within(root: &Path, candidate: &Path) -> bool {
    let root_canon = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let candidate_canon = fs::canonicalize(candidate).unwrap_or_else(|_| candidate.to_path_buf());
    if candidate_canon.starts_with(&root_canon) {
        return true;
    }
    // Non-existent suggested files still need to resolve under the project string prefix.
    let root_s = root_canon.to_string_lossy().trim_end_matches(['/', '\\']).to_string();
    let cand_s = candidate.to_string_lossy();
    cand_s == root_s
        || cand_s.starts_with(&(root_s.clone() + "/"))
        || cand_s.starts_with(&(root_s + "\\"))
}

fn spawn_command(program: &str, args: &[&str]) -> Result<(), String> {
    let path = Path::new(program);
    let looks_absolute = program.contains('/')
        || program.contains('\\')
        || Path::new(program).is_absolute();
    if looks_absolute && !path.is_file() {
        return Err(format!("CLI not found: {program}"));
    }

    #[cfg(windows)]
    {
        let lower = program.to_ascii_lowercase();
        if lower.ends_with(".cmd") || lower.ends_with(".bat") {
            return Command::new("cmd")
                .arg("/C")
                .arg(program)
                .args(args)
                .spawn()
                .map(|_| ())
                .map_err(|error| format!("Could not start {program}: {error}"));
        }
    }

    Command::new(program)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not start {program}: {error}"))
}

fn try_spawn_ide_binary(ide_id: &str, binary: &str, args: &[&str]) -> Result<(), String> {
    let mut candidates = ide_bundle_cli_candidates(ide_id);

    // PATH / common symlink locations (macOS + Linux). On Windows, bare `binary` resolves via PATH.
    push_unique(&mut candidates, binary.to_string());
    #[cfg(windows)]
    {
        push_unique(&mut candidates, format!("{binary}.cmd"));
        push_unique(&mut candidates, format!("{binary}.exe"));
    }
    #[cfg(not(windows))]
    {
        push_unique(&mut candidates, format!("/usr/local/bin/{binary}"));
        push_unique(&mut candidates, format!("/opt/homebrew/bin/{binary}"));
        push_unique(&mut candidates, format!("/usr/bin/{binary}"));
        if let Some(path) = join_home(&[".local", "bin", binary]) {
            push_unique(&mut candidates, path.to_string_lossy().to_string());
        }
    }

    let mut last_error = format!("Could not find the `{binary}` CLI.");
    for path in candidates {
        match spawn_command(&path, args) {
            Ok(()) => return Ok(()),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

#[cfg(target_os = "macos")]
fn macos_process_name(app_name: &str) -> &str {
    match app_name {
        "Visual Studio Code" => "Code",
        "IntelliJ IDEA" => "idea",
        other => other,
    }
}

#[cfg(target_os = "macos")]
fn activate_macos_app(app_name: &str) {
    // Do NOT call `open -a App` here — that raises an already-open window and can
    // leave a freshly created (-n) window buried in the background.
    let process = macos_process_name(app_name);
    let script = format!(
        r#"tell application "{app}" to activate
delay 0.2
tell application "System Events"
  if exists process "{process}" then
    set frontmost of process "{process}" to true
  end if
end tell"#,
        app = app_name,
        process = process
    );
    let _ = Command::new("osascript").args(["-e", &script]).output();
}

#[cfg(target_os = "macos")]
fn try_open_macos_new_instance(app_name: &str, args: &[&str]) -> Result<(), String> {
    // -n = new app instance; usually focuses that instance (unlike bare `open -a`).
    let mut command = Command::new("open");
    command.arg("-na").arg(app_name);
    if !args.is_empty() {
        command.arg("--args");
        // Drop a leading IDE `-n` — `open -n` already requested a new instance.
        let filtered: Vec<&str> = args
            .iter()
            .copied()
            .filter(|arg| *arg != "-n" && *arg != "--new")
            .collect();
        command.args(&filtered);
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open {app_name}: {error}"))
}

#[cfg(target_os = "macos")]
fn try_open_macos_app_file(app_name: &str, file: &Path) -> Result<(), String> {
    // Positional file path (not --args) reliably opens the document and focuses the app.
    Command::new("open")
        .arg("-na")
        .arg(app_name)
        .arg(file)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open {app_name}: {error}"))
}

#[cfg(target_os = "macos")]
fn try_open_macos_app_folder(app_name: &str, folder: &Path) -> Result<(), String> {
    Command::new("open")
        .arg("-na")
        .arg(app_name)
        .arg(folder)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open {app_name}: {error}"))
}

fn vscode_goto_target(file: &Path, line: Option<u32>) -> String {
    // Include column 1 so editors land on the finding line reliably.
    match line.filter(|value| *value >= 1) {
        Some(line) => format!("{}:{line}:1", file.to_string_lossy()),
        None => file.to_string_lossy().to_string(),
    }
}

fn build_ide_launch_args(
    ide_id: &str,
    project_root: &Path,
    file_path: Option<&Path>,
    line: Option<u32>,
) -> Result<Vec<String>, String> {
    let root = project_root.to_string_lossy().to_string();
    match ide_id {
        // Folder-only open (file+line uses a two-step launch in open_in_ide).
        "vscode" | "cursor" | "windsurf" => Ok(vec!["-n".to_string(), root]),
        "webstorm" | "idea" => {
            let mut args = Vec::new();
            if let (Some(file), Some(line)) = (file_path, line.filter(|value| *value >= 1)) {
                args.push("--line".to_string());
                args.push(line.to_string());
                args.push(file.to_string_lossy().to_string());
            } else if let Some(file) = file_path {
                args.push(file.to_string_lossy().to_string());
            } else {
                args.push(root);
            }
            Ok(args)
        }
        "zed" => {
            if let Some(file) = file_path {
                Ok(vec![
                    "--new".to_string(),
                    root,
                    vscode_goto_target(file, line),
                ])
            } else {
                Ok(vec!["--new".to_string(), root])
            }
        }
        "sublime" => {
            if let Some(file) = file_path {
                Ok(vec![
                    "-n".to_string(),
                    root,
                    vscode_goto_target(file, line),
                ])
            } else {
                Ok(vec!["-n".to_string(), root])
            }
        }
        _ => Err(format!("Unsupported IDE id: {ide_id}")),
    }
}

fn open_vscode_family_project_then_file(
    ide: &str,
    binary: &str,
    project_root: &Path,
    file: &Path,
    line: Option<u32>,
) -> Result<(), String> {
    let root = project_root.to_string_lossy().to_string();
    let target = vscode_goto_target(file, line);

    // One shot: new window + goto. Prefer this when we have a line.
    if line.is_some() {
        let one_shot = ["-n", "-g", target.as_str(), root.as_str()];
        if try_spawn_ide_binary(ide, binary, &one_shot).is_ok() {
            return Ok(());
        }
    }

    // Two-step: open project in a new window, then goto without -r.
    // (-r can target an older Cursor window and skip the new one.)
    let open_project = ["-n", root.as_str()];
    try_spawn_ide_binary(ide, binary, &open_project)?;
    std::thread::sleep(std::time::Duration::from_millis(650));
    let goto = ["-g", target.as_str()];
    try_spawn_ide_binary(ide, binary, &goto)?;
    Ok(())
}

#[tauri::command]
fn open_in_ide(
    ide_id: String,
    project_root: String,
    file_path: Option<String>,
    line: Option<u32>,
) -> Result<(), String> {
    let ide = ide_id.trim();
    let (binary, app_name) = ide_binary_and_app(ide)?;
    let root = require_absolute_path(&project_root, "Project root")?;
    if !root.is_dir() {
        return Err("The scanned project folder is no longer available.".into());
    }

    let file = match file_path.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(path) => {
            let absolute = require_absolute_path(path, "File path")?;
            if !path_is_within(&root, &absolute) {
                return Err("File path must stay inside the scanned project.".into());
            }
            Some(absolute)
        }
        None => None,
    };

    let is_vscode_family = matches!(ide, "vscode" | "cursor" | "windsurf");

    if is_vscode_family {
        let opened = if let Some(file) = file.as_ref() {
            open_vscode_family_project_then_file(ide, binary, &root, file, line)
        } else {
            let args = build_ide_launch_args(ide, &root, None, None)?;
            let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
            try_spawn_ide_binary(ide, binary, &arg_refs)
        };

        if opened.is_ok() {
            #[cfg(target_os = "macos")]
            if let Some(app) = app_name {
                std::thread::sleep(std::time::Duration::from_millis(200));
                activate_macos_app(app);
            }
            return Ok(());
        }

        #[cfg(target_os = "macos")]
        if let Some(app) = app_name {
            // Fallback: new instance with project, then try document open for the file.
            let root_arg = root.to_string_lossy().to_string();
            let project_args = ["-n", root_arg.as_str()];
            let _ = try_open_macos_new_instance(app, &project_args);
            std::thread::sleep(std::time::Duration::from_millis(700));
            if let Some(file) = file.as_ref() {
                let target = vscode_goto_target(file, line);
                let goto = ["-g", target.as_str()];
                let _ = try_spawn_ide_binary(ide, binary, &goto);
                let _ = try_open_macos_app_file(app, file);
            }
            activate_macos_app(app);
            return Ok(());
        }

        return opened;
    }

    let args = build_ide_launch_args(ide, &root, file.as_deref(), line)?;
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    if try_spawn_ide_binary(ide, binary, &arg_refs).is_ok() {
        #[cfg(target_os = "macos")]
        if let Some(app) = app_name {
            std::thread::sleep(std::time::Duration::from_millis(450));
            activate_macos_app(app);
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    if let Some(app) = app_name {
        if try_open_macos_new_instance(app, &arg_refs).is_ok() {
            std::thread::sleep(std::time::Duration::from_millis(450));
            activate_macos_app(app);
            return Ok(());
        }
        let result = if let Some(file) = file.as_ref() {
            try_open_macos_app_file(app, file)
        } else {
            try_open_macos_app_folder(app, &root)
        };
        if result.is_ok() {
            activate_macos_app(app);
        }
        return result;
    }

    Err(format!(
        "Could not open {}. Install the `{binary}` shell command and ensure it is on PATH (Cursor / VS Code: Command Palette → “Install '{}' command in PATH”).",
        app_name.unwrap_or(binary),
        binary
    ))
}

#[tauri::command]
fn open_handoff_folder(target_dir: String) -> Result<(), String> {
    let root = PathBuf::from(target_dir);
    if !root.is_absolute() || !root.is_dir() {
        return Err("The selected project folder is no longer available.".into());
    }

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Opening the project folder is not supported on this platform.".into());

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    command
        .arg(root)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open the project folder: {error}"))
}

#[cfg(test)]
mod tests {
    use super::safe_handoff_path;
    use std::fs;

    #[test]
    fn accepts_nested_relative_paths() {
        let root = std::env::temp_dir().join("blueprint-handoff-path-test");
        fs::create_dir_all(&root).unwrap();
        let result = safe_handoff_path(&root, "blueprint/ROADMAP.md").unwrap();
        assert!(result.starts_with(fs::canonicalize(&root).unwrap()));
    }

    #[test]
    fn rejects_parent_and_absolute_paths() {
        let root = std::env::temp_dir();
        assert!(safe_handoff_path(&root, "../secret.md").is_err());
        assert!(safe_handoff_path(&root, "/tmp/secret.md").is_err());
        assert!(safe_handoff_path(&root, "").is_err());
    }
}

#[cfg(target_os = "macos")]
fn macos_os_theme() -> &'static str {
    use objc2_foundation::{NSUserDefaults, NSString};

    let defaults = NSUserDefaults::standardUserDefaults();
    let key = NSString::from_str("AppleInterfaceStyle");
    if let Some(style) = defaults.stringForKey(&key) {
        if style.to_string() == "Dark" {
            return "dark";
        }
    }
    "light"
}

#[tauri::command]
fn get_os_theme() -> String {
    #[cfg(target_os = "macos")]
    {
        return macos_os_theme().to_string();
    }
    #[cfg(not(target_os = "macos"))]
    {
        "light".to_string()
    }
}

const THEME_APP_ICON_LIGHT: &[u8] = include_bytes!("../icons/theme-app-icon-light.png");
const THEME_APP_ICON_DARK: &[u8] = include_bytes!("../icons/theme-app-icon-dark.png");

fn theme_app_icon_bytes(theme: &str) -> &'static [u8] {
    if theme == "light" {
        THEME_APP_ICON_LIGHT
    } else {
        THEME_APP_ICON_DARK
    }
}

#[cfg(target_os = "macos")]
fn set_macos_dock_icon(app: &tauri::AppHandle, png_bytes: &[u8]) -> Result<(), String> {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let png_bytes = png_bytes.to_vec();

    app.run_on_main_thread(move || {
        let mtm = unsafe { MainThreadMarker::new_unchecked() };
        let ns_app = NSApplication::sharedApplication(mtm);
        let data = NSData::with_bytes(&png_bytes);
        if let Some(app_icon) = NSImage::initWithData(NSImage::alloc(), &data) {
            unsafe { ns_app.setApplicationIconImage(Some(&app_icon)) };
        }
    })
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_theme_app_icon(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let png_bytes = theme_app_icon_bytes(theme.as_str());

    #[cfg(target_os = "macos")]
    {
        return set_macos_dock_icon(&app, png_bytes);
    }

    #[cfg(not(target_os = "macos"))]
    {
        use tauri::{Manager, image::Image};
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "Main window not found.".to_string())?;
        let icon = Image::from_bytes(png_bytes).map_err(|error| error.to_string())?;
        window.set_icon(icon).map_err(|error| error.to_string())?;
        Ok(())
    }
}

// Tauri v2 application library
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            read_codebase,
            read_codebase_files,
            inspect_handoff_conflicts,
            export_handoff_files,
            open_handoff_folder,
            write_export_file,
            open_external_url,
            open_in_ide,
            get_os_theme,
            set_theme_app_icon
        ])
        .setup(|app| {
            app.handle().set_theme(None);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
