import { startupLocale } from '~/composables/pixelStitch/locale'

// Sets the desktop build's language before anything renders, so the tool never
// shows a flash of the wrong one. Registered from nuxt.config's `$env.desktop`,
// so the web build keeps i18n's own handling and its account-menu control.
export default defineNuxtPlugin({
  name: 'pixel-stitch-desktop-locale',
  // After every default plugin: the remembered choice is read through the host,
  // and a desktop host is swapped in by a plugin of its own (#41).
  enforce: 'post',
  async setup(nuxtApp) {
    const locale = await startupLocale(navigator.language)
    await nuxtApp.$i18n.setLocale(locale)
  }
})
