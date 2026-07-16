import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { api, ApiError } from './api'
import { useAuth } from './auth'
import { css } from './css'
import BarcodeScanner from './BarcodeScanner'
import type { DaySummary, Entry, FoodHit, Settings } from './types'

// ---------- helpers ----------
const num = (e: ChangeEvent<HTMLInputElement>) => {
  const v = parseFloat(e.target.value)
  return isNaN(v) ? 0 : v
}
const calcGoals = (s: Settings) => {
  const bmr = 10 * s.weight_kg + 6.25 * s.height_cm - 5 * s.age + (s.sex === 'm' ? 5 : -161)
  const tdee = bmr * s.activity_factor
  return { kcal: Math.round(tdee * (1 + s.surplus_pct / 100)), prot: Math.round(s.weight_kg * s.protein_coef_g_per_kg) }
}
const parisTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const noon = (d: string) => new Date(d + 'T12:00:00')
const dayLabel = (d: string) => {
  const diff = Math.round((noon(new Date().toISOString().slice(0, 10)).getTime() - noon(d).getTime()) / 86400000)
  if (diff === 0) return 'AUJ.'
  if (diff === 1) return 'HIER'
  return noon(d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase() + '.'
}
const dayDate = (d: string) => noon(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
const qtyLabel = (e: Entry) => `${Number(e.quantity)} ${e.unit === 'portion' ? 'portion' : e.unit}`

type Screen = 'today' | 'history' | 'settings' | 'add'
type Stage = 'search' | 'scan' | 'detail' | 'manual'
interface Sel { name: string; brand?: string | null; kcal: number; prot: number; off_id?: string | null }
interface AddState {
  stage: Stage; query: string; sel: Sel | null; qty: number; editingId: number | null
  manName: string; manKcal: string; manProt: string; manQty: string
}
type Piece = { id: number; style: CSSProperties }

const GRAD = 'linear-gradient(90deg,#FF2D2D 0%,#FF6A00 20%,#FFC400 42%,#C6FF00 60%,#C6FF00 82%,#FF3B1E 91%,#C00000 100%)'
const emptyAdd: AddState = { stage: 'search', query: '', sel: null, qty: 100, editingId: null, manName: '', manKcal: '', manProt: '', manQty: '' }

export default function Home() {
  const { logout } = useAuth()
  const [screen, setScreen] = useState<Screen>('today')
  const [entries, setEntries] = useState<Entry[]>([])
  const [history, setHistory] = useState<DaySummary[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [mounted, setMounted] = useState(false)
  const [celebrate, setCelebrate] = useState<{ which: 'kcal' | 'prot'; key: number } | null>(null)
  const [confetti, setConfetti] = useState<Piece[]>([])
  const [add, setAdd] = useState<AddState>(emptyAdd)
  const [results, setResults] = useState<FoodHit[]>([])
  const [scanMsg, setScanMsg] = useState('')
  const celTO = useRef<number | undefined>(undefined)
  const hydrated = useRef(false)

  // ---- chargement initial ----
  useEffect(() => {
    ;(async () => {
      const [s, e, h] = await Promise.all([api.getSettings(), api.listEntries(), api.history()])
      setSettings(s)
      setEntries(e.entries)
      setHistory(h)
      requestAnimationFrame(() => setMounted(true))
    })().catch(() => {})
  }, [])

  const reload = async () => {
    const [e, h] = await Promise.all([api.listEntries(), api.history()])
    setEntries(e.entries)
    setHistory(h)
  }

  // ---- recherche OpenFoodFacts (débouncée) ----
  useEffect(() => {
    if (screen !== 'add' || add.stage !== 'search') return
    const q = add.query.trim()
    if (q.length < 2) { setResults([]); return }
    const t = window.setTimeout(async () => {
      try { setResults((await api.searchFood(q)).results) } catch { setResults([]) }
    }, 300)
    return () => window.clearTimeout(t)
  }, [add.query, add.stage, screen])

  // ---- persistance réglages (débouncée ; on saute l'hydratation initiale) ----
  useEffect(() => {
    if (!settings) return
    if (!hydrated.current) { hydrated.current = true; return }
    const s = settings
    const t = window.setTimeout(() => {
      api.putSettings({
        name: s.name, weight_kg: s.weight_kg, height_cm: s.height_cm, age: s.age, sex: s.sex,
        activity_factor: s.activity_factor, protein_coef_g_per_kg: s.protein_coef_g_per_kg, surplus_pct: s.surplus_pct,
        target_protein_override: s.target_protein_override, target_kcal_override: s.target_kcal_override,
      }).catch(() => {})
    }, 500)
    return () => window.clearTimeout(t)
  }, [settings])

  if (!settings) {
    return <div style={css('min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#E4E4E0;font-family:Space Mono,monospace;letter-spacing:.35em;font-weight:700')}>BULK</div>
  }

  // ---- dérivés ----
  const computed = calcGoals(settings)
  const auto = settings.target_kcal_override == null && settings.target_protein_override == null
  const goalKcal = settings.target_kcal_override ?? computed.kcal
  const goalProt = settings.target_protein_override ?? computed.prot
  const totK = entries.reduce((a, e) => a + e.kcal, 0)
  const totP = entries.reduce((a, e) => a + e.protein_g, 0)

  const TRACK = 336, T2 = 284
  const fw = (pct: number, w: number) => (mounted ? Math.max(pct > 0 ? 7 : 0, Math.min(pct / 1.3, 1) * w) : 0)

  const bars = [
    mkBar('kcal', 'CALORIES', totK, goalKcal, 'KCAL'),
    mkBar('prot', 'PROTÉINES', totP, goalProt, 'G'),
  ]
  function mkBar(key: 'kcal' | 'prot', label: string, cur: number, goal: number, unit: string) {
    const pct = goal > 0 ? cur / goal : 0
    return {
      key, label, unit, cur: Math.round(cur), goal, pctText: Math.round(pct * 100) + '%', fillW: fw(pct, TRACK),
      over: pct >= 1.1, done: pct >= 1 && pct < 1.1, going: pct < 1,
      celebrating: !!(celebrate && celebrate.which === key),
    }
  }

  const entryRows = entries.slice().reverse()
  const headerMeta = screen === 'today'
    ? new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()
    : screen === 'history' ? 'BILAN' : 'PROFIL'

  // ---- actions ----
  function celebrateFx(which: 'kcal' | 'prot') {
    const cols = ['#C6FF00', '#0A0A0A', '#FF3B1E', '#FFC400']
    const pieces: Piece[] = Array.from({ length: 36 }, (_, i) => {
      const tx = (Math.random() * 2 - 1) * 170, ty = 140 + Math.random() * 420, rot = (Math.random() * 2 - 1) * 760
      return {
        id: i,
        style: {
          position: 'absolute', left: 4 + Math.random() * 90 + '%', top: 120 + Math.random() * 60 + 'px',
          width: 6 + Math.random() * 8 + 'px', height: 11 + Math.random() * 10 + 'px', background: cols[i % 4], borderRadius: '1px',
          ['--tx' as string]: tx + 'px', ['--ty' as string]: ty + 'px', ['--rot' as string]: rot + 'deg',
          animation: 'confetti 1.25s ease-out forwards', animationDelay: Math.random() * 140 + 'ms',
        } as CSSProperties,
      }
    })
    setCelebrate({ which, key: Date.now() })
    setConfetti(pieces)
    window.clearTimeout(celTO.current)
    celTO.current = window.setTimeout(() => { setCelebrate(null); setConfetti([]) }, 1350)
  }
  function maybeCelebrate(oldK: number, oldP: number, newK: number, newP: number) {
    if (goalProt > 0 && oldP / goalProt < 1 && newP / goalProt >= 1) celebrateFx('prot')
    else if (goalKcal > 0 && oldK / goalKcal < 1 && newK / goalKcal >= 1) celebrateFx('kcal')
  }

  const openAdd = () => { setAdd(emptyAdd); setResults([]); setScanMsg(''); setScreen('add') }
  const addBack = () => {
    if (add.stage === 'detail' || add.stage === 'manual' || add.stage === 'scan') setAdd((a) => ({ ...a, stage: 'search', sel: null, editingId: null }))
    else setScreen('today')
  }
  const selectFood = (h: FoodHit) =>
    setAdd((a) => ({ ...a, stage: 'detail', sel: { name: h.name, brand: h.brand, kcal: h.per_100g.kcal, prot: h.per_100g.protein_g, off_id: h.off_id }, qty: Math.round(h.serving_size_g || 100) }))
  const startScan = () => { setScanMsg(''); setAdd((a) => ({ ...a, stage: 'scan' })) }
  async function onScanDetected(code: string) {
    try {
      const h = await api.barcode(code)
      setAdd((a) => ({ ...a, stage: 'detail', sel: { name: h.name, brand: h.brand, kcal: h.per_100g.kcal, prot: h.per_100g.protein_g, off_id: h.off_id }, qty: Math.round(h.serving_size_g || 100) }))
    } catch (e) {
      setScanMsg(e instanceof ApiError && e.status === 404 ? 'Produit introuvable — essaie la recherche' : 'Erreur de lecture')
    }
  }
  const manualCode = () => {
    const c = window.prompt('Code-barres :')
    if (c) onScanDetected(c.trim())
  }
  const openManual = () => setAdd((a) => ({ ...a, stage: 'manual', editingId: null, manName: '', manKcal: '', manProt: '', manQty: '' }))
  const qtyStep = (d: number) => setAdd((a) => ({ ...a, qty: Math.max(0, Math.round(a.qty + d)) }))

  async function confirmAdd() {
    const { sel, qty } = add
    if (!sel) return
    const oldK = totK, oldP = totP
    const created = await api.createEntry({ name: sel.name, quantity: qty, unit: 'g', off_id: sel.off_id || undefined, per_100g: { kcal: sel.kcal, protein_g: sel.prot } })
    setScreen('today')
    await reload()
    maybeCelebrate(oldK, oldP, oldK + created.kcal, oldP + created.protein_g)
  }
  async function confirmManual() {
    const kcal = Math.round(parseFloat(add.manKcal) || 0)
    const prot = Math.round(parseFloat(add.manProt) || 0)
    if (!add.manName || (!kcal && !prot)) return
    const oldK = totK, oldP = totP, editing = add.editingId
    if (editing != null) await api.deleteEntry(editing)
    const created = await api.createEntry({ name: add.manName, quantity: 1, unit: 'portion', manual: { kcal, protein_g: prot } })
    setScreen('today')
    await reload()
    if (editing == null) maybeCelebrate(oldK, oldP, oldK + created.kcal, oldP + created.protein_g)
  }
  const deleteEntry = async (id: number) => { await api.deleteEntry(id); await reload() }
  const editEntry = (e: Entry) => {
    setAdd({ ...emptyAdd, stage: 'manual', editingId: e.id, manName: e.name, manKcal: String(Math.round(e.kcal)), manProt: String(Math.round(e.protein_g)), manQty: qtyLabel(e) })
    setScreen('add')
  }

  // réglages
  const setMeas = (field: keyof Settings, value: number) => setSettings((s) => (s ? ({ ...s, [field]: value } as Settings) : s))
  const setSex = (x: 'm' | 'f') => setSettings((s) => (s ? { ...s, sex: x } : s))
  const setGoalKcal = (e: ChangeEvent<HTMLInputElement>) => setSettings((s) => (s ? { ...s, target_kcal_override: num(e), target_protein_override: s.target_protein_override ?? goalProt } : s))
  const setGoalProt = (e: ChangeEvent<HTMLInputElement>) => setSettings((s) => (s ? { ...s, target_protein_override: num(e), target_kcal_override: s.target_kcal_override ?? goalKcal } : s))
  const toggleAuto = () => setSettings((s) => {
    if (!s) return s
    if (auto) return { ...s, target_kcal_override: goalKcal, target_protein_override: goalProt } // fige -> manuel
    return { ...s, target_kcal_override: null, target_protein_override: null } // -> auto
  })

  const measRows: { label: string; field: keyof Settings; unit: string }[] = [
    { label: 'Poids', field: 'weight_kg', unit: 'kg' },
    { label: 'Taille', field: 'height_cm', unit: 'cm' },
    { label: 'Âge', field: 'age', unit: 'ans' },
    { label: 'Coeff. protéines', field: 'protein_coef_g_per_kg', unit: 'g/kg' },
    { label: 'Surplus calorique', field: 'surplus_pct', unit: '%' },
  ]
  const ACTS: [string, string][] = [['1.2', 'Sédentaire · 1.2'], ['1.375', 'Léger · 1.375'], ['1.45', 'Modéré · 1.45'], ['1.6', 'Actif · 1.6'], ['1.725', 'Intense · 1.725']]
  const actVal = String(settings.activity_factor)
  const actOptions: [string, string][] = ACTS.some(([v]) => v === actVal) ? ACTS : [[actVal, `Perso · ${actVal}`], ...ACTS]

  const tabs: { key: Screen; label: string }[] = [
    { key: 'today', label: "AUJOURD'HUI" }, { key: 'history', label: 'HISTORIQUE' }, { key: 'settings', label: 'RÉGLAGES' },
  ]
  const pKcal = add.sel ? Math.round(add.sel.kcal * add.qty / 100) : 0
  const pProt = add.sel ? Math.round(add.sel.prot * add.qty / 100) : 0
  const addTitle = add.editingId ? 'MODIFIER' : add.stage === 'detail' ? 'QUANTITÉ' : add.stage === 'manual' ? 'SAISIE MANUELLE' : add.stage === 'scan' ? 'SCAN' : 'AJOUTER'
  const confirmLabel = add.editingId ? 'ENREGISTRER ✓' : 'AJOUTER À MA JOURNÉE'

  return (
    <div className="stage">
      <div className="phone">
        {/* HEADER */}
        <div style={css('height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:3px solid #0A0A0A;background:#fff;z-index:20')}>
          <div style={css('display:flex;align-items:center;gap:8px')}>
            <div style={css('width:15px;height:15px;background:#C6FF00;border:2px solid #0A0A0A')} />
            <span style={css('font-family:Anton;font-size:26px;letter-spacing:.5px;line-height:1')}>BULK</span>
          </div>
          <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#0A0A0A`)}>{headerMeta}</span>
        </div>

        {/* SCROLL */}
        <div className="scr" style={css('flex:1;overflow-y:auto;overflow-x:hidden;position:relative')}>
          {/* ---- AUJOURD'HUI ---- */}
          {screen === 'today' && (
            <>
              <div style={css('padding:18px 16px 12px')}>
                <div style={css('display:flex;align-items:center;gap:7px;margin-bottom:14px')}>
                  <div style={css('width:9px;height:9px;background:#0A0A0A')} />
                  <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#0A0A0A`)}>TABLEAU DE BORD · JOUR</span>
                </div>
                <div style={{ animation: celebrate ? 'shake .5s ease' : 'none' }}>
                  {bars.map((bar) => (
                    <div style={css('margin-bottom:20px')} key={bar.key}>
                      <div style={css('display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:7px')}>
                        <div style={css('display:flex;align-items:baseline')}>
                          <span style={css('font-family:Anton;font-size:56px;line-height:.78;letter-spacing:-1px;color:#0A0A0A')}>{bar.cur}</span>
                          <span style={css('font-family:Anton;font-size:23px;line-height:1;color:#9A9A94;margin-left:5px')}>/{bar.goal}</span>
                          <span style={css(`font-family:'Space Mono',monospace;font-weight:700;font-size:12px;letter-spacing:1px;color:#0A0A0A;margin-left:7px`)}>{bar.unit}</span>
                        </div>
                        {bar.over && <div style={css(`background:#E10600;color:#fff;font-family:'Space Mono',monospace;font-weight:700;font-size:10px;letter-spacing:1px;padding:5px 9px;border:2px solid #0A0A0A`)}>DÉPASSÉ !</div>}
                        {bar.done && <div style={css(`background:#C6FF00;color:#0A0A0A;font-family:'Space Mono',monospace;font-weight:700;font-size:10px;letter-spacing:1px;padding:5px 9px;border:2px solid #0A0A0A`)}>ATTEINT ✓</div>}
                        {bar.going && <div style={css(`background:transparent;color:#8A8A85;font-family:'Space Mono',monospace;font-weight:700;font-size:10px;letter-spacing:1px;padding:5px 9px;border:2px solid #D8D8D3`)}>EN COURS</div>}
                      </div>
                      <div style={css('position:relative;height:56px;border:3px solid #0A0A0A;background:#fff;overflow:hidden;border-radius:2px')}>
                        <div style={{ ...css('position:absolute;top:0;left:0;bottom:0;overflow:hidden'), width: bar.fillW + 'px', transition: 'width .95s cubic-bezier(.34,1.5,.5,1)' }}>
                          <div style={{ ...css('position:absolute;top:0;left:0;height:100%;width:336px'), background: GRAD }} />
                        </div>
                        <div style={css('position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 32px,rgba(0,0,0,.09) 32px 33px)')} />
                        <div style={css('position:absolute;top:-1px;bottom:-1px;left:258px;width:2px;background:#0A0A0A')} />
                        <div style={css('position:absolute;top:4px;left:249px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #0A0A0A')} />
                        {bar.celebrating && <div style={css('position:absolute;inset:0;background:#C6FF00;mix-blend-mode:multiply;animation:flash .7s ease;pointer-events:none')} />}
                      </div>
                      <div style={css('display:flex;justify-content:space-between;margin-top:6px')}>
                        <span style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#0A0A0A`)}>{bar.label}</span>
                        <span style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1px;color:#8A8A85`)}>{bar.pctText} · OBJ {bar.goal}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={css('height:3px;background:#0A0A0A;margin:2px 0 0')} />
              <div style={css('display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px')}>
                <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#0A0A0A`)}>REPAS DU JOUR</span>
                <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:#8A8A85`)}>{entries.length} ENTRÉES</span>
              </div>

              <div style={css('padding:0 16px 120px')}>
                {entryRows.map((e) => (
                  <div key={e.id} style={css('display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #E7E7E2')}>
                    <div style={css('flex:1;min-width:0')}>
                      <div style={css('font-weight:700;font-size:15px;color:#0A0A0A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{e.name}</div>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:11px;color:#9A9A94;margin-top:2px;letter-spacing:.5px`)}>{qtyLabel(e)} · {parisTime(e.logged_at)}</div>
                    </div>
                    <div style={css('text-align:right;flex:none')}>
                      <div style={css('font-family:Anton;font-size:19px;line-height:.9;color:#0A0A0A')}>{Math.round(e.kcal)}<span style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;color:#9A9A94;margin-left:2px`)}>KCAL</span></div>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#0A0A0A;margin-top:1px`)}>P {Math.round(e.protein_g)}g</div>
                    </div>
                    <button onClick={() => editEntry(e)} className="hov-lime" style={css('flex:none;width:30px;height:30px;border:2px solid #0A0A0A;background:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center')}>✎</button>
                    <button onClick={() => deleteEntry(e.id)} className="hov-red" style={css('flex:none;width:30px;height:30px;border:2px solid #0A0A0A;background:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1')}>✕</button>
                  </div>
                ))}
                {entries.length === 0 && <div style={css(`text-align:center;padding:40px 0;font-family:'Space Mono',monospace;font-size:12px;color:#B5B5B0;letter-spacing:1px`)}>AUCUNE ENTRÉE — APPUIE SUR +</div>}
              </div>
            </>
          )}

          {/* ---- HISTORIQUE ---- */}
          {screen === 'history' && (
            <div style={css('padding:18px 16px 120px')}>
              <div style={css('display:flex;align-items:center;gap:7px;margin-bottom:16px')}>
                <div style={css('width:9px;height:9px;background:#0A0A0A')} />
                <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#0A0A0A`)}>DERNIERS JOURS</span>
              </div>
              {history.length === 0 && <div style={css(`text-align:center;padding:40px 0;font-family:'Space Mono',monospace;font-size:12px;color:#B5B5B0;letter-spacing:1px`)}>PAS ENCORE D'HISTORIQUE</div>}
              {history.map((d) => {
                const kp = d.kcal_target > 0 ? d.kcal_total / d.kcal_target : 0
                const pp = d.protein_target > 0 ? d.protein_total / d.protein_target : 0
                const ok = d.kcal_ok && d.protein_ok
                return (
                  <div key={d.date} style={css('border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:13px 14px;margin-bottom:12px;box-shadow:4px 4px 0 rgba(10,10,10,.10)')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:12px')}>
                      <div>
                        <div style={css('font-family:Anton;font-size:22px;line-height:.9;color:#0A0A0A')}>{dayLabel(d.date)}</div>
                        <div style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#9A9A94;letter-spacing:1px;margin-top:2px`)}>{dayDate(d.date)}</div>
                      </div>
                      {ok
                        ? <div style={css('width:38px;height:38px;background:#C6FF00;border:3px solid #0A0A0A;display:flex;align-items:center;justify-content:center;font-family:Anton;font-size:22px;color:#0A0A0A')}>✓</div>
                        : <div style={css('width:38px;height:38px;background:#FF3B1E;border:3px solid #0A0A0A;display:flex;align-items:center;justify-content:center;font-family:Anton;font-size:22px;color:#fff')}>!</div>}
                    </div>
                    {([['CAL', `${Math.round(d.kcal_total)} / ${d.kcal_target}`, kp], ['PROT', `${Math.round(d.protein_total)} / ${d.protein_target} g`, pp]] as [string, string, number][]).map(([lab, txt, p]) => (
                      <div key={lab} style={css('margin-bottom:9px')}>
                        <div style={css('display:flex;justify-content:space-between;margin-bottom:3px')}>
                          <span style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;color:#0A0A0A`)}>{lab}</span>
                          <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#0A0A0A`)}>{txt}</span>
                        </div>
                        <div style={css('position:relative;height:15px;border:2px solid #0A0A0A;background:#fff;overflow:hidden;border-radius:1px')}>
                          <div style={{ ...css('position:absolute;top:0;left:0;bottom:0;overflow:hidden'), width: fw(p, T2) + 'px', transition: 'width .9s cubic-bezier(.34,1.5,.5,1)' }}>
                            <div style={{ ...css('position:absolute;top:0;left:0;height:100%;width:284px'), background: GRAD }} />
                          </div>
                          <div style={css('position:absolute;top:0;bottom:0;left:218px;width:2px;background:#0A0A0A')} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* ---- RÉGLAGES ---- */}
          {screen === 'settings' && (
            <div style={css('padding:18px 16px 120px')}>
              <div style={css('display:flex;align-items:center;gap:7px;margin-bottom:16px')}>
                <div style={css('width:9px;height:9px;background:#0A0A0A')} />
                <span style={css(`font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:2px;color:#0A0A0A`)}>PROFIL & OBJECTIFS</span>
              </div>

              <div style={css('border:3px solid #0A0A0A;background:#0A0A0A;border-radius:2px;padding:15px;margin-bottom:20px')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:12px')}>
                  <span style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#C6FF00`)}>OBJECTIFS DU JOUR</span>
                  <button onClick={toggleAuto} style={{ ...css(`font-family:'Space Mono',monospace;font-weight:700;font-size:10px;letter-spacing:1px;padding:5px 9px;cursor:pointer`), background: auto ? '#C6FF00' : 'transparent', color: auto ? '#0A0A0A' : '#8A8A85', border: '2px solid ' + (auto ? '#C6FF00' : '#444') }}>{auto ? '● AUTO' : '○ MANUEL'}</button>
                </div>
                <div style={css('display:flex;gap:12px')}>
                  <div style={css('flex:1')}>
                    <div style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;color:#8A8A85;margin-bottom:4px`)}>CALORIES</div>
                    <div style={css('display:flex;align-items:baseline;gap:4px')}>
                      <input type="number" value={goalKcal} onChange={setGoalKcal} style={css('width:96px;background:transparent;border:none;border-bottom:2px solid #444;font-family:Anton;font-size:38px;color:#fff;padding:0')} />
                      <span style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#8A8A85`)}>KCAL</span>
                    </div>
                  </div>
                  <div style={css('flex:1')}>
                    <div style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;color:#8A8A85;margin-bottom:4px`)}>PROTÉINES</div>
                    <div style={css('display:flex;align-items:baseline;gap:4px')}>
                      <input type="number" value={goalProt} onChange={setGoalProt} style={css('width:64px;background:transparent;border:none;border-bottom:2px solid #444;font-family:Anton;font-size:38px;color:#fff;padding:0')} />
                      <span style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#8A8A85`)}>G</span>
                    </div>
                  </div>
                </div>
              </div>

              {measRows.map((m) => (
                <div key={m.field} style={css('display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #E7E7E2')}>
                  <span style={css('font-weight:600;font-size:14px;color:#0A0A0A')}>{m.label}</span>
                  <div style={css('display:flex;align-items:center;gap:6px')}>
                    <input type="number" value={settings[m.field] as number} onChange={(e) => setMeas(m.field, num(e))} style={css('width:74px;border:2px solid #0A0A0A;background:#fff;padding:7px 9px;font-weight:700;font-size:15px;text-align:right;border-radius:1px')} />
                    <span style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#9A9A94;width:32px`)}>{m.unit}</span>
                  </div>
                </div>
              ))}

              <div style={css('display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #E7E7E2')}>
                <span style={css('font-weight:600;font-size:14px;color:#0A0A0A')}>Sexe</span>
                <div style={css('display:flex;border:2px solid #0A0A0A;border-radius:1px;overflow:hidden')}>
                  <button onClick={() => setSex('m')} style={{ ...css('padding:9px 14px;border:none;cursor:pointer;font-weight:700;font-size:13px'), background: settings.sex === 'm' ? '#0A0A0A' : '#fff', color: settings.sex === 'm' ? '#fff' : '#0A0A0A' }}>Homme</button>
                  <button onClick={() => setSex('f')} style={{ ...css('padding:9px 14px;border:none;cursor:pointer;font-weight:700;font-size:13px;border-left:2px solid #0A0A0A'), background: settings.sex === 'f' ? '#0A0A0A' : '#fff', color: settings.sex === 'f' ? '#fff' : '#0A0A0A' }}>Femme</button>
                </div>
              </div>
              <div style={css('display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #E7E7E2')}>
                <span style={css('font-weight:600;font-size:14px;color:#0A0A0A')}>Activité</span>
                <select value={actVal} onChange={(e) => setMeas('activity_factor', parseFloat(e.target.value))} style={css('border:2px solid #0A0A0A;background:#fff;padding:7px 9px;font-weight:600;font-size:13px;border-radius:1px')}>
                  {actOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div style={css('margin-top:22px;border:3px dashed #C8C8C3;background:#F2F2EF;border-radius:2px;padding:15px;display:flex;align-items:center;justify-content:space-between;opacity:.85')}>
                <div>
                  <div style={css('font-family:Anton;font-size:20px;color:#B5B5B0;line-height:1')}>FITBIT</div>
                  <div style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#B5B5B0;margin-top:4px;letter-spacing:.5px`)}>Synchro pas & dépense énergétique</div>
                </div>
                <div style={css(`background:#C6FF00;color:#0A0A0A;font-family:'Space Mono',monospace;font-weight:700;font-size:10px;letter-spacing:1px;padding:6px 10px;border:2px solid #0A0A0A`)}>BIENTÔT</div>
              </div>

              <button onClick={logout} className="hov-red" style={css('width:100%;margin-top:22px;border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:13px;cursor:pointer;font-family:Anton;font-size:17px;letter-spacing:1px')}>SE DÉCONNECTER</button>
            </div>
          )}
        </div>

        {/* FAB */}
        {screen !== 'add' && (
          <button onClick={openAdd} className="fabpress" style={css('position:absolute;right:18px;bottom:82px;width:64px;height:64px;background:#C6FF00;border:3px solid #0A0A0A;border-radius:3px;box-shadow:5px 5px 0 #0A0A0A;cursor:pointer;z-index:40;display:flex;align-items:center;justify-content:center;transition:transform .08s,box-shadow .08s')}>
            <span style={css('font-family:Anton;font-size:46px;line-height:.7;color:#0A0A0A;margin-top:-3px')}>+</span>
          </button>
        )}

        {/* TAB BAR */}
        <div style={css('height:66px;flex:none;display:flex;border-top:3px solid #0A0A0A;background:#fff;z-index:30')}>
          {tabs.map((t) => {
            const active = screen === t.key
            return (
              <button key={t.key} onClick={() => setScreen(t.key)} style={css('flex:1;background:transparent;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0;position:relative')}>
                <div style={{ ...css('width:7px;height:7px'), background: active ? '#0A0A0A' : '#D0D0CB' }} />
                <span style={{ ...css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.5px`), color: active ? '#0A0A0A' : '#B5B5B0' }}>{t.label}</span>
                {active && <div style={css('position:absolute;top:0;left:22%;right:22%;height:4px;background:#C6FF00')} />}
              </button>
            )
          })}
        </div>

        {/* CONFETTI */}
        {celebrate && (
          <div style={css('position:absolute;inset:0;pointer-events:none;z-index:55;overflow:hidden')}>
            {confetti.map((c) => <div key={c.id} style={c.style} />)}
          </div>
        )}

        {/* ADD OVERLAY */}
        {screen === 'add' && (
          <div style={css('position:absolute;inset:0;background:#FAFAFA;z-index:60;display:flex;flex-direction:column;animation:slideUp .32s cubic-bezier(.2,.9,.3,1)')}>
            <div style={css('height:52px;flex:none;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:3px solid #0A0A0A;background:#fff')}>
              <button onClick={addBack} className="hov-lime" style={css('width:34px;height:34px;border:2px solid #0A0A0A;background:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;border-radius:1px')}>‹</button>
              <span style={css('font-family:Anton;font-size:19px;letter-spacing:.5px')}>{addTitle}</span>
            </div>

            <div className="scr" style={css('flex:1;overflow-y:auto;padding:16px')}>
              {/* SEARCH */}
              {add.stage === 'search' && (
                <>
                  <div style={css('display:flex;align-items:center;border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:0 12px;height:50px;margin-bottom:12px')}>
                    <span style={css(`font-family:'Space Mono',monospace;font-weight:700;color:#0A0A0A;margin-right:8px`)}>⌕</span>
                    <input autoFocus value={add.query} onChange={(e) => setAdd((a) => ({ ...a, query: e.target.value }))} placeholder="Rechercher un aliment…" style={css('flex:1;border:none;background:transparent;font-size:15px;font-weight:500;height:100%')} />
                  </div>
                  <button onClick={startScan} className="press-y" style={css('width:100%;display:flex;align-items:center;gap:12px;background:#0A0A0A;border:3px solid #0A0A0A;border-radius:2px;padding:14px;cursor:pointer;margin-bottom:8px')}>
                    <div style={css('width:34px;height:26px;background:repeating-linear-gradient(90deg,#C6FF00 0 2px,transparent 2px 4px,#C6FF00 4px 5px,transparent 5px 8px);border:2px solid #C6FF00')} />
                    <div style={css('text-align:left')}>
                      <div style={css('font-family:Anton;font-size:17px;color:#fff;line-height:1')}>SCANNER UN CODE-BARRES</div>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#8A8A85;margin-top:2px`)}>le plus rapide · 1 tap</div>
                    </div>
                  </button>
                  <div style={css('text-align:center;margin:10px 0 16px')}>
                    <button onClick={openManual} style={css(`background:none;border:none;cursor:pointer;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:#9A9A94;text-decoration:underline;text-underline-offset:3px`)}>SAISIE MANUELLE</button>
                  </div>
                  <div style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#8A8A85;margin-bottom:8px`)}>RÉSULTATS</div>
                  {results.map((r) => (
                    <button key={r.off_id} onClick={() => selectFood(r)} className="hov-lime" style={css('width:100%;display:flex;align-items:center;gap:12px;background:#fff;border:2px solid #0A0A0A;border-radius:2px;padding:10px;margin-bottom:8px;cursor:pointer;text-align:left')}>
                      {r.image_url
                        ? <img src={r.image_url} alt="" style={css('width:44px;height:44px;flex:none;border:2px solid #0A0A0A;object-fit:cover')} />
                        : <div style={css(`width:44px;height:44px;flex:none;border:2px solid #0A0A0A;background:repeating-linear-gradient(45deg,#EDEDE9 0 5px,#F6F6F3 5px 10px);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:8px;color:#9A9A94`)}>IMG</div>}
                      <div style={css('flex:1;min-width:0')}>
                        <div style={css('font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.name}</div>
                        <div style={css(`font-family:'Space Mono',monospace;font-size:10px;color:#9A9A94;margin-top:2px`)}>{r.brand ? r.brand + ' · ' : ''}{r.per_100g.kcal} kcal · {r.per_100g.protein_g}g /100g</div>
                      </div>
                      <span style={css('font-family:Anton;font-size:20px;color:#0A0A0A')}>+</span>
                    </button>
                  ))}
                  {add.query.trim().length >= 2 && results.length === 0 && <div style={css(`text-align:center;padding:24px 0;font-family:'Space Mono',monospace;font-size:11px;color:#B5B5B0`)}>AUCUN RÉSULTAT · essaie la saisie manuelle</div>}
                </>
              )}

              {/* SCAN */}
              {add.stage === 'scan' && (
                <>
                  <div style={css('border:3px solid #0A0A0A;background:#0A0A0A;border-radius:2px;height:260px;position:relative;overflow:hidden;margin-bottom:14px')}>
                    <BarcodeScanner onDetected={onScanDetected} onError={() => setScanMsg('Caméra indisponible — saisis le code à la main')} />
                    <div style={css('position:absolute;left:8%;right:8%;height:3px;background:#C6FF00;box-shadow:0 0 12px #C6FF00;animation:scanline 1.1s ease-in-out infinite alternate')} />
                    <div style={css('position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;height:36%;border:2px dashed #C6FF00;border-radius:3px')} />
                    <div style={css(`position:absolute;bottom:14px;left:0;right:0;text-align:center;font-family:'Space Mono',monospace;font-size:11px;color:#C6FF00;letter-spacing:1px;animation:pulse 1s infinite`)}>ANALYSE DU CODE-BARRES…</div>
                  </div>
                  {scanMsg
                    ? <div style={css(`text-align:center;font-family:'Space Mono',monospace;font-size:11px;color:#E10600`)}>{scanMsg}</div>
                    : <div style={css(`text-align:center;font-family:'Space Mono',monospace;font-size:11px;color:#9A9A94`)}>Recherche dans la base OpenFoodFacts</div>}
                  <div style={css('text-align:center;margin-top:12px')}>
                    <button onClick={manualCode} style={css(`background:none;border:none;cursor:pointer;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1px;color:#9A9A94;text-decoration:underline;text-underline-offset:3px`)}>SAISIR LE CODE À LA MAIN</button>
                  </div>
                </>
              )}

              {/* DETAIL */}
              {add.stage === 'detail' && add.sel && (
                <>
                  <div style={css('display:flex;align-items:center;gap:12px;border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:12px;margin-bottom:16px')}>
                    <div style={css(`width:56px;height:56px;flex:none;border:2px solid #0A0A0A;background:repeating-linear-gradient(45deg,#EDEDE9 0 6px,#F6F6F3 6px 12px);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:9px;color:#9A9A94`)}>IMG</div>
                    <div>
                      <div style={css('font-family:Anton;font-size:20px;line-height:1')}>{add.sel.name}</div>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:11px;color:#9A9A94;margin-top:3px`)}>{add.sel.brand ? add.sel.brand + ' · ' : ''}{add.sel.kcal} kcal · {add.sel.prot}g /100g</div>
                    </div>
                  </div>
                  <div style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#8A8A85;margin-bottom:8px`)}>QUANTITÉ</div>
                  <div style={css('display:flex;align-items:stretch;gap:10px;margin-bottom:18px')}>
                    <button onClick={() => qtyStep(-10)} className="press-dark" style={css('width:52px;border:3px solid #0A0A0A;background:#fff;font-family:Anton;font-size:26px;cursor:pointer;border-radius:2px')}>−</button>
                    <div style={css('flex:1;display:flex;align-items:center;border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:0 14px')}>
                      <input type="number" value={add.qty} onChange={(e) => setAdd((a) => ({ ...a, qty: Math.max(0, num(e)) }))} style={css('flex:1;border:none;background:transparent;font-family:Anton;font-size:30px;width:100%')} />
                      <span style={css(`font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#9A9A94`)}>g</span>
                    </div>
                    <button onClick={() => qtyStep(10)} className="press-lime2" style={css('width:52px;border:3px solid #0A0A0A;background:#C6FF00;font-family:Anton;font-size:26px;cursor:pointer;border-radius:2px')}>+</button>
                  </div>
                  <div style={css('display:flex;gap:12px;margin-bottom:20px')}>
                    <div style={css('flex:1;border:3px solid #0A0A0A;background:#fff;border-radius:2px;padding:12px')}>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;color:#8A8A85;margin-bottom:4px`)}>APPORT CALORIQUE</div>
                      <div style={css('font-family:Anton;font-size:34px;line-height:.9')}>{pKcal}<span style={css(`font-family:'Space Mono',monospace;font-size:11px;color:#9A9A94;margin-left:3px`)}>kcal</span></div>
                    </div>
                    <div style={css('flex:1;border:3px solid #0A0A0A;background:#C6FF00;border-radius:2px;padding:12px')}>
                      <div style={css(`font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;color:#0A0A0A;margin-bottom:4px`)}>PROTÉINES</div>
                      <div style={css('font-family:Anton;font-size:34px;line-height:.9')}>{pProt}<span style={css(`font-family:'Space Mono',monospace;font-size:11px;margin-left:3px`)}>g</span></div>
                    </div>
                  </div>
                  <button onClick={confirmAdd} className="press-shadow" style={css('width:100%;background:#0A0A0A;border:3px solid #0A0A0A;border-radius:2px;padding:16px;cursor:pointer;box-shadow:4px 4px 0 rgba(10,10,10,.2)')}>
                    <span style={css('font-family:Anton;font-size:22px;color:#C6FF00;letter-spacing:1px')}>{confirmLabel}</span>
                  </button>
                </>
              )}

              {/* MANUAL */}
              {add.stage === 'manual' && (
                <>
                  <div style={css(`font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#8A8A85;margin-bottom:12px`)}>SAISIE MANUELLE</div>
                  <div style={css('margin-bottom:12px')}>
                    <div style={css('font-weight:600;font-size:13px;margin-bottom:5px')}>Nom de l'aliment</div>
                    <input value={add.manName} onChange={(e) => setAdd((a) => ({ ...a, manName: e.target.value }))} placeholder="ex. Barre protéinée" style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:11px;font-size:15px;font-weight:500;border-radius:2px')} />
                  </div>
                  <div style={css('display:flex;gap:10px;margin-bottom:12px')}>
                    <div style={css('flex:1')}>
                      <div style={css('font-weight:600;font-size:13px;margin-bottom:5px')}>Calories</div>
                      <input type="number" value={add.manKcal} onChange={(e) => setAdd((a) => ({ ...a, manKcal: e.target.value }))} placeholder="0" style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:11px;font-family:Anton;font-size:22px;border-radius:2px')} />
                    </div>
                    <div style={css('flex:1')}>
                      <div style={css('font-weight:600;font-size:13px;margin-bottom:5px')}>Protéines (g)</div>
                      <input type="number" value={add.manProt} onChange={(e) => setAdd((a) => ({ ...a, manProt: e.target.value }))} placeholder="0" style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:11px;font-family:Anton;font-size:22px;border-radius:2px')} />
                    </div>
                  </div>
                  <div style={css('margin-bottom:20px')}>
                    <div style={css('font-weight:600;font-size:13px;margin-bottom:5px')}>Quantité (indicatif)</div>
                    <input value={add.manQty} onChange={(e) => setAdd((a) => ({ ...a, manQty: e.target.value }))} placeholder="ex. 1 barre · 60 g" style={css('width:100%;border:3px solid #0A0A0A;background:#fff;padding:11px;font-size:15px;font-weight:500;border-radius:2px')} />
                  </div>
                  <button onClick={confirmManual} className="press-shadow" style={css('width:100%;background:#0A0A0A;border:3px solid #0A0A0A;border-radius:2px;padding:16px;cursor:pointer;box-shadow:4px 4px 0 rgba(10,10,10,.2)')}>
                    <span style={css('font-family:Anton;font-size:22px;color:#C6FF00;letter-spacing:1px')}>{confirmLabel}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
