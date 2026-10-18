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
