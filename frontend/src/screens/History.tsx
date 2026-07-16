import { useEffect, useState } from 'react'
import { api } from '../api'
import type { DaySummary } from '../types'

export default function History() {
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.history().then((d) => {
      setDays(d)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="splash">…</div>

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Historique</h2>
      </header>
      {days.length === 0 && <p className="muted center">Pas encore d’historique.</p>}
      <div className="hist-list">
        {days.map((d) => {
          const ok = d.kcal_ok && d.protein_ok
          return (
            <div className="hist-row" key={d.date}>
              <div className="hist-date">{d.date}</div>
              <div className="hist-macros muted">
                {Math.round(d.kcal_total)}/{d.kcal_target} kcal · {Math.round(d.protein_total)}/{d.protein_target} g
              </div>
              <div className="hist-flag">{ok ? '✅' : '⚠️'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
