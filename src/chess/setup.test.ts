import { describe, expect, it } from 'vitest'
import { fenFromSetup, placementFromFen, START_FEN } from './setup'

describe('board setup', () => {
  it('round-trips the start position', () => {
    const r = fenFromSetup(placementFromFen(START_FEN), 'w')
    expect(r).toEqual({ ok: true, fen: START_FEN })
  })

  it('drops castling rights when king or rook has left home', () => {
    const p = placementFromFen(START_FEN)
    delete p.h1
    delete p.a8
    const r = fenFromSetup(p, 'b')
    expect(r.ok && r.fen.split(' ').slice(1, 3)).toEqual(['b', 'Qk'])
  })

  it('requires one king each', () => {
    expect(fenFromSetup({ e1: 'wK' }, 'w')).toMatchObject({ ok: false })
    expect(fenFromSetup({ e1: 'wK', e8: 'bK', d8: 'bK' }, 'w')).toMatchObject({ ok: false })
  })

  it('rejects pawns on the back ranks', () => {
    expect(fenFromSetup({ e1: 'wK', e8: 'bK', a8: 'wP' }, 'w')).toMatchObject({ ok: false })
  })

  it('rejects the side not to move being in check', () => {
    // White rook gives check to the black king, but it is white to move.
    expect(fenFromSetup({ e1: 'wK', e8: 'bK', e4: 'wR' }, 'w')).toMatchObject({ ok: false })
    expect(fenFromSetup({ e1: 'wK', e8: 'bK', e4: 'wR' }, 'b')).toMatchObject({ ok: true })
  })
})
