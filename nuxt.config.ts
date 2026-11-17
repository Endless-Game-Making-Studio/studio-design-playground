import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineNuxtConfig({
  compatibilityDate: '2026-07-21',
  modules: ['@nuxt/ui', '@nuxt/icon', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // True only in the desktop build ($env.desktop below), for the few
      // places the tool must tell the two apart.
      isDesktop: false,
      // The version the desktop start screen shows; empty on the web, which
      // doesn't show one.
      appVersion: ''
    }
  },
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'kids', 'purple', 'blue', 'rose']
    },
    // @nuxt/fonts' Storybook dev-handler crashes the whole process (passes a
    // bare {path} object instead of a real h3 event to setResponseHeader).
    // Fonts here load via a plain @import in main.css, so the module isn't
    // needed — disable it only under Storybook to dodge the crash.
    fonts: process.env.STORYBOOK === 'true' ? false : undefined
  },
  icon: {
    provider: 'server',
    serverBundle: {
      collections: ['lucide']
    },
    // Pixel Stitch's own pixel-art icons, drawn on a 16×16 grid so each pixel
    // lands on exactly 2 screen pixels at the rail's 32px icon size.
    customCollections: [
      { prefix: 'pixel', dir: './app/assets/icons/pixel' }
    ]
  },
  colorMode: {
    preference: 'light'
  },
  vite: {
    server: {
      allowedHosts: ['dev.home']
    }
  },
  i18n: {
    defaultLocale: 'en',
    // Keeps existing routes (/, /learn, /learn/[programId]) unprefixed — only
    // the Program page's own copy is translated so far, not the whole app.
    strategy: 'no_prefix',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'es', name: 'Español', file: 'es.json' }
    ]
  },
  // The desktop build (`npm run build:desktop`, issue #39): the same app, cut
  // down to Pixel Stitch alone and made to work with no network. A Tauri shell
  // loads its static output from disk. Everything above stays the web build's.
  $env: {
    desktop: {
      ssr: false,
      // Its own build and output folders, so a desktop build never clobbers a
      // running dev server's `.nuxt` or the web build's `.output`.
      buildDir: '.nuxt-desktop',
      // The web app's public folder is the platform's images and sounds, none of
      // which the tool uses; leaving them out keeps the installer small.
      dir: { public: 'app/desktop/public' },
      nitro: {
        output: { dir: '.output-desktop' }
      },
      runtimeConfig: {
        public: { isDesktop: true, appVersion: version }
      },
      // The desktop start screen has its own language control, remembered
      // through the Pixel Stitch host, and the plugin below picks the language
      // at startup; i18n's own browser detection and cookie would compete.
      i18n: { detectBrowserLanguage: false },
      // The host first: the language plugin reads the remembered choice
      // through it (it is `enforce: 'post'` for that reason too).
      plugins: [
        fileURLToPath(new URL('./app/desktop/host.client.ts', import.meta.url)),
        fileURLToPath(new URL('./app/desktop/locale.client.ts', import.meta.url))
      ],
      // No server to ask for icons, so every icon in use ships in the client
      // bundle: whatever the app's code names (the scan) plus Nuxt UI's own,
      // which @nuxt/ui adds to the bundle itself. A miss stays a miss rather
      // than falling back to the Iconify API on the internet.
      icon: {
        provider: 'none',
        fallbackToApi: false,
        clientBundle: {
          scan: { globInclude: ['**/*.{vue,ts}'], globExclude: ['node_modules', '.*'] },
          includeCustomCollections: true,
          sizeLimitKb: 512
        }
      },
      // @nuxt/fonts (which @nuxt/ui installs) downloads Figtree and Inter at
      // build time and serves them from the bundle's `_fonts/`, in place of
      // main.css's Google Fonts import (dropped below). Only the build needs
      // the network.
      fonts: {
        families: [
          { name: 'Figtree', provider: 'google', weights: [400, 500, 600, 700, 800] },
          { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] }
        ]
      },
      vite: {
        plugins: [{
          // main.css loads the fonts from Google for the web build; here they
          // come from the bundle instead (fonts above), so the import goes.
          name: 'desktop:drop-google-fonts',
          enforce: 'pre',
          transform(code, id) {
            if (!id.split('?')[0]!.endsWith('/assets/css/main.css')) return
            return code.replace(/@import url\("https:\/\/fonts\.googleapis\.com\/[^"]*"\);\r?\n?/, '')
          }
        }]
      },
      modules: [
        (_options, nuxt) => {
          // One route, at the root: the tool on its own.
          nuxt.hook('pages:extend', (pages) => {
            pages.splice(0, pages.length, {
              name: 'index',
              path: '/',
              file: fileURLToPath(new URL('./app/desktop/index.vue', import.meta.url))
            })
          })
          // The platform's layouts carry its chrome, and nothing here uses them.
          nuxt.hook('app:resolve', (app) => {
            app.layouts = {}
          })
        }
      ]
    }
  }
})
