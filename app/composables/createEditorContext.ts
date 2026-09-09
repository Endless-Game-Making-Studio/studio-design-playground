import type { InjectionKey } from 'vue'

/**
 * Each maker tool's page owns one editor instance and every panel underneath
 * reads and mutates it through provide/inject rather than prop drilling. The
 * pair is identical every time bar the key and the message a panel gets when
 * it's rendered somewhere the page hasn't provided one, so it's built here.
 */
export function createEditorContext<T>(name: string, outsideProviderMessage: string) {
  const key: InjectionKey<T> = Symbol(name)

  return {
    provide: (editor: T) => provide(key, editor),
    use: (): T => {
      const editor = inject(key, null)
      if (!editor) throw new Error(outsideProviderMessage)
      return editor
    }
  }
}
