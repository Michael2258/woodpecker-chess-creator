import { useSyncExternalStore } from 'react'

/**
 * Tiny hash router. Hash URLs work on any static host without server
 * rewrites, and survive a page refresh.
 */
export type Route =
  | { name: 'home' }
  | { name: 'set'; setId: string }
  | { name: 'newPuzzle'; setId: string }
  | { name: 'solve'; setId: string }
  | { name: 'editPuzzle'; setId: string; puzzleId: string }
  | { name: 'notFound' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length === 0) return { name: 'home' }
  if (parts[0] === 'sets' && parts[1]) {
    const setId = parts[1]
    if (parts.length === 2) return { name: 'set', setId }
    if (parts[2] === 'solve' && parts.length === 3) return { name: 'solve', setId }
    if (parts[2] === 'puzzles' && parts[3] === 'new' && parts.length === 4) return { name: 'newPuzzle', setId }
    if (parts[2] === 'puzzles' && parts[3] && parts.length === 4) {
      return { name: 'editPuzzle', setId, puzzleId: parts[3] }
    }
  }
  return { name: 'notFound' }
}

export const paths = {
  home: () => '#/',
  set: (setId: string) => `#/sets/${encodeURIComponent(setId)}`,
  solve: (setId: string) => `#/sets/${encodeURIComponent(setId)}/solve`,
  newPuzzle: (setId: string) => `#/sets/${encodeURIComponent(setId)}/puzzles/new`,
  editPuzzle: (setId: string, puzzleId: string) =>
    `#/sets/${encodeURIComponent(setId)}/puzzles/${encodeURIComponent(puzzleId)}`,
}

export function navigate(hash: string) {
  window.location.hash = hash
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
