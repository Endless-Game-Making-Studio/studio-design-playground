import type { FileType } from './host'

// The file kinds Pixel Stitch saves and opens, shared by every caller so a
// native dialog's filters read the same wherever they appear.

export const PROJECT_FILE: FileType = { description: 'Pixel Stitch project', extensions: ['tps', 'json'] }
export const PNG_FILE: FileType = { description: 'PNG image', extensions: ['png'], mimeTypes: ['image/png'] }
export const GIF_FILE: FileType = { description: 'GIF animation', extensions: ['gif'], mimeTypes: ['image/gif'] }
export const IMAGE_FILE: FileType = {
  description: 'Image',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
  mimeTypes: ['image/*']
}
