import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import type { FoodHit, Unit } from '../types'

// Écran d'ajout de RÉFÉRENCE : recherche OFF, code-barres (saisie), quantité + aperçu
// live, fallback manuel. Le scan caméra + le polish 2-3 taps viendront de Claude Design.
export default function AddFood() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodHit | null>(null)
  const [manual, setManual] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Recherche débouncée
  useEffect(() => {
    window.clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    timer.current = window.setTimeout(async () => {
      try {
        const r = await api.searchFood(q.trim())
        setResults(r.results)
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => window.clearTimeout(timer.current)
  }, [q])

  async function lookupBarcode(code: string) {
    try {
      const hit = await api.barcode(code)
      setSelected(hit)
    } catch (err) {
      alert(err instanceof ApiError && err.status === 404 ? 'Produit introuvable' : 'Erreur code-barres')
    }
  }

  if (manual) return <ManualForm onDone={() => nav('/')} onCancel={() => setManual(false)} />
  if (selected) return <QuantityForm hit={selected} onDone={() => nav('/')} onBack={() => setSelected(null)} />

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Ajouter</h2>
        <button className="link" onClick={() => nav('/')}>
          Fermer
        </button>
      </header>

      <input
        className="field"
        autoFocus
        placeholder="Rechercher un aliment…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="add-actions">
        <button className="btn-ghost" onClick={() => setManual(true)}>
          Saisie manuelle
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const code = prompt('Code-barres :')
            if (code) lookupBarcode(code.trim())
          }}
        >
          Code-barres
        </button>
      </div>

      {searching && <p className="muted">Recherche…</p>}
      <div className="results">
        {results.map((r) => (
          <button className="result-row" key={r.off_id} onClick={() => setSelected(r)}>
            <div className="result-main">
              <div className="entry-name">{r.name}</div>
              <div className="entry-sub muted">
                {r.brand ? `${r.brand} · ` : ''}
                {r.per_100g.kcal} kcal · {r.per_100g.protein_g} g /100g
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function QuantityForm({ hit, onDone, onBack }: { hit: FoodHit; onDone: () => void; onBack: () => void }) {
  const [qty, setQty] = useState<number>(hit.serving_size_g || 100)
  const [unit, setUnit] = useState<Unit>('g')
  const [busy, setBusy] = useState(false)
  const factor = qty / 100
  const kcal = Math.round(hit.per_100g.kcal * factor)
  const protein = Math.round(hit.per_100g.protein_g * factor * 10) / 10

  async function add() {
    setBusy(true)
    try {
      await api.createEntry({
        name: hit.name,
        quantity: qty,
        unit,
        off_id: hit.off_id,
        per_100g: hit.per_100g,
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="link" onClick={onBack}>
          ‹ Retour
        </button>
        <h2>Quantité</h2>
        <span />
      </header>
      <div className="entry-name big">{hit.name}</div>
      <div className="qty-row">
        <input
          className="field"
          type="number"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
        <select className="field" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
      </div>
      <div className="preview">
        <div>
          <strong>{kcal}</strong> kcal
        </div>
        <div>
          <strong>{protein}</strong> g protéines
        </div>
      </div>
      <button className="btn-primary" disabled={busy || qty <= 0} onClick={add}>
        Ajouter
      </button>
    </div>
  )
}

function ManualForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number>(0)
  const [protein, setProtein] = useState<number>(0)
  const [qty, setQty] = useState<number>(1)
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true)
    try {
      await api.createEntry({
        name: name.trim() || 'Aliment',
        quantity: qty,
        unit: 'portion',
        manual: { kcal, protein_g: protein },
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="link" onClick={onCancel}>
          ‹ Retour
        </button>
        <h2>Manuel</h2>
        <span />
      </header>
      <input className="field" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="lbl">kcal (par portion)</label>
      <input className="field" type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(Number(e.target.value))} />
      <label className="lbl">protéines g (par portion)</label>
      <input className="field" type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
      <label className="lbl">nombre de portions</label>
      <input className="field" type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      <button className="btn-primary" disabled={busy} onClick={add}>
        Ajouter
      </button>
    </div>
  )
}
