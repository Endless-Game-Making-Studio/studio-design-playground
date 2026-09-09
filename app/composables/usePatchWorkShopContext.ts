import { createEditorContext } from '~/composables/createEditorContext'
import { usePatchWorkShop } from '~/composables/usePatchWorkShop'

export type PatchWorkShopEditor = ReturnType<typeof usePatchWorkShop>

/**
 * Same provide/inject shape as Pixel Stitch's editor: the page owns one
 * instance and every panel underneath reads and mutates it through this
 * context instead of threading it through as props.
 */
const context = createEditorContext<PatchWorkShopEditor>(
  'patchworkshop',
  'PatchWorkShop panels must be rendered inside the PatchWorkShop page'
)

export const providePatchWorkShop = context.provide
export const usePatchWorkShopContext = context.use
