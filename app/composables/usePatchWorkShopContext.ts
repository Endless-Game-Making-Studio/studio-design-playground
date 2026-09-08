import type { InjectionKey } from 'vue'
import { usePatchWorkShop } from '~/composables/usePatchWorkShop'

export type PatchWorkShopEditor = ReturnType<typeof usePatchWorkShop>

const PATCHWORKSHOP_KEY: InjectionKey<PatchWorkShopEditor> = Symbol('patchworkshop')

/**
 * Same provide/inject shape as Pixel Stitch's editor: the page owns one
 * instance and every panel underneath reads and mutates it through this
 * context instead of threading it through as props.
 */
export function providePatchWorkShop(editor: PatchWorkShopEditor) {
  provide(PATCHWORKSHOP_KEY, editor)
}

export function usePatchWorkShopContext(): PatchWorkShopEditor {
  const editor = inject(PATCHWORKSHOP_KEY, null)
  if (!editor) throw new Error('PatchWorkShop panels must be rendered inside the PatchWorkShop page')
  return editor
}
