//! Closing the window. Autosave waits a moment after each change before it
//! writes, and the disk writes run in the background, so quitting the moment
//! the window is asked to close would lose the last stroke. The shell holds
//! the close and asks the page to save everything first; the page answers with
//! `quit` once the writes are done, or with `quit_held` when it asks the person
//! whether to quit after a write failed.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime, State, Window, WindowEvent};

/// How long the page gets to save and answer before the shell quits anyway,
/// so a page that has stopped responding can still be closed. Saving takes
/// well under a second even for tens of megabytes of projects.
const PAGE_DEADLINE: Duration = Duration::from_secs(10);

/// What the page runs when the window is asked to close. A page that hasn't
/// installed its handler (still starting, or not the tool) has nothing waiting
/// to be saved, so it quits at once.
const ASK_PAGE: &str = "(window.__pixelStitchCloseRequested || (() => window.__TAURI_INTERNALS__.invoke('quit')))()";

/// Which close request the page is answering, if any. Each request gets a new
/// number, so a deadline left over from an earlier request that the page put
/// on hold can't quit the app during a later one.
#[derive(Default)]
pub struct CloseRequests {
    next: AtomicU64,
    pending: AtomicU64,
}

impl CloseRequests {
    /// Starts a request and returns its number, or None while one is already
    /// waiting on the page (a second click on the close button).
    fn begin(&self) -> Option<u64> {
        let request = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        self.pending
            .compare_exchange(0, request, Ordering::SeqCst, Ordering::SeqCst)
            .ok()
            .map(|_| request)
    }

    fn is_pending(&self, request: u64) -> bool {
        self.pending.load(Ordering::SeqCst) == request
    }

    fn hold(&self) {
        self.pending.store(0, Ordering::SeqCst);
    }
}

pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    api.prevent_close();

    let app = window.app_handle().clone();
    let Some(request) = app.state::<CloseRequests>().begin() else {
        return;
    };
    let asked = app
        .get_webview_window(window.label())
        .map(|webview| webview.eval(ASK_PAGE).is_ok())
        .unwrap_or(false);
    if !asked {
        app.exit(0);
        return;
    }

    std::thread::spawn(move || {
        std::thread::sleep(PAGE_DEADLINE);
        if app.state::<CloseRequests>().is_pending(request) {
            eprintln!("Pixel Stitch: the page didn't answer the close in time, quitting anyway");
            app.exit(0);
        }
    });
}

/// The page has saved everything it could, or the person chose to quit anyway.
#[tauri::command]
pub fn quit<R: Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

/// The page is asking the person whether to quit after a failed write. The
/// window stays open until they answer, however long that takes, and a later
/// click on the close button starts a new request.
#[tauri::command]
pub fn quit_held(requests: State<'_, CloseRequests>) {
    requests.hold();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_second_request_while_one_is_pending_is_ignored() {
        let requests = CloseRequests::default();
        let first = requests.begin().expect("the first request starts");
        assert!(requests.begin().is_none());
        assert!(requests.is_pending(first));
    }

    #[test]
    fn a_held_request_lets_a_later_one_start_and_its_deadline_lapses() {
        let requests = CloseRequests::default();
        let first = requests.begin().unwrap();
        requests.hold();
        assert!(!requests.is_pending(first));
        let second = requests.begin().expect("a new request starts after a hold");
        assert_ne!(first, second);
        assert!(!requests.is_pending(first));
        assert!(requests.is_pending(second));
    }
}
