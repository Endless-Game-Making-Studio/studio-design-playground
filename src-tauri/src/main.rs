// Without this a release build opens a console window next to the app on
// Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage;

use std::path::PathBuf;

use tauri::{App, Manager, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_window_state::StateFlags;

/// Points everything the app writes at another folder: Pixel Stitch's own
/// storage (in `storage/`), the web engine's profile and the remembered window
/// state. The shell spec runs every launch
/// against a fresh temporary folder through it, and it also makes a portable
/// copy possible.
const DATA_DIR_VAR: &str = "PIXEL_STITCH_DATA_DIR";

const WINDOW_STATE_FILE: &str = ".window-state.json";

// The smallest inner size at which the tool's layout holds, in logical
// pixels. Measured with the desktop bundle in Chromium, stepping the viewport
// down with a new 32×32 project open (the default board, at its starting
// zoom):
// - below 970 wide the 512px board no longer fits beside the tool rail and
//   the colour panel, and the canvas area starts to scroll sideways;
// - below 640 tall the board's bottom rows go under the animation bar.
// The start screen and the toolbar hold well below both. With the animation
// timeline opened, the layers list's last row is cut off below 780 tall; that
// is the tool's own layout and is the same in a browser, and 780 would not fit
// a 1366×768 screen, so the minimum stays at the closed-timeline size.
const MIN_WIDTH: f64 = 970.0;
const MIN_HEIGHT: f64 = 640.0;

fn data_dir() -> Option<PathBuf> {
    std::env::var_os(DATA_DIR_VAR)
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
}

fn main() {
    let mut window_state = tauri_plugin_window_state::Builder::default().with_state_flags(
        // VISIBLE too: the window is created hidden and the plugin shows it once
        // it is back at its saved size and place, so it never jumps on screen.
        StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::VISIBLE,
    );
    if let Some(dir) = data_dir() {
        // The plugin joins this onto the app's config folder, and joining an
        // absolute path replaces it.
        window_state = window_state.with_filename(dir.join(WINDOW_STATE_FILE).to_string_lossy());
    }

    tauri::Builder::default()
        // Registered first, so a second launch hands over to the running app
        // and exits before any other plugin starts.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(window_state.build())
        .invoke_handler(tauri::generate_handler![
            storage::storage_read,
            storage::storage_write,
            storage::storage_remove
        ])
        .setup(|app| {
            let root = storage::storage_root(data_dir(), app.path().app_data_dir()?);
            app.manage(storage::Storage::new(root));
            create_main_window(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pixel Stitch");
}

fn create_main_window(app: &mut App) -> tauri::Result<WebviewWindow> {
    // Built here rather than by Tauri from the config, so the profile folder
    // can follow PIXEL_STITCH_DATA_DIR. The rest comes from tauri.conf.json.
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .expect("tauri.conf.json declares the main window")
        .clone();

    let mut builder = WebviewWindowBuilder::from_config(app.handle(), &config)?
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT);
    if let Some(dir) = data_dir() {
        std::fs::create_dir_all(&dir)?;
        builder = builder.data_directory(dir.join("webview"));
    }

    let window = builder.build()?;
    #[cfg(all(windows, not(debug_assertions)))]
    lock_down_webview(&window)?;
    Ok(window)
}

/// Turns off what makes the window behave like a web page rather than an app:
/// reload (F5, Ctrl+R), find, print and the other browser keys, plus the
/// engine's own right-click menu. Page zoom keys are already off through
/// `zoomHotkeysEnabled`, and developer tools are left out of release builds by
/// Tauri. Editing keys still reach the page, so the tool's undo, redo, copy,
/// cut, paste and Escape keep working.
///
/// Tauri has no setting for these two, so they go straight to WebView2.
#[cfg(all(windows, not(debug_assertions)))]
fn lock_down_webview(window: &WebviewWindow) -> tauri::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;

    window.with_webview(|webview| unsafe {
        let settings = webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.Settings());
        match settings {
            Ok(settings) => {
                let _ = settings.SetAreDefaultContextMenusEnabled(false);
                if let Ok(settings) = settings.cast::<ICoreWebView2Settings3>() {
                    let _ = settings.SetAreBrowserAcceleratorKeysEnabled(false);
                }
            }
            Err(error) => eprintln!("Pixel Stitch: couldn't reach the WebView2 settings: {error}"),
        }
    })
}
