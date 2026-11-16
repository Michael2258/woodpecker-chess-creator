import { Chess, type Square } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, defaultPieces } from 'react-chessboard'
import type { Color } from '../chess/puzzle'

export interface BoardMove {
  from: string
  to: string
  promotion?: string
}

interface Props {
  fen: string
  orientation: Color
  /** Called with a legal move. The parent decides what the next position is. */
  onMove: (move: BoardMove) => void
  /** Which side may be moved. Defaults to the side to move. */
  movable?: Color | 'none'
  /** Squares of the last move, highlighted. */
  lastMove?: { from: string; to: string } | null
  id?: string
}

const PROMOTIONS = ['q', 'r', 'b', 'n'] as const

/**
 * A board that plays legal moves by dragging or by tapping a piece and then
 * a square, which also works well on phones.
 */
export function PlayBoard({ fen, orientation, onMove, movable, lastMove, id = 'play' }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const turn = chess.turn()
  const canMove = movable === 'none' ? false : (movable ?? (turn === 'w' ? 'white' : 'black')) === (turn === 'w' ? 'white' : 'black')

  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null)
  const [promotion, setPromotion] = useState<{ fen: string; from: string; to: string } | null>(null)
  // Selections belong to a position; drop them when the position changes.
  const activeSelection = selected?.fen === fen ? selected.square : null
  const pendingPromotion = promotion?.fen === fen ? promotion : null

  const targets = useMemo(
    () =>
      activeSelection
        ? chess.moves({ square: activeSelection as Square, verbose: true }).map((m) => m.to as string)
        : [],
    [chess, activeSelection],
  )

  function tryMove(from: string, to: string): boolean {
    if (!canMove) return false
    const legal = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to)
    if (legal.length === 0) return false
    setSelected(null)
    if (legal.some((m) => m.promotion)) {
      setPromotion({ fen, from, to })
      return false
    }
    onMove({ from, to })
    return true
  }

  function ownPiece(square: string) {
    const piece = chess.get(square as Square)
    return !!piece && piece.color === turn
  }

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(255, 214, 0, 0.35)' }
    squareStyles[lastMove.to] = { background: 'rgba(255, 214, 0, 0.45)' }
  }
  if (activeSelection) squareStyles[activeSelection] = { background: 'rgba(47, 107, 79, 0.55)' }
  for (const t of targets) {
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: chess.get(t as Square)
        ? 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.3) 60%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)',
    }
  }

  const color = turn

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove,
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === turn,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare ? tryMove(sourceSquare, targetSquare) : false,
          onSquareClick: ({ square }) => {
            if (!canMove) return
            if (activeSelection && targets.includes(square)) {
              tryMove(activeSelection, square)
            } else if (ownPiece(square) && square !== activeSelection) {
              setSelected({ fen, square })
            } else {
              setSelected(null)
            }
          },
          squareStyles,
          animationDurationInMs: 150,
        }}
      />
      {pendingPromotion && (
        <div className="promotion" role="dialog" aria-label="Choose promotion piece">
          <span>Promote to</span>
          {PROMOTIONS.map((p) => {
            const code = `${color}${p.toUpperCase()}`
            return (
              <button
                key={p}
                className="piece-btn"
                aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[p]}
                onClick={() => {
                  setPromotion(null)
                  onMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: p })
                }}
              >
                {defaultPieces[code]()}
              </button>
            )
          })}
          <button className="secondary" onClick={() => setPromotion(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
