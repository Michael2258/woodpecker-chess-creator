/**
 * Core data model for Woodpecker training.
 *
 * A set holds an ordered list of puzzles. Training happens in cycles: each
 * cycle goes through every puzzle in the set once and records how long each
 * one took and whether it was solved. The Woodpecker Method repeats cycles
 * on the same set, aiming to finish each one faster than the last.
 */

export type Id = string

export interface PuzzleSet {
  id: Id
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface Puzzle {
  id: Id
  setId: Id
  /** Position of the puzzle inside its set, starting at 0. */
  order: number
  /** Optional label, such as the puzzle number from the book. */
  title: string
  /** Starting position. The side to move is the side the solver plays. */
  fen: string
  /**
   * Full solution line in SAN, starting with the solver's first move and
   * alternating with the opponent's replies.
   */
  solution: string[]
  /** Free-form note the user keeps about this puzzle. */
  note: string
  createdAt: number
  updatedAt: number
}

export interface Attempt {
  puzzleId: Id
  solved: boolean
  /** Time spent on the puzzle in milliseconds. */
  timeMs: number
  attemptedAt: number
}

export interface Cycle {
  id: Id
  setId: Id
  /** 1 for the first cycle on a set, 2 for the second, and so on. */
  number: number
  startedAt: number
  /** Set once every puzzle in the set has an attempt. */
  completedAt: number | null
  attempts: Attempt[]
}

export interface CycleSummary {
  cycleNumber: number
  attempted: number
  solved: number
  /** Solved divided by attempted, from 0 to 1. 0 when nothing was attempted. */
  accuracy: number
  totalTimeMs: number
}
