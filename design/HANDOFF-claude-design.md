# Handoff design — Bulk (à coller dans Claude Design)

Le backend + le contrat d'API sont **figés et déployés**. Ce document est le brief à
donner à Claude Design pour produire l'UI finale. Le front de référence dans `frontend/`
est fonctionnel mais volontairement sobre : Claude Design le remplace.

> ⚠️ Le contrat d'API ci-dessous est la source de vérité. Les écrans doivent consommer
> **exactement** ces endpoints (même origine, cookie de session `credentials: 'include'`).

---

## PROMPT (copier tel quel)

```markdown
Tu es un designer-développeur front. Construis une web app **mobile-first** (usage
principal sur téléphone, ~375px) en **React + TypeScript**, componentisée, prête à
builder avec Vite. UI en **français**. Thème **sombre par défaut, esthétique gym/fitness**.

## Produit
« Bulk » — tracker de nutrition gamifié pour une prise de masse. On logge ce qu'on mange ;
l'app affiche en temps réel les macros du jour sous forme de **barres de progression
gamifiées** (le cœur du produit). Mono-utilisateur.

## Écrans
0. **Connexion** (avant l'app) : logo/wordmark BULK, champs identifiant + mot de passe,
   bouton « Se connecter », message d'erreur si identifiants invalides. Soigné, plein
   écran, même ADN visuel que le reste. (POST /api/auth/login pose un cookie ; au chargement
   GET /api/auth/me dit si on est déjà connecté.)
1. **Aujourd'hui** (accueil, le héros) : les 2 barres gamifiées (Calories, Protéines) tout
   en haut, puis la liste des aliments loggés du jour (nom, quantité, kcal, prot, heure ;
   éditer/supprimer), et un gros bouton flottant `+`.
2. **Ajouter un aliment** (ouvert par le `+`, 2-3 taps max) : recherche texte (résultats
   OpenFoodFacts), bouton **scan code-barres** (caméra, getUserMedia), et lien « saisie
   manuelle » (nom + kcal + protéines + quantité). Après sélection : quantité (g/ml/portion)
   avec aperçu live des kcal/prot calculés, puis « Ajouter ».
3. **Historique** : liste/mini-calendrier des jours passés, chacun avec résumé kcal/prot
   et indicateur **✅ / ⚠️**. Pas de graphes.
4. **Réglages** : nom, poids, taille, âge, sexe, facteur d'activité, coef protéines (g/kg),
   surplus (%). Objectifs affichés (auto-calculés, surchargeables). Bloc « Fitbit »
   **désactivé avec badge “bientôt”**. Bouton « Se déconnecter ».

## ⭐ Les barres gamifiées (spec précise — LE truc à réussir)
- Horizontales, **épaisses, très arrondies**, remplissage proportionnel au % de l'objectif.
- Dégradé de couleur **fluide et continu** rouge (0%) → orange (~50%) → **vert (100%)** —
  surtout PAS un switch binaire.
- **Overshoot** : à >100% barre pleine ; au-delà de ~110% (champ `state:"over"`) elle vire
  vers un **rouge d'alerte différent** (« trop », pertinent surtout pour les kcal).
- Libellé chiffré **au-dessus, typo forte et grosse** : `1720/2888 kcal`, `112/180g`.
  C'est ce qu'on lit en 2 secondes après un repas → ça doit dominer.
- **Animation de remplissage fluide** à chaque ajout (la barre glisse/rebondit, pas de saut).
- **Feedback à 100%** : petite célébration (confetti léger + `navigator.vibrate` + son court
  optionnel) quand un objectif atteint sa cible. Discret mais gratifiant.
- Micro-interactions partout : léger rebond, transitions douces, zéro friction.

## Contrat d'API (base `/api`, même origine, cookie de session)
POST /api/auth/login {username,password} -> {ok}      // pose le cookie
POST /api/auth/logout -> {ok}
GET  /api/auth/me -> {authenticated:boolean}
GET  /api/settings -> Settings
PUT  /api/settings (partiel) -> Settings
GET  /api/food/search?q=&page=1 -> { results: FoodHit[] }
GET  /api/food/barcode/{code} -> FoodHit | 404
POST /api/entries (NewEntry) -> Entry
GET  /api/entries?date=YYYY-MM-DD -> { date, entries: Entry[] }
PATCH /api/entries/{id} {name?,quantity?} -> Entry
DELETE /api/entries/{id} -> 204
GET  /api/summary/today -> Summary   // alimente les barres
GET  /api/history -> DaySummary[]
GET  /api/fitbit/status -> { connected:false, available:false }

Types:
Settings = { name, weight_kg, height_cm, age, sex:"m"|"f", activity_factor,
  protein_coef_g_per_kg, surplus_pct, target_protein_g, target_kcal_base,
  target_kcal_final, target_protein_override:number|null,
  target_kcal_override:number|null, use_fitbit:false }
FoodHit  = { source:"off", off_id, name, brand?, image_url?,
  per_100g:{kcal,protein_g}, serving_size_g?, nutriscore? }
NewEntry = { name, quantity, unit:"g"|"ml"|"portion", off_id?,
  per_100g?:{kcal,protein_g}, manual?:{kcal,protein_g} }
Entry    = { id, name, quantity, unit, kcal, protein_g, off_id?, logged_at }
Summary  = { date, kcal:Progress, protein:Progress,
  tdee_source:"estimate"|"fitbit", entries_count }
Progress = { total, target, pct, state:"under"|"on_track"|"reached"|"over" }
DaySummary = { date, kcal_total, kcal_target, protein_total, protein_target,
  kcal_ok, protein_ok }

Ajout : g/ml -> envoyer per_100g (le serveur calcule x quantité/100) ; manuel -> envoyer
manual (x quantité). La couleur/état des barres suit `state` renvoyé par /summary/today.
Cibles : protéines = target_protein_g ; kcal = target_kcal_final.

## Contraintes techniques
- React + TypeScript, composants en fichiers séparés (structure `src/` Vite).
- Un `src/api.ts` centralise les fetch vers `/api/*` avec `credentials:'include'`.
- Styling CSS/CSS-modules autonome (ou Tailwind + sa config) — pas de kit UI lourd.
- **Mode mock** : flag `USE_MOCK` en haut d'`api.ts` ; à `true` -> données factices
  réalistes (journée ~1720/2888 kcal, ~110/180g, quelques entrées, connecté) pour que tout
  soit cliquable/animé dans l'aperçu Claude Design sans backend ; à `false` -> vrai `/api`.
- Mobile-first strict (375px), responsive propre au-delà. Scan via `getUserMedia`
  (lib de décodage légère ok ; sinon bouton + fallback manuel).

## Hors scope
Autres macros (lipides/glucides) ; graphes de tendance ; recommandations de repas ;
OAuth Fitbit réel (juste le bouton « bientôt »).

## Livrable
App React+TS complète et componentisée : connexion + 4 écrans navigables, barres gamifiées
animées et satisfaisantes, `api.ts` avec mode mock. Soigne surtout : la typo des chiffres,
le dégradé rouge→vert fluide, l'animation de remplissage, le feedback à 100%.
```

---

## Intégration (côté Claude Code, après réception du design)
1. Remplacer le contenu de `frontend/src/` par les écrans de Claude Design.
2. Vérifier que `frontend/src/api.ts` tape bien `/api/*` avec `credentials:'include'`
   et `USE_MOCK=false`.
3. `docker compose up -d --build frontend` puis vérif bout-en-bout sur `bulk.cmrabdu.com`.
Le reste (backend, Docker, Caddy, DNS) est déjà en place.
