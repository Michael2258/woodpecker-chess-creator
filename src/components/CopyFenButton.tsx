import { useEffect, useState } from 'react'

/** Copies text to the clipboard, falling back to a hidden textarea. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/** A button that copies the FEN of the position shown on the board. */
export function CopyFenButton({ fen, className = 'secondary small' }: { fen: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 1500)
    return () => clearTimeout(t)
  }, [state])

  return (
    <button
      type="button"
      className={className}
      title={fen}
      onClick={async () => setState((await copyText(fen)) ? 'copied' : 'failed')}
    >
      {state === 'copied' ? '✓ FEN copied' : state === 'failed' ? 'Copy failed' : 'Copy FEN'}
    </button>
  )
}
