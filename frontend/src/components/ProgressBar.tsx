import { useEffect, useRef } from 'react'
import type { Progress } from '../types'

// Barre gamifiée de RÉFÉRENCE (fonctionnelle) : dégradé rouge->vert révélé par le
// remplissage, transition animée, alerte "trop" (state=over), petit feedback à 100%.
// Le polish visuel final viendra du design Claude Design.
interface Props {
  label: string
  unitLabel: string // " kcal" | " g"
  progress: Progress
}

export default function ProgressBar({ label, unitLabel, progress }: Props) {
  const { total, target, pct, state } = progress
  const prevReached = useRef(false)
  const fillRef = useRef<HTMLDivElement>(null)

  const reached = pct >= 100
  const clamped = Math.min(100, Math.max(0, pct))
  const gradientSize = `${10000 / Math.max(clamped, 1)}% 100%`

  useEffect(() => {
    if (reached && !prevReached.current) {
      // feedback léger à l'atteinte de l'objectif
      navigator.vibrate?.(60)
      const el = fillRef.current
      if (el) {
        el.classList.remove('pop')
        void el.offsetWidth // reflow pour rejouer l'animation
        el.classList.add('pop')
      }
    }
    prevReached.current = reached
  }, [reached])

  return (
    <div className={`bar-block state-${state}`}>
      <div className="bar-head">
        <span className="bar-label">{label}</span>
        <span className="bar-value">
          {Math.round(total)}
          <span className="bar-target">
            /{target}
            {unitLabel}
          </span>
        </span>
      </div>
      <div className="bar-track">
        <div
          ref={fillRef}
          className="bar-fill"
          style={{ width: `${clamped}%`, backgroundSize: gradientSize }}
        />
      </div>
    </div>
  )
}
