// Types = miroir exact du contrat backend (schemas.py).

export interface Settings {
  name: string
  weight_kg: number
  height_cm: number
  age: number
  sex: 'm' | 'f'
  activity_factor: number
  protein_coef_g_per_kg: number
  surplus_pct: number
  target_protein_g: number
  target_kcal_base: number
  target_kcal_final: number
  target_protein_override: number | null
  target_kcal_override: number | null
  use_fitbit: boolean
}

export interface Per100g {
  kcal: number
  protein_g: number
}

export interface FoodHit {
  source: string
  off_id: string
  name: string
  brand?: string | null
  image_url?: string | null
  per_100g: Per100g
  serving_size_g?: number | null
  nutriscore?: string | null
}

export type Unit = 'g' | 'ml' | 'portion'

export interface NewEntry {
  name: string
  quantity: number
  unit: Unit
  off_id?: string | null
  per_100g?: Per100g
  manual?: Per100g
}

export interface Entry {
  id: number
  name: string
  quantity: number
  unit: string
  kcal: number
  protein_g: number
  off_id?: string | null
  logged_at: string
}

export type ProgressState = 'under' | 'on_track' | 'reached' | 'over'

export interface Progress {
  total: number
  target: number
  pct: number
  state: ProgressState
}

export interface Summary {
  date: string
  kcal: Progress
  protein: Progress
  tdee_source: 'estimate' | 'fitbit'
  entries_count: number
}

export interface DaySummary {
  date: string
  kcal_total: number
  kcal_target: number
  protein_total: number
  protein_target: number
  kcal_ok: boolean
  protein_ok: boolean
}
