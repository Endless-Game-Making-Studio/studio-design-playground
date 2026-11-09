//! Saving and opening files through the system's own Save and Open windows.
//!
//! The windows come from Tauri's dialog plugin, called from here rather than
//! from the page, and reading and writing the chosen file are two small
//! commands of this app. The page never sends or receives a path: it asks for
//! a window, the shell keeps the place the person chose, and the next command
//! writes or reads that one file. So the page can only touch a file someone
//! picked by hand, which the fs plugin's path-based commands can't promise
//! without a scope wide enough to cover wherever they might pick.
//! (`app/composables/pixelStitch/desktopHost.ts` is the page's side.)

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::storage::write_atomic;

/// One filter in a Save or Open window, as the page's `FileType` sends it.
#[derive(Deserialize)]
pub struct FileType {
    description: String,
    extensions: Vec<String>,
}

/// The places the last Save and Open windows chose, waiting for the page to
/// send or ask for the bytes. Each is taken by the command that uses it, so a
/// stray write or read with no window before it has nowhere to go.
#[derive(Default)]
pub struct Chosen {
    save: Mutex<Option<PathBuf>>,
    open: Mutex<Option<PathBuf>>,
}

/// GTK's Save window keeps the name exactly as typed, so a name typed without
/// an extension gets the first one its filter offers, and the file still opens
/// as what it is. (Windows' window adds it by itself.) A name that already has
/// any extension is the person's choice and is kept.
pub fn with_extension(path: PathBuf, types: &[FileType]) -> PathBuf {
    if path.extension().is_some() {
        return path;
    }
    match types.first().and_then(|kind| kind.extensions.first()) {
        Some(extension) => path.with_extension(extension),
        None => path,
    }
}

fn dialog(app: &AppHandle, window: &WebviewWindow, types: &[FileType]) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
    let mut builder = app.dialog().file().set_parent(window);
    for kind in types {
        let extensions: Vec<&str> = kind.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(&kind.description, &extensions);
    }
    builder
}

// The windows block until the person answers, so they run on a blocking
// thread: on the main thread they would freeze the app's own window.

/// Shows the Save window with the suggested name filled in. Resolves to
/// whether the person chose a place; cancelling is not an error.
#[tauri::command]
pub async fn save_dialog(
    app: AppHandle,
    window: WebviewWindow,
    chosen: State<'_, Chosen>,
    suggested_name: String,
    types: Vec<FileType>,
) -> Result<bool, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        let path = dialog(&app, &window, &types)
            .set_file_name(suggested_name)
            .blocking_save_file()?
            .into_path()
            .ok()?;
        Some(with_extension(path, &types))
    })
    .await
    .map_err(|error| error.to_string())?;
    let saved = picked.is_some();
    *chosen.save.lock().unwrap() = picked;
    Ok(saved)
}

/// Writes the request's raw body to the place the last Save window chose,
/// through a temporary file so a failed write leaves any old file whole.
#[tauri::command]
pub async fn write_saved_file(chosen: State<'_, Chosen>, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected the file's bytes".into());
    };
    let bytes = bytes.clone();
    let path = chosen.save.lock().unwrap().take().ok_or("no Save window chose a place")?;
    tauri::async_runtime::spawn_blocking(move || {
        write_atomic(&path, &bytes).map_err(|error| format!("couldn't write {}: {error}", path.display()))
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Shows the Open window. Resolves to the chosen file's name, or None when
/// the person cancels.
#[tauri::command]
pub async fn open_dialog(
    app: AppHandle,
    window: WebviewWindow,
    chosen: State<'_, Chosen>,
    types: Vec<FileType>,
) -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        dialog(&app, &window, &types).blocking_pick_file()?.into_path().ok()
    })
    .await
    .map_err(|error| error.to_string())?;
    let name = picked.as_deref().map(file_name);
    *chosen.open.lock().unwrap() = picked;
    Ok(name)
}

/// The contents of the file the last Open window chose, as raw bytes.
#[tauri::command]
pub async fn read_opened_file(chosen: State<'_, Chosen>) -> Result<Response, String> {
    let path = chosen.open.lock().unwrap().take().ok_or("no Open window chose a file")?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::read(&path)
            .map(Response::new)
            .map_err(|error| format!("couldn't read {}: {error}", path.display()))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> Vec<FileType> {
        vec![FileType { description: "Pixel Stitch project".into(), extensions: vec!["tps".into(), "json".into()] }]
    }

    #[test]
    fn a_name_typed_without_an_extension_gets_the_filters_first_one() {
        assert_eq!(with_extension(PathBuf::from("/art/Hero walk"), &project()), PathBuf::from("/art/Hero walk.tps"));
    }

    #[test]
    fn a_name_with_an_extension_is_kept_as_typed() {
        assert_eq!(with_extension(PathBuf::from("/art/hero.json"), &project()), PathBuf::from("/art/hero.json"));
        assert_eq!(with_extension(PathBuf::from("/art/hero.txt"), &project()), PathBuf::from("/art/hero.txt"));
    }

    #[test]
    fn a_name_with_a_dot_in_it_is_not_cut_short() {
        // `with_extension` would replace "2" here; the name has an extension
        // already as far as the system is concerned, so it is left alone.
        assert_eq!(with_extension(PathBuf::from("/art/walk v1.2"), &project()), PathBuf::from("/art/walk v1.2"));
    }
}
