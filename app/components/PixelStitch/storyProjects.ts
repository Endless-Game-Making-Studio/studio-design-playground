import { h } from 'vue'
import { providePixelStitchProjects, usePixelStitchProjects } from '../../composables/usePixelStitchProjects'
import type { PixelStitchProjects } from '../../composables/usePixelStitchProjects'
import type { ProjectSummary } from '../../composables/pixelStitch/types'

const MINUTE = 60_000

/** Sample projects, newest first, with one long name to show truncation. */
export const SAMPLE_PROJECTS: ProjectSummary[] = [
  { id: 'hero', name: 'Hero idle', canvasSize: 32, createdAt: 0, updatedAt: Date.now() - 2 * MINUTE },
  { id: 'heart', name: 'Heart pickup', canvasSize: 16, createdAt: 0, updatedAt: Date.now() - 55 * MINUTE },
  { id: 'coin', name: 'Gold coin spin', canvasSize: 32, createdAt: 0, updatedAt: Date.now() - 26 * 60 * MINUTE },
  { id: 'forest', name: 'Forest tileset — autumn variant with mushrooms', canvasSize: 64, createdAt: 0, updatedAt: Date.now() - 3 * 24 * 60 * MINUTE },
  { id: 'boss', name: 'Boss arena', canvasSize: 128, createdAt: 0, updatedAt: Date.now() - 6 * 24 * 60 * MINUTE }
]

/**
 * The tabs and the start screen read the project library out of the page's
 * `provide`, so neither renders standalone. This builds a library that never
 * touches storage and provides it, seeded however the story needs.
 */
export function withProjects(options: { width?: string, seed?: (projects: PixelStitchProjects) => void } = {}) {
  return () => ({
    setup() {
      const projects = usePixelStitchProjects({ persist: false })
      options.seed?.(projects)
      providePixelStitchProjects(projects)
    },
    render(this: { $slots: { default?: () => unknown } }) {
      return h('div', { class: options.width ?? 'w-[1100px]' }, this.$slots.default?.() as never)
    }
  })
}

export function seedProjects(open: string[], active: string | null) {
  return (projects: PixelStitchProjects) => {
    projects.projects.value = SAMPLE_PROJECTS.map(project => ({ ...project }))
    projects.openIds.value = open
    projects.activeId.value = active
  }
}
