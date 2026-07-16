import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { Settings } from '../types'

const NUM_FIELDS: { key: keyof Settings; label: string; step?: number }[] = [
  { key: 'weight_kg', label: 'Poids (kg)', step: 0.1 },
  { key: 'height_cm', label: 'Taille (cm)' },
  { key: 'age', label: 'Âge' },
  { key: 'activity_factor', label: 'Facteur d’activité', step: 0.05 },
  { key: 'protein_coef_g_per_kg', label: 'Coef. protéines (g/kg)', step: 0.1 },
  { key: 'surplus_pct', label: 'Surplus (%)' },
]

export default function SettingsScreen() {
  const { logout } = useAuth()
  const [s, setS] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(setS)
  }, [])

  if (!s) return <div className="splash">…</div>

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  async function save() {
    const updated = await api.putSettings({
      name: s!.name,
      weight_kg: s!.weight_kg,
      height_cm: s!.height_cm,
      age: s!.age,
      sex: s!.sex,
      activity_factor: s!.activity_factor,
      protein_coef_g_per_kg: s!.protein_coef_g_per_kg,
      surplus_pct: s!.surplus_pct,
    })
    setS(updated)
    setSaved(true)
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Réglages</h2>
      </header>

      <div className="targets-recap">
        <div>
          Objectif kcal : <strong>{s.target_kcal_final}</strong>
          <span className="muted"> (TDEE est. {s.target_kcal_base})</span>
        </div>
        <div>
          Objectif protéines : <strong>{s.target_protein_g} g</strong>
        </div>
      </div>

      <label className="lbl">Nom</label>
      <input className="field" value={s.name} onChange={(e) => update('name', e.target.value)} />

      <label className="lbl">Sexe</label>
      <select className="field" value={s.sex} onChange={(e) => update('sex', e.target.value as 'm' | 'f')}>
        <option value="m">Homme</option>
        <option value="f">Femme</option>
      </select>

      {NUM_FIELDS.map((f) => (
        <div key={f.key}>
          <label className="lbl">{f.label}</label>
          <input
            className="field"
            type="number"
            step={f.step || 1}
            value={s[f.key] as number}
            onChange={(e) => update(f.key, Number(e.target.value) as never)}
          />
        </div>
      ))}

      <button className="btn-primary" onClick={save}>
        {saved ? 'Enregistré ✓' : 'Enregistrer'}
      </button>

      <div className="fitbit-block">
        <div className="fitbit-head">
          <span>Fitbit</span>
          <span className="badge">bientôt</span>
        </div>
        <p className="muted">
          Synchronisera ton TDEE réel pour ajuster l’objectif kcal automatiquement.
        </p>
        <button className="btn-ghost" disabled>
          Connecter Fitbit
        </button>
      </div>

      <button className="btn-logout" onClick={logout}>
        Se déconnecter
      </button>
    </div>
  )
}
