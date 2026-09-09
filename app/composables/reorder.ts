/**
 * Move one entry of `list` to a new index, returning a fresh array. Returns
 * `null` when `to` falls outside the list, so a caller can bail before writing
 * anything back — the keyboard grips emit an out-of-range index whenever
 * someone presses past either end.
 */
export function moveInArray<T>(list: T[], from: number, to: number): T[] | null {
  if (to < 0 || to >= list.length) return null
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return null
  next.splice(to, 0, moved)
  return next
}
