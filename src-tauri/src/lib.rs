use serde::{Deserialize, Serialize};
use std::fs;
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

// Tauri v2 application library
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_handoff_conflicts,
            export_handoff_files,
            open_handoff_folder
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
