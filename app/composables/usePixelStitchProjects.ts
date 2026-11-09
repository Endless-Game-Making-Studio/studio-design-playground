import type { InjectionKey } from 'vue'
import type { ProjectData, ProjectSummary } from '~/composables/pixelStitch/types'
import { PROJECT_NAME_MAX } from '~/composables/pixelStitch/types'
import { createFrame } from '~/composables/pixelStitch/project'
import {
  clearLegacyProject,
  deleteProject,
  loadIndex,
  loadLegacyProject,
  loadWorkspace,
  preloadProject,
  preloadStorage,
  saveIndex,
  saveProject,
  saveWorkspace
} from '~/composables/pixelStitch/persistence'

export function emptyProject(size: number): ProjectData {
  return { version: 1, canvasSize: size, fps: 8, currentFrameIndex: 0, frames: [createFrame(size, Date.now())] }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanName(name: string) {
  return name.trim().slice(0, PROJECT_NAME_MAX)
}

/**
 * Everything in Pixel Stitch that spans more than one project: the saved
 * projects, which of them are open as tabs and in what order, and which tab is
 * in front. Each tab's drawing is its own editor (`usePixelStitch`), which
 * saves its pixels under its project's id and reports back through `touch`.
 *
 * No active tab means the start screen is showing.
 */
export function usePixelStitchProjects(options: { persist?: boolean } = {}) {
  // Off for Storybook, where a story's sample projects must not be written
  // over the developer's real ones.
  const { persist = true } = options
  const { t } = useI18n()

  const projects = ref<ProjectSummary[]>([])
  const openIds = ref<string[]>([])
  const activeId = ref<string | null>(null)
  // Storage only exists on the client, and a host may read it asynchronously,
  // so nothing is known until mount and the preload. The page waits on this rather than flashing the start screen at someone whose
  // tabs are about to be restored.
  const ready = ref(!persist)

  // The tab "+" was pressed from, so dismissing the start screen goes back to
  // it rather than to whichever tab happens to be last.
  let returnTo: string | null = null

  const recentProjects = computed(() => [...projects.value].sort((a, b) => b.updatedAt - a.updatedAt))
  const openProjects = computed(() => openIds.value.map(id => byId(id)).filter(project => !!project))

  function byId(id: string) {
    return projects.value.find(project => project.id === id)
  }

  // Counts up from the highest "Untitled N" already taken, the same rule the
  // layer panel uses, so deleting "Untitled 2" doesn't hand its number out
  // again while "Untitled 3" exists. The pattern comes from the translation, so
  // "Sin título 4" counts in Spanish.
  function suggestName() {
    const marker = 987654321
    const [before = '', after = ''] = t('pixelStitch.projects.untitled', { n: marker }).split(String(marker))
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`^${escape(before)}(\\d+)${escape(after)}$`)
    const highest = projects.value.reduce((max, project) => {
      const match = pattern.exec(project.name)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)
    return t('pixelStitch.projects.untitled', { n: highest + 1 })
  }

  function add(name: string, data: ProjectData) {
    const id = newId()
    const now = Date.now()
    const saved = persist ? saveProject(id, data) : true
    projects.value.push({ id, name, canvasSize: data.canvasSize, createdAt: now, updatedAt: now })
    openIds.value.push(id)
    activeId.value = id
    returnTo = null
    return { id, saved }
  }

  function create(name: string, size: number) {
    const clean = cleanName(name)
    if (!clean) return null
    return add(clean, emptyProject(size))
  }

  /** A project file opens as a project of its own rather than over the open one. */
  function importProject(name: string, data: ProjectData) {
    return add(cleanName(name) || suggestName(), data)
  }

  // A closed project is loaded before its tab mounts: the tab's editor reads
  // its drawing synchronously, and a host that keeps projects on disk only has
  // it in memory once loaded.
  async function open(id: string) {
    if (!byId(id)) return
    if (!openIds.value.includes(id)) {
      if (persist) await preloadProject(id)
      if (!byId(id)) return
      if (!openIds.value.includes(id)) openIds.value.push(id)
    }
    activeId.value = id
    returnTo = null
  }

  function activate(id: string) {
    if (!openIds.value.includes(id)) return
    activeId.value = id
    returnTo = null
  }

  function showStart() {
    if (activeId.value === null) return
    returnTo = activeId.value
    activeId.value = null
  }

  function closeStart() {
    if (openIds.value.length === 0) return
    activeId.value = returnTo && openIds.value.includes(returnTo) ? returnTo : openIds.value.at(-1)!
    returnTo = null
  }

  // Closing never deletes: the project stays in the start screen's list. The
  // tab's editor writes any change still waiting on autosave as it unmounts.
  function close(id: string) {
    const index = openIds.value.indexOf(id)
    if (index === -1) return
    openIds.value.splice(index, 1)
    if (activeId.value === id) activeId.value = openIds.value[index] ?? openIds.value[index - 1] ?? null
    if (returnTo === id) returnTo = null
  }

  function rename(id: string, name: string) {
    const project = byId(id)
    const clean = cleanName(name)
    if (project && clean) project.name = clean
  }

  async function remove(id: string) {
    close(id)
    // Wait for the tab's editor to unmount: it flushes its last save on the
    // way out, and deleting first would let that write the project back.
    await nextTick()
    if (persist) deleteProject(id)
    projects.value = projects.value.filter(project => project.id !== id)
  }

  /** Called by a tab's editor after each save, so the list's date and size stay true. */
  function touch(id: string, data: ProjectData) {
    const project = byId(id)
    if (!project) return
    project.updatedAt = Date.now()
    project.canvasSize = data.canvasSize
  }

  async function restore() {
    await preloadStorage()
    const index = loadIndex()
    if (index) {
      projects.value = index
      const workspace = loadWorkspace()
      openIds.value = (workspace?.open ?? []).filter(id => byId(id))
      const active = workspace?.active ?? null
      activeId.value = active && openIds.value.includes(active) ? active : null
      if (activeId.value === null) returnTo = openIds.value.at(-1) ?? null
    } else {
      // First visit since projects arrived: a drawing from the single-project
      // version becomes a project in a tab, so nobody finds their work gone.
      const legacy = loadLegacyProject()
      if (legacy && add(t('pixelStitch.projects.untitled', { n: 1 }), legacy).saved) clearLegacyProject()
    }
    ready.value = true
  }

  if (persist) {
    onMounted(restore)

    watch(projects, (value) => {
      if (ready.value) saveIndex(value)
    }, { deep: true })

    watch([openIds, activeId], () => {
      if (ready.value) saveWorkspace({ open: [...openIds.value], active: activeId.value })
    }, { deep: true })
  }

  return {
    projects,
    recentProjects,
    openIds,
    openProjects,
    activeId,
    ready,
    byId,
    suggestName,
    create,
    importProject,
    open,
    activate,
    showStart,
    closeStart,
    close,
    rename,
    remove,
    touch
  }
}

export type PixelStitchProjects = ReturnType<typeof usePixelStitchProjects>

const PROJECTS_KEY: InjectionKey<PixelStitchProjects> = Symbol('pixel-stitch-projects')

export function providePixelStitchProjects(projects: PixelStitchProjects) {
  provide(PROJECTS_KEY, projects)
}

export function usePixelStitchProjectsContext(): PixelStitchProjects {
  const projects = inject(PROJECTS_KEY, null)
  if (!projects) throw new Error('Pixel Stitch project tabs must be rendered inside the Pixel Stitch page')
  return projects
}
