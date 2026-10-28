import { useCallback, useEffect, useState } from 'react'
import { loadJSON, saveJSON } from '@/lib/storage'

export function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial
    const stored = loadJSON<T | null>(key, null)
    return stored ?? fallback
  })

  useEffect(() => {
    saveJSON(key, value)
  }, [key, value])

  const reset = useCallback(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial
    setValue(fallback)
  }, [initial])

  return [value, setValue, reset] as const
}
