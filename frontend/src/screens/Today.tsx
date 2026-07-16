import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Entry, Summary } from '../types'
import ProgressBar from '../components/ProgressBar'

export default function Today() {
  const nav = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([api.summaryToday(), api.listEntries()])
    setSummary(s)
    setEntries(e.entries)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function remove(id: number) {
    await api.deleteEntry(id)
    load()
  }

  if (loading || !summary) return <div className="splash">…</div>

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Aujourd’hui</h2>
        <span className="muted">{summary.entries_count} entrée(s)</span>
      </header>

      <section className="bars">
        <ProgressBar label="Calories" unitLabel=" kcal" progress={summary.kcal} />
        <ProgressBar label="Protéines" unitLabel=" g" progress={summary.protein} />
      </section>

      <section className="entries">
        {entries.length === 0 && <p className="muted center">Rien de logué. Tape sur + pour commencer.</p>}
        {entries.map((e) => (
          <div className="entry-row" key={e.id}>
            <div className="entry-main">
              <div className="entry-name">{e.name}</div>
              <div className="entry-sub muted">
                {e.quantity}
                {e.unit === 'portion' ? ' portion' : e.unit} · {Math.round(e.kcal)} kcal · {e.protein_g} g
              </div>
            </div>
            <button className="entry-del" onClick={() => remove(e.id)} aria-label="Supprimer">
              ✕
            </button>
          </div>
        ))}
      </section>

      <button className="fab" onClick={() => nav('/add')} aria-label="Ajouter un aliment">
        +
      </button>
    </div>
  )
}
