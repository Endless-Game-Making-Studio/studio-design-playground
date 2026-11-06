//! Pixel Stitch's storage on disk: one file per key, in a folder of its own.
//!
//! The page keeps every value in memory and calls these commands in the
//! background (`app/composables/pixelStitch/desktopHost.ts`), one at a time
//! per key. The page decides each file's contents; this side only maps a key
//! to a file and makes sure a write lands whole or not at all.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use tauri::State;

const PROJECT_PREFIX: &str = "pixel-stitch-project:";

/// The folder the files live in. Managed as Tauri state.
pub struct Storage {
    root: PathBuf,
}

impl Storage {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// Where a key's file goes. A project lands in `projects/<id>.tps`, the
    /// extension a saved project file has, so the file can be imported back
    /// as one. Every other key is `<key>.json`. Keys come from the page, so
    /// anything that could step out of the folder is refused.
    pub fn file_for(&self, key: &str) -> Result<PathBuf, String> {
        let plain = |name: &str| {
            !name.is_empty()
                && name
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        };
        if let Some(id) = key.strip_prefix(PROJECT_PREFIX) {
            if plain(id) {
                return Ok(self.root.join("projects").join(format!("{id}.tps")));
            }
        } else if key.starts_with("pixel-stitch-") && plain(key) {
            return Ok(self.root.join(format!("{key}.json")));
        }
        Err(format!("not a Pixel Stitch storage key: {key:?}"))
    }

    /// The key's contents, or None when nothing is stored under it.
    pub fn read(&self, key: &str) -> Result<Option<String>, String> {
        match fs::read_to_string(self.file_for(key)?) {
            Ok(contents) => Ok(Some(contents)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(format!("couldn't read {key}: {error}")),
        }
    }

    pub fn write(&self, key: &str, contents: &str) -> Result<(), String> {
        write_atomic(&self.file_for(key)?, contents.as_bytes())
            .map_err(|error| format!("couldn't write {key}: {error}"))
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        match fs::remove_file(self.file_for(key)?) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => {
                Err(format!("couldn't remove {key}: {error}"))
            }
            _ => Ok(()),
        }
    }
}

/// `<dir>/storage` under PIXEL_STITCH_DATA_DIR when it is set, next to the web
/// engine's profile and the window state, so one folder holds the whole app.
/// Otherwise the per-user app data folder.
pub fn storage_root(data_dir: Option<PathBuf>, app_data_dir: PathBuf) -> PathBuf {
    data_dir.unwrap_or(app_data_dir).join("storage")
}

pub fn write_atomic(path: &Path, contents: &[u8]) -> io::Result<()> {
    write_atomic_with(path, |file| file.write_all(contents))
}

