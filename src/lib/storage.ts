/**
 * Isolated browser-storage layer.
 *
 * Everything that touches `localStorage` funnels through here so the prototype
 * can be swapped for a PHP/MySQL REST API later without touching components.
 */

const PREFIX = 'pixelstudios.house.'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage may be unavailable (private mode) — ignore for the prototype */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* noop */
  }
}

export const storageKeys = {
  projects: 'projects',
  settings: 'settings',
  questionnaire: 'questionnaire-draft',
  aiChat: 'ai-chat',
} as const
