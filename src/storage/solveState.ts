/**
 * What the solve page is showing, kept in sessionStorage so that reloading the
 * page comes back to the same puzzle in the same state. sessionStorage lasts
 * for the browser tab: closing the tab starts fresh at the next unsolved
 * puzzle, as before.
 */

/** Which view the solve page is on, and the sitting in progress. */
export interface PageState {
  sessionId: string
  /** The cycle being solved, kept on screen after its last result is saved. */
  pinned: string | null
  /** Showing this cycle's summary. */
  summaryFor: string | null
  /** Showing the report for a session that was just ended. */
  sessionReport: { cycleId: string; sessionId: string } | null
}

/** The puzzle on the board and how far the solver got. */
export interface RunState {
  cycleId: string
  puzzleId: string
  startedAt: number
  status: 'solving' | 'solved' | 'missed'
  fen: string
  ply: number
  lastMove: { from: string; to: string } | null
  wrong: { played: string; expected: string } | null
  ownMove: string | null
  solutionPly: number | null
  timeMs: number
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function load<T>(key: string, store = storage()): T | null {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown, store = storage()) {
  try {
    store?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the page still works, it just won't survive a reload.
  }
}

const pageKey = (setId: string) => `woodpecker:solve:${setId}:page`
const runKey = (setId: string) => `woodpecker:solve:${setId}:run`

export function loadPageState(setId: string, store?: Storage | null): PageState | null {
  const s = load<PageState>(pageKey(setId), store)
  return s && typeof s.sessionId === 'string' ? s : null
}

export function savePageState(setId: string, state: PageState, store?: Storage | null) {
  save(pageKey(setId), state, store)
}

/** The saved run for this cycle, or null when it belongs to another cycle. */
export function loadRunState(setId: string, cycleId: string, store?: Storage | null): RunState | null {
  const s = load<RunState>(runKey(setId), store)
  return s && s.cycleId === cycleId && typeof s.puzzleId === 'string' ? s : null
}

export function saveRunState(setId: string, state: RunState, store?: Storage | null) {
  save(runKey(setId), state, store)
}
