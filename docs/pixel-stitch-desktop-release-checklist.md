# Pixel Stitch desktop: how to release, and the manual checklist

The `Pixel Stitch desktop` workflow (`.github/workflows/pixel-stitch-desktop.yml`) builds the installers. Nobody publishes a release until this checklist has been run on a Windows machine and an Ubuntu machine against the files in the draft.

## How to release

1. Bump `"version"` in `package.json` (for example `0.2.0`). The installers take their version from there, through `src-tauri/tauri.conf.json`. Commit and merge it to `main`.
2. Tag that commit and push the tag:
   ```sh
   git tag pixel-stitch-v0.2.0
   git push origin pixel-stitch-v0.2.0
   ```
3. The workflow builds on Windows and Ubuntu. It fails if the tag doesn't match `package.json`, or if the Windows installer or the .deb is over 15 MB (it names the file and by how much). When it passes, it creates a draft GitHub Release for the tag with these files:
   - `Pixel.Stitch_<version>_x64-setup.exe`: Windows (GitHub replaces the space in the name with a dot)
   - `Pixel.Stitch_<version>_amd64.deb`: Ubuntu, Debian
   - `Pixel.Stitch-<version>-1.x86_64.rpm`: Fedora
   - `Pixel.Stitch_<version>_amd64.AppImage`: other distributions. It carries its own WebKitGTK, so it's much larger and has no size budget.
4. Run the checklist below on both systems with the files from the draft.
5. Publish the draft.

To check a build without releasing, run the workflow by hand from the Actions tab (`Run workflow`) on a branch. It runs the same checks and leaves the files as workflow artifacts. Locally, `npm run desktop:installers` builds the installers for the machine you're on, and `npm run desktop:check-size` runs the size check against them.

### Size budget

`scripts/check-installer-size.mjs` holds the budget: 15 MB (15 × 1024 × 1024 bytes) each for the NSIS setup .exe and the .deb. The Windows installer includes Microsoft's WebView2 bootstrapper (about 1.8 MB).

## Before you start

- **Unknown publisher.** The app isn't code-signed, so on Windows, SmartScreen shows "Windows protected your PC" with an unknown publisher the first time the installer runs. Choose **More info**, then **Run anyway**. This is expected and not a bug. Some browsers also warn when downloading an unsigned .exe.
- Use a Windows 10 or 11 account **without** administrator rights if you have one. Otherwise, watch for any UAC (administrator) prompt: there should be none.
- Use Ubuntu 22.04 or newer. The packages need WebKitGTK 4.1 at version 2.40 or newer (Ubuntu 22.04+, Debian 12+, Fedora 38+). To check: `apt-cache policy libwebkit2gtk-4.1-0`.
- Have a PNG, a JPG and a sprite sheet PNG ready to import.

## Checklist

Run every section on Windows and on Ubuntu. Tick both columns.

### Install

| Step | Windows | Ubuntu |
| --- | --- | --- |
| Windows: run the setup .exe. It installs without a UAC prompt, into `%LOCALAPPDATA%\Pixel Stitch`. | [ ] | n/a |
| Ubuntu: `sudo apt install "./Pixel.Stitch_<version>_amd64.deb"` installs it, and pulls in `libwebkit2gtk-4.1-0` if missing. | n/a | [ ] |
| The app appears in the Start menu or the app launcher as "Pixel Stitch", with its icon. | [ ] | [ ] |
| Settings → Apps (Windows) or the package's info (`apt show`) shows the version you're releasing. | [ ] | [ ] |
| The window title bar, taskbar and Alt+Tab show the app's icon. | [ ] | [ ] |

### First launch with the network off

| Step | Windows | Ubuntu |
| --- | --- | --- |
| Turn the network off (airplane mode on Windows; `nmcli networking off` on Ubuntu), then open the app from the Start menu or launcher. | [ ] | [ ] |
| The start screen shows, with its fonts and icons, and nothing looks broken. | [ ] | [ ] |
| Create a project and draw a few pixels. Everything works without the network. | [ ] | [ ] |
| Turn the network back on. | [ ] | [ ] |

### Language follows the system

The language you pick on the start screen is saved and wins over the system's afterwards. Run this on a fresh install, before touching the language control.

| Step | Windows | Ubuntu |
| --- | --- | --- |
| With the system in English, the app opens in English. | [ ] | [ ] |
| With the system in Spanish, the app opens in Spanish. Windows: Settings → Time & language → Language & region → Windows display language, then sign out and in. Ubuntu: `LANG=es_ES.UTF-8 <path to the app>` from a terminal (or Settings → Region & Language). | [ ] | [ ] |
| With the system in another language (for example French), the app opens in English. | [ ] | [ ] |
| Changing the language on the start screen sticks after quitting and reopening. | [ ] | [ ] |
| The start screen footer shows the version you're releasing. | [ ] | [ ] |

### Native Save and Open windows

Each of these opens the system's own Save or Open window, not a browser download or file picker. Cancelling the window does nothing and shows no error. Each file opens in another app afterwards (an image viewer, or Pixel Stitch itself for project files).

| Step | Windows | Ubuntu |
| --- | --- | --- |
| **Save as .tps file**: saves a project file. | [ ] | [ ] |
| **Open** a .tps file: it opens in a new tab with the drawing intact. | [ ] | [ ] |
| **Save as PNG**: saves the current frame. | [ ] | [ ] |
| **Export the animation as a GIF**: saves a GIF that plays all frames. | [ ] | [ ] |
| **Export sprite sheet**: saves one image with every frame. | [ ] | [ ] |
| **Import sprite sheet** → **Choose image**: the frames come in. | [ ] | [ ] |
| **Import an image onto the canvas**: a PNG and a JPG both become pixels. | [ ] | [ ] |
| Cancel each window once: nothing happens, no error toast. | [ ] | [ ] |

### The window remembers its size, position and maximised state

| Step | Windows | Ubuntu |
| --- | --- | --- |
| Resize and move the window, quit, reopen: same size and place. | [ ] | [ ] |
| Maximise, quit, reopen: it opens maximised. Un-maximise: it returns to the earlier size. | [ ] | [ ] |
| The window can't be made smaller than its minimum size. | [ ] | [ ] |
| Opening the app a second time brings the open window to the front instead of starting a second copy. | [ ] | [ ] |

### Uninstall

| Step | Windows | Ubuntu |
| --- | --- | --- |
| Windows: Settings → Apps → Installed apps → Pixel Stitch → Uninstall. It runs without a UAC prompt. | [ ] | n/a |
| Ubuntu: `sudo apt remove <package>` (find the name with `dpkg -l \| grep -i stitch`). | n/a | [ ] |
| The Start menu or launcher entry is gone, and so is the install folder. | [ ] | [ ] |

### Other distributions (spot check)

| Step | Result |
| --- | --- |
| On Fedora 38+, `sudo dnf install ./Pixel.Stitch-<version>-1.x86_64.rpm`, open the app, save a PNG. | [ ] |
| The AppImage: `chmod +x` it, run it, save a PNG. | [ ] |
