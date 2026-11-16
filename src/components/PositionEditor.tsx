import { useState } from 'react'
import { Chessboard, defaultPieces } from 'react-chessboard'
import { PIECE_CODES, placementFromFen, START_FEN, type Placement } from '../chess/setup'

interface Props {
  placement: Placement
  onChange: (placement: Placement) => void
  turn: 'w' | 'b'
  onTurnChange: (turn: 'w' | 'b') => void
  onUndo: () => void
  canUndo: boolean
}

const PIECE_NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' }

/**
 * Free-form board for setting up a position: pick a piece and tap squares to
 * place it, tap with the eraser to clear, or drag pieces around (drag one off
 * the board to remove it).
 */
export function PositionEditor({ placement, onChange, turn, onTurnChange, onUndo, canUndo }: Props) {
  const [tool, setTool] = useState<string>('move')
  const [flipped, setFlipped] = useState(false)

  const position = Object.fromEntries(Object.entries(placement).map(([sq, code]) => [sq, { pieceType: code }]))

  function place(square: string) {
    if (tool === 'move') return
    const next = { ...placement }
    if (tool === 'erase' || next[square] === tool) delete next[square]
    else next[square] = tool
    onChange(next)
  }

  return (
    <div className="position-editor">
      <div className="palette" role="toolbar" aria-label="Pieces">
        <button
          className={`tool-btn ${tool === 'move' ? 'active' : ''}`}
          onClick={() => setTool('move')}
          aria-pressed={tool === 'move'}
          title="Drag pieces to move them"
        >
          ✥<span className="sr">Move pieces</span>
        </button>
        {PIECE_CODES.map((code) => (
          <button
            key={code}
            className={`piece-btn ${tool === code ? 'active' : ''}`}
            onClick={() => setTool(code)}
            aria-pressed={tool === code}
            aria-label={`${code[0] === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[code[1]]}`}
          >
            {defaultPieces[code]()}
          </button>
        ))}
        <button
          className={`tool-btn ${tool === 'erase' ? 'active' : ''}`}
          onClick={() => setTool('erase')}
          aria-pressed={tool === 'erase'}
          title="Tap a square to clear it"
        >
          ⌫<span className="sr">Eraser</span>
        </button>
      </div>

      <div className="board-wrap">
        <Chessboard
          options={{
            id: 'setup',
            position,
            boardOrientation: flipped ? 'black' : 'white',
            allowDragging: tool === 'move',
            allowDragOffBoard: true,
            onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
              const next = { ...placement }
              delete next[sourceSquare]
              if (targetSquare) next[targetSquare] = piece.pieceType
              onChange(next)
              return true
            },
            onSquareClick: ({ square }) => place(square),
            animationDurationInMs: 0,
          }}
        />
      </div>

      <div className="row wrap">
        <div className="segmented" role="radiogroup" aria-label="Side to move">
          <button role="radio" aria-checked={turn === 'w'} className={turn === 'w' ? 'active' : ''} onClick={() => onTurnChange('w')}>
            White to move
          </button>
          <button role="radio" aria-checked={turn === 'b'} className={turn === 'b' ? 'active' : ''} onClick={() => onTurnChange('b')}>
            Black to move
          </button>
        </div>
        <button className="secondary" onClick={onUndo} disabled={!canUndo}>
          ↶ Undo
        </button>
        <button className="secondary" onClick={() => onChange(placementFromFen(START_FEN))}>
          Start position
        </button>
        <button className="secondary" onClick={() => onChange({})}>
          Clear board
        </button>
        <button className="secondary" onClick={() => setFlipped((f) => !f)}>
          Flip
        </button>
      </div>
    </div>
  )
}