/// Writes through a temporary file in the same folder, flushed to disk, then
/// renamed over the old file. A rename within one folder replaces the file in
/// one step, so a crash or power cut leaves either the old file or the new
/// one, never half of either.
fn write_atomic_with(path: &Path, fill: impl FnOnce(&mut File) -> io::Result<()>) -> io::Result<()> {
    let dir = path.parent().expect("a storage file always has a folder");
    fs::create_dir_all(dir)?;
    // One fixed name per file is enough: the page writes each key one at a
    // time, and only one copy of the app runs.
    let mut temp_name = path.file_name().expect("a storage file has a name").to_os_string();
    temp_name.push(".tmp");
    let temp = dir.join(temp_name);

    let written = File::create(&temp).and_then(|mut file| {
        fill(&mut file)?;
        file.sync_all()
    });
    let result = written.and_then(|()| rename_over(&temp, path));
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

// Windows refuses to replace a file that another program (an antivirus
// scanner, a backup tool, the search indexer) has open for a moment, so a
// refused rename is tried again briefly before it counts as a failure.
fn rename_over(from: &Path, to: &Path) -> io::Result<()> {
    let mut attempt = 0;
    loop {
        match fs::rename(from, to) {
            Err(error) if error.kind() == io::ErrorKind::PermissionDenied && attempt < 5 => {
                attempt += 1;
                std::thread::sleep(std::time::Duration::from_millis(40));
            }
            result => return result,
        }
    }
}

// The commands run off the main thread, so a large project's write never
// stalls the window.

#[tauri::command]
pub async fn storage_read(storage: State<'_, Storage>, keys: Vec<String>) -> Result<Vec<Option<String>>, String> {
    let root = storage.root.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let storage = Storage::new(root);
        keys.iter().map(|key| storage.read(key)).collect()
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn storage_write(storage: State<'_, Storage>, key: String, contents: String) -> Result<(), String> {
    let root = storage.root.clone();
    tauri::async_runtime::spawn_blocking(move || Storage::new(root).write(&key, &contents))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn storage_remove(storage: State<'_, Storage>, key: String) -> Result<(), String> {
    let root = storage.root.clone();
    tauri::async_runtime::spawn_blocking(move || Storage::new(root).remove(&key))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A fresh folder under the system's temp folder, removed when dropped.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            static NEXT: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "pixel-stitch-storage-test-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn files_in(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn a_written_key_reads_back_and_a_missing_one_is_none() {
        let dir = TempDir::new();
        let storage = Storage::new(dir.0.clone());

        assert_eq!(storage.read("pixel-stitch-palette").unwrap(), None);
        storage.write("pixel-stitch-palette", "[[\"#ff00ff\"]]").unwrap();
        storage.write("pixel-stitch-palette", "[[\"#000000\"]]").unwrap();
        assert_eq!(storage.read("pixel-stitch-palette").unwrap().as_deref(), Some("[[\"#000000\"]]"));
    }

    #[test]
    fn a_project_is_a_tps_file_in_the_projects_folder() {
        let dir = TempDir::new();
        let storage = Storage::new(dir.0.clone());

        storage.write("pixel-stitch-project:m9x2k-ab12cd", "{}").unwrap();
        storage.write("pixel-stitch-workspace", "{}").unwrap();

        assert_eq!(files_in(&dir.0), vec!["pixel-stitch-workspace.json", "projects"]);
        assert_eq!(files_in(&dir.0.join("projects")), vec!["m9x2k-ab12cd.tps"]);
    }

    #[test]
    fn keys_that_could_leave_the_folder_are_refused() {
        let storage = Storage::new(PathBuf::from("root"));
        for key in [
            "pixel-stitch-project:../../evil",
            "pixel-stitch-project:a/b",
            "pixel-stitch-project:",
            "pixel-stitch-..\\evil",
            "other-app-key",
            "",
        ] {
            assert!(storage.file_for(key).is_err(), "{key:?} should be refused");
            assert!(storage.write(key, "x").is_err());
        }
    }

    #[test]
    fn an_interrupted_write_leaves_the_previous_file_intact() {
        let dir = TempDir::new();
        let file = dir.0.join("pixel-stitch-project.json");
        write_atomic(&file, b"the previous drawing").unwrap();

        // The process dies (here: the write fails) halfway through the new
        // contents.
        let interrupted = write_atomic_with(&file, |out| {
            out.write_all(b"half of the new dr")?;
            Err(io::Error::other("power cut"))
        });

        assert!(interrupted.is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), "the previous drawing");
        assert_eq!(files_in(&dir.0), vec!["pixel-stitch-project.json"]);
    }

    #[test]
    fn a_temporary_file_left_by_a_crash_is_ignored_and_replaced() {
        let dir = TempDir::new();
        let storage = Storage::new(dir.0.clone());
        storage.write("pixel-stitch-palette", "old").unwrap();
        fs::write(dir.0.join("pixel-stitch-palette.json.tmp"), "half").unwrap();

        assert_eq!(storage.read("pixel-stitch-palette").unwrap().as_deref(), Some("old"));
        storage.write("pixel-stitch-palette", "new").unwrap();
        assert_eq!(storage.read("pixel-stitch-palette").unwrap().as_deref(), Some("new"));
        assert_eq!(files_in(&dir.0), vec!["pixel-stitch-palette.json"]);
    }

    #[test]
    fn removing_deletes_the_file_and_a_missing_one_is_fine() {
        let dir = TempDir::new();
        let storage = Storage::new(dir.0.clone());
        storage.write("pixel-stitch-project:abc", "{}").unwrap();

        storage.remove("pixel-stitch-project:abc").unwrap();
        storage.remove("pixel-stitch-project:abc").unwrap();
        assert_eq!(storage.read("pixel-stitch-project:abc").unwrap(), None);
    }

    /// Far past what browser storage holds (a few megabytes): thirty 128×128
    /// projects with four frames of two layers each, in project file format.
    #[test]
    fn many_large_projects_save_and_load() {
        let dir = TempDir::new();
        let storage = Storage::new(dir.0.clone());
        let project = |n: usize| {
            let row = format!("[{}]", vec![format!("\"#{n:06x}\""); 128].join(","));
            let grid = format!("[{}]", vec![row; 128].join(","));
            let layer = format!("{{\"id\":1,\"name\":\"Layer\",\"opacity\":1,\"data\":{grid}}}");
            let frame = format!("{{\"id\":1,\"layers\":[{layer},{layer}]}}");
            format!(
                "{{\"version\":1,\"canvasSize\":128,\"fps\":8,\"currentFrameIndex\":0,\"frames\":[{}]}}",
                vec![frame; 4].join(",")
            )
        };

        let mut total = 0;
        for n in 0..30 {
            let contents = project(n);
            total += contents.len();
            storage.write(&format!("pixel-stitch-project:p{n}"), &contents).unwrap();
        }
        // Browser storage tops out around 5 MB.
        assert!(total > 30_000_000, "only {total} bytes");

        for n in 0..30 {
            assert_eq!(storage.read(&format!("pixel-stitch-project:p{n}")).unwrap(), Some(project(n)));
        }
    }

    #[test]
    fn the_data_dir_variable_moves_storage() {
        let app_data = PathBuf::from("C:/Users/artist/AppData/Roaming/org.endlessaccess.pixelstitch");
        assert_eq!(storage_root(None, app_data.clone()), app_data.join("storage"));
        assert_eq!(
            storage_root(Some(PathBuf::from("D:/portable")), app_data),
            PathBuf::from("D:/portable").join("storage")
        );
    }
}
