import { HomePage } from './pages/HomePage'
import { PuzzleEditorPage } from './pages/PuzzleEditorPage'
import { SetPage } from './pages/SetPage'
import { SolvePage } from './pages/SolvePage'
import { paths, useRoute } from './router'
import { syncLabel, useSyncState } from './sync/controller'

export default function App() {
  const route = useRoute()
  const sync = useSyncState()
  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href={paths.home()}>
          Woodpecker Chess Creator
        </a>
        <span className="tagline">Build puzzle sets and solve them in cycles.</span>
        {sync.configured && !sync.loading && (
          <a className={`sync-pill${sync.error ? ' bad' : ''}`} href={paths.home()}>
            {sync.email ? syncLabel(sync) : 'Sign in to sync'}
          </a>
        )}
      </header>
      <main>
        {route.name === 'home' && <HomePage />}
        {route.name === 'set' && <SetPage setId={route.setId} />}
        {route.name === 'solve' && <SolvePage setId={route.setId} />}
        {route.name === 'newPuzzle' && <PuzzleEditorPage setId={route.setId} />}
        {route.name === 'editPuzzle' && <PuzzleEditorPage setId={route.setId} puzzleId={route.puzzleId} />}
        {route.name === 'notFound' && (
          <section className="card">
            <h2>Page not found</h2>
            <a href={paths.home()}>Back to your sets</a>
          </section>
        )}
      </main>
    </div>
  )
}
