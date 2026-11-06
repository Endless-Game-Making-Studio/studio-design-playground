import { usePixelStitchHost } from './host'

export type PixelStitchLocale = 'en' | 'es'

// Kept beside the projects in the host's storage, so on desktop the choice
// lives in the app data folder with them rather than in a WebView cookie.
const LOCALE_KEY = 'pixel-stitch-locale'

const isLocale = (value: unknown): value is PixelStitchLocale => value === 'en' || value === 'es'

/**
 * The language the desktop build starts in: the one the person picked last, or
 * else the system's (which the WebView reports as `navigator.language`),
 * Spanish for any Spanish variant and English for everything else.
 */
export async function startupLocale(systemLanguage: string): Promise<PixelStitchLocale> {
  const { storage } = usePixelStitchHost()
  await storage.load([LOCALE_KEY])
  const saved = storage.read(LOCALE_KEY)
  if (isLocale(saved)) return saved
  return systemLanguage.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function saveLocale(locale: PixelStitchLocale) {
  usePixelStitchHost().storage.write(LOCALE_KEY, locale)
}
