import { parsePuzzleInput } from './puzzle'

export interface ImportedPuzzle {
  title: string
  note: string
  fen: string
  solution: string[]
}

export interface SkippedSection {
  heading: string
  reason: string
}

export interface MarkdownImport {
  /** Text of the first "# " heading, or '' when there is none. */
  name: string
  puzzles: ImportedPuzzle[]
  skipped: SkippedSection[]
}

/**
 * Reads a Markdown file of puzzles. Each "## " section is one puzzle:
 *
 *     ## 1. Hamppe – Steinitz, Vienna 1860
 *     **Title:** 1. Hamppe – Steinitz, Vienna 1860
 *     **Note:** Black would have been lost without this resource.
 *     ```
 *     [FEN "..."]
 *     30. ... Rxh2+ 31. Kxh2 Rh8#
 *     ```
 *
 * The title falls back to the heading, the note is optional ("(none)" counts
 * as empty), and the fenced block holds a PGN with a [FEN] header. Sections
 * without a solution line, or whose moves are not legal, are skipped and
 * reported so the user can see why.
 */
export function parseMarkdownPuzzles(text: string): MarkdownImport {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const name = lines.find((l) => /^#\s+\S/.test(l))?.replace(/^#\s+/, '').trim() ?? ''

  const sections: { heading: string; body: string[] }[] = []
  let current: { heading: string; body: string[] } | null = null
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (!inFence && /^##\s+\S/.test(line)) {
      current = { heading: line.replace(/^##\s+/, '').trim(), body: [] }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    }
  }
  // A file with no "## " sections is read as a single puzzle.
  if (sections.length === 0) sections.push({ heading: name, body: lines })

  const puzzles: ImportedPuzzle[] = []
  const skipped: SkippedSection[] = []
  for (const { heading, body } of sections) {
    const block = fencedBlock(body)
    if (block === null) {
      skipped.push({ heading, reason: 'No FEN or PGN block.' })
      continue
    }
    const parsed = parsePuzzleInput(block)
    if (!parsed.ok) {
      skipped.push({ heading, reason: parsed.error })
      continue
    }
    if (parsed.puzzle.solution.length === 0) {
      skipped.push({ heading, reason: 'No solution moves, only a position.' })
      continue
    }
    puzzles.push({
      title: field(body, 'Title') ?? heading,
      note: field(body, 'Note') ?? '',
      fen: parsed.puzzle.fen,
      solution: parsed.puzzle.solution,
    })
  }
  return { name, puzzles, skipped }
}

/** Contents of the first ``` block in the section, or null. */
function fencedBlock(body: string[]): string | null {
  const start = body.findIndex((l) => /^\s*```/.test(l))
  if (start < 0) return null
  const end = body.findIndex((l, i) => i > start && /^\s*```/.test(l))
  return body.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

/**
 * Value of a "**Label:** value" line. The value runs on until a blank line,
 * another bold label, a heading or a code block.
 */
function field(body: string[], label: string): string | null {
  const re = new RegExp(`^\\s*\\*\\*${label}:?\\*\\*:?\\s*(.*)$`, 'i')
  const i = body.findIndex((l) => re.test(l))
  if (i < 0) return null
  const parts = [body[i].match(re)![1]]
  for (const l of body.slice(i + 1)) {
    if (!l.trim() || /^\s*(\*\*[^*]+\*\*|#|```)/.test(l)) break
    parts.push(l.trim())
  }
  const value = parts.join(' ').trim()
  return /^\(?none\)?$/i.test(value) ? '' : value
}
