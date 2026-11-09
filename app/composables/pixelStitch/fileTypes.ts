import type { FileType } from './host'

// The file kinds Pixel Stitch saves and opens, shared by every caller so a
// native dialog's filters read the same wherever they appear. The description
// is the filter's name in the system's Save and Open windows, so it follows
// the tool's language; callers pass their `t`.

type Translate = (key: string) => string

export const projectFileType = (t: Translate): FileType => ({
  description: t('pixelStitch.files.projectType'),
  extensions: ['tps', 'json']
})

export const pngFileType = (t: Translate): FileType => ({
  description: t('pixelStitch.files.pngType'),
  extensions: ['png'],
  mimeTypes: ['image/png']
})

export const gifFileType = (t: Translate): FileType => ({
  description: t('pixelStitch.files.gifType'),
  extensions: ['gif'],
  mimeTypes: ['image/gif']
})

export const imageFileType = (t: Translate): FileType => ({
  description: t('pixelStitch.files.imageType'),
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
  mimeTypes: ['image/*']
})
