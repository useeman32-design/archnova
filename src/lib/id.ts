/** Small, dependency-free id helper. Passing a `seed` makes output deterministic. */
const counters = new Map<string, number>()

export function uid(prefix = 'id', seed?: number): string {
  const next = (counters.get(prefix) ?? 0) + 1
  counters.set(prefix, next)
  const s =
    seed == null
      ? Math.random().toString(36).slice(2, 8)
      : ((seed + next * 2654435761) >>> 0).toString(36)
  return `${prefix}_${next.toString(36)}${s}`
}
