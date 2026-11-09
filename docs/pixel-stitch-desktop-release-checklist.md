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

Each of these opens the system's own Save or Open window, not a browser download or file picker. The automatic runs only check what the page asks the shell for, so these steps check that the real windows do the right thing. Each saved file opens in another app afterwards (an image viewer, or Pixel Stitch itself for project files).

| Step | Windows | Ubuntu |
| --- | --- | --- |
| **Save → Project**: the Save window has the project's name filled in (`<name>.tps`), and its file type list offers only "Pixel Stitch project" (`*.tps`, `*.json`). | [ ] | [ ] |
| Save it in a folder of your choice: the file is there, with that name, and "Project saved" shows. | [ ] | [ ] |
| Save again, and delete `.tps` from the name before saving: the file still ends in `.tps`. | [ ] | [ ] |
| **Import → Project**: the Open window offers only project files. The file opens in a new tab named after the file, with its drawing, frames, layers and board size. The tab that was open is still there. | [ ] | [ ] |
| A project file saved from Pixel Stitch on the platform (Make → Pixel Stitch → Save → Project) imports the same way, with its frames, layers and board size. | [ ] | [ ] |
| **Save → PNG**: the Save window offers only "PNG image". The file is the current frame. | [ ] | [ ] |
| **Save → GIF** (with two frames or more): the Save window offers only "GIF animation". The GIF plays all frames. | [ ] | [ ] |
| **Save → Sprite sheet** → **Export**: the Save window offers only "PNG image". The image holds every frame. | [ ] | [ ] |
| **Import → Image**: the Open window offers only "Image" (png, jpg, jpeg, gif, webp, bmp). A PNG and a JPG both become pixels. | [ ] | [ ] |
| **Import → Sprite sheet** → **Choose image**: the Open window offers only images. The chosen file's name shows, and **Import** brings the frames in. | [ ] | [ ] |
| Cancel each window above once (with Cancel, and with Esc): nothing changes, no tab opens, no message shows. | [ ] | [ ] |
| Save a PNG over a file another program holds open (Windows: a PNG open in an editor that locks it; Ubuntu: a file in a folder you made read-only with `chmod a-w`), and confirm replacing it: "Couldn't save the file there…" shows, and the app keeps working. (A protected folder such as `C:\Windows` is refused by the Save window itself before Pixel Stitch sees it.) | [ ] | [ ] |
| With the app in Spanish, the windows name the file types in Spanish: "Proyecto de Pixel Stitch", "Imagen PNG", "Animación GIF", "Imagen". | [ ] | [ ] |

### Browser behaviour is off

On Windows, `npm run test:shell` covers this. On Ubuntu it has to be done by hand. Draw a few pixels first, so a reload would show.

| Step | Windows | Ubuntu |
| --- | --- | --- |
| Right-click the board and the panels: no menu appears (no Back, Reload or Inspect Element). | test:shell | [ ] |
| F5, Ctrl+R and Ctrl+Shift+R don't reload: the drawing and the open tabs stay as they are. | test:shell | [ ] |
| F12 and Ctrl+Shift+I don't open developer tools or an inspector. | test:shell | [ ] |
| Ctrl + plus, Ctrl + minus, Ctrl+0 and Ctrl + mouse wheel don't zoom the page. | test:shell | [ ] |
| Ctrl+Z still undoes, and Ctrl+C / Ctrl+V still copy and paste a selection. | test:shell | [ ] |

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
