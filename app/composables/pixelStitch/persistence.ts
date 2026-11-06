import type { ProjectData, ProjectSummary, Workspace } from './types'
import { downloadBlob, pickFile } from '~/composables/files'

// Before projects existed the tool kept one drawing under this key. It is only
// read once more, by the migration, and removed after.
const LEGACY_PROJECT_KEY = 'pixel-stitch-project'
const INDEX_KEY = 'pixel-stitch-projects'
const WORKSPACE_KEY = 'pixel-stitch-workspace'
const PALETTE_KEY = 'pixel-stitch-palette'
const projectKey = (id: string) => `pixel-stitch-project:${id}`

// A project file is user-supplied JSON, so nothing may be trusted: a saved file
// from an older build, a hand-edited one, or an unrelated .json all land here.
function isProjectData(value: unknown): value is ProjectData {
  if (!value || typeof value !== 'object') return false
  const data = value as ProjectData
  return (
    data.version === 1
    && typeof data.canvasSize === 'number'
    && typeof data.fps === 'number'
    && typeof data.currentFrameIndex === 'number'
    && Array.isArray(data.frames)
    && data.frames.length > 0
  )
}

function isSummary(value: unknown): value is ProjectSummary {
  if (!value || typeof value !== 'object') return false
  const entry = value as ProjectSummary
  return typeof entry.id === 'string'
    && typeof entry.name === 'string'
    && typeof entry.canvasSize === 'number'
    && typeof entry.updatedAt === 'number'
}

function read(key: string): unknown {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Returns whether the write landed. Quota exceeded is the realistic failure:
// several 128×128 projects with a handful of frames add up to megabytes.
function write(key: string, value: unknown): boolean {
  if (!import.meta.client) return true
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadProject(id: string): ProjectData | null {
  const parsed = read(projectKey(id))
  return isProjectData(parsed) ? parsed : null
}

export function saveProject(id: string, data: ProjectData): boolean {
  return write(projectKey(id), data)
}

export function deleteProject(id: string) {
  if (import.meta.client) localStorage.removeItem(projectKey(id))
}

export function loadIndex(): ProjectSummary[] | null {
  const parsed = read(INDEX_KEY)
  return Array.isArray(parsed) ? parsed.filter(isSummary) : null
}

export function saveIndex(index: ProjectSummary[]): boolean {
  return write(INDEX_KEY, index)
}

export function loadWorkspace(): Workspace | null {
  const parsed = read(WORKSPACE_KEY) as Workspace | null
  if (!parsed || !Array.isArray(parsed.open)) return null
  return {
    open: parsed.open.filter(id => typeof id === 'string'),
    active: typeof parsed.active === 'string' ? parsed.active : null
  }
}

export function saveWorkspace(workspace: Workspace): boolean {
  return write(WORKSPACE_KEY, workspace)
}

/** The single drawing saved before projects existed, if there still is one. */
export function loadLegacyProject(): ProjectData | null {
  const parsed = read(LEGACY_PROJECT_KEY)
  return isProjectData(parsed) ? parsed : null
}

// Separate from the read: the old entry only goes once its drawing has been
// written as a project, so a failed write can't lose it.
export function clearLegacyProject() {
  if (import.meta.client) localStorage.removeItem(LEGACY_PROJECT_KEY)
}

// Saved as rows since the palette became rows that can grow; anything else
// (including the flat list an earlier build wrote) falls back to the default.
export function loadPalette(): string[][] | null {
  const parsed = read(PALETTE_KEY)
  const valid = Array.isArray(parsed)
    && parsed.every(row => Array.isArray(row) && row.every(entry => typeof entry === 'string'))
  return valid ? parsed as string[][] : null
}

export function savePalette(palette: string[][]) {
  write(PALETTE_KEY, palette)
}

// Characters Windows and macOS refuse in a file name. Everything else in the
// project's name — spaces, accents — is kept, so the file reads like the tab.
export function projectFileName(name: string) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, '-').trim()
  return `${safe || 'pixel-stitch-project'}.tps`
}

export function downloadProjectFile(data: ProjectData, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, projectFileName(name))
}

export async function openProjectFile(): Promise<{ data: ProjectData, name: string } | null> {
  const file = await pickFile('.tps,.json')
  if (!file) return null
  try {
    const parsed = JSON.parse(await file.text())
    if (!isProjectData(parsed)) return null
    return { data: parsed, name: file.name.replace(/\.(tps|json)$/i, '') }
  } catch {
    return null
  }
}
