/** "12" reads better as "#12"; an empty title falls back to the position in the set. */
export function displayTitle(title: string, n: number): string {
  if (!title) return `Puzzle ${n}`
  return /^\d+$/.test(title) ? `#${title}` : title
}
