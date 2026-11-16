import { Chess, validateFen } from 'chess.js'

/** Pieces on the board keyed by square, e.g. { e1: 'wK', e8: 'bK' }. */
export type Placement = Record<string, string>

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

const FILES = 'abcdefgh'

export function placementFromFen(fen: string): Placement {
  const placement: Placement = {}
  const rows = fen.split(' ')[0].split('/')
  rows.forEach((row, r) => {
    let file = 0
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch)
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b'
        placement[`${FILES[file]}${8 - r}`] = color + ch.toUpperCase()
        file++
      }
    }
  })
  return placement
}

function boardFen(placement: Placement): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const f of FILES) {
      const code = placement[`${f}${rank}`]
      if (!code) {
        empty++
        continue
      }
      if (empty) row += empty
      empty = 0
      row += code[0] === 'w' ? code[1] : code[1].toLowerCase()
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/')
}

/** Castling rights that the piece placement still allows (king and rook on home squares). */
function castlingRights(p: Placement): string {
  let rights = ''
  if (p.e1 === 'wK') {
    if (p.h1 === 'wR') rights += 'K'
    if (p.a1 === 'wR') rights += 'Q'
  }
  if (p.e8 === 'bK') {
    if (p.h8 === 'bR') rights += 'k'
    if (p.a8 === 'bR') rights += 'q'
  }
  return rights || '-'
}

export type SetupResult = { ok: true; fen: string } | { ok: false; error: string }

/** Builds a full FEN from a hand-made setup, and checks it is a playable position. */
export function fenFromSetup(placement: Placement, turn: 'w' | 'b'): SetupResult {
  const fen = `${boardFen(placement)} ${turn} ${castlingRights(placement)} - 0 1`
  const pieces = Object.values(placement)
  const count = (code: string) => pieces.filter((p) => p === code).length
  if (count('wK') !== 1 || count('bK') !== 1) {
    return { ok: false, error: 'Each side needs exactly one king.' }
  }
  for (const [square, code] of Object.entries(placement)) {
    if (code[1] === 'P' && (square[1] === '1' || square[1] === '8')) {
      return { ok: false, error: `A pawn can't stand on ${square}.` }
    }
  }
  const check = validateFen(fen)
  if (!check.ok) return { ok: false, error: check.error ?? 'Invalid position.' }
  // The side not to move must not be in check.
  const flipped = fen.replace(` ${turn} `, ` ${turn === 'w' ? 'b' : 'w'} `)
  if (new Chess(flipped, { skipValidation: true }).inCheck()) {
    return { ok: false, error: `${turn === 'w' ? 'Black' : 'White'} is in check but it's not their move.` }
  }
  return { ok: true, fen }
}
