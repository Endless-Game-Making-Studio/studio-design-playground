import { createDesktopHost, shellInvoke } from '~/composables/pixelStitch/desktopHost'
import { setPixelStitchHost } from '~/composables/pixelStitch/host'

// Inside the desktop shell, Pixel Stitch keeps its projects as files on disk.
// The same bundle opened in a plain browser (the desktop test runs) has no
// shell to ask, so it stays on the browser host. Registered from nuxt.config's
// `$env.desktop`; the web build never swaps hosts.
export default defineNuxtPlugin({
  name: 'pixel-stitch-desktop-host',
  setup() {
    const invoke = shellInvoke()
    if (invoke) setPixelStitchHost(createDesktopHost(invoke))
  }
})
