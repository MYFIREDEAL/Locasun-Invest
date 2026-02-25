# Décisions Techniques

## 🎯 ÉTAT D'AVANCEMENT - 26 janvier 2026

### ✅ PROMPT 0-5 : Infrastructure & Auth
- [x] Setup Next.js 16 + TypeScript strict
- [x] Supabase Auth (Magic Link)
- [x] RLS multi-tenant
- [x] Migrations + seeds
- [x] Layout (auth) vs (app)

### ✅ PROMPT 6 : Config bâtiment (colonne gauche "style Nelson")
- [x] Types: SYM, ASYM1, ASYM2, MONO, VL_LEFT, VL_RIGHT, VL_DOUBLE, PL
- [x] UI colonne gauche: type, largeur, espacement travée, nb travées, pente
- [x] Extensions (auvent/appentis) si autorisées par ruleset
- [x] Calculs dérivés avec **Pythagore** (rampant = √(largeur² + Δh²))
- [x] Position faîtage depuis la gauche (clef pour asymétriques)
- [x] Validation Zod (aucune config invalide possible)
- [x] Sauvegarde `building_configs` en DB
- [x] Gate: changement type → reset contrôlé

### ✅ PROMPT 7 : Panneaux + calepinage + kWc
- [x] Panel library (4+ modèles hardcodés)
- [x] Params calepinage: margin 0.02m, gap 0.015m, orientation landscape
- [x] Calcul grille réelle par zone PV (nb panneaux X × Y)
- [x] Stockage: `panels_by_zone`, `kwc_by_zone`, `panels_total`, `kwc_total`
- [x] Gate: modifier dimensions/panneau → recalcul cohérent et stable
- [x] Labels cohérents: **Pan A (droite) = SUD**, **Pan B (gauche) = NORD**
- [⚠️] **À REVOIR PLUS TARD**: Optimisation intégration panneaux/surface toiture (calibration dimensions vs pattern souhaité)

### ✅ PROMPT 8 : Rendu 3D avec React Three Fiber
- [x] Canvas R3F dans l'onglet Config (au-dessus du formulaire)
- [x] Géométrie simplifiée générée depuis BuildingConfig
- [x] Poteaux (BoxGeometry gris métallique)
- [x] Toiture (plans inclinés, pan PV bleu / pan nord gris)
- [x] Panneaux solaires visibles (grille de rectangles bleu foncé)
- [x] Cotes dimensionnelles avec toggle ON/OFF (largeur, longueur, hauteurs)
- [x] OrbitControls pour rotation/zoom/pan caméra
- [x] Gate: changements rapides de paramètres → pas de crash, rendu fluide
- [x] Build OK avec @react-three/fiber, @react-three/drei, three
- [x] Libs: `lib/geometry/building-3d.ts` (helpers géométrie)
- [x] Components: `building-3d-view.tsx`, `building-mesh.tsx`, `dimension-labels.tsx`

### 🔧 Admin variantes
- [x] Tableau éditable des hauteurs par type+largeur
- [x] Colonne **"POSITION FAÎTAGE ← depuis la gauche"** pour ASYM
- [x] Schéma visuel avec flèche orange montrant distance gauche→faîtage
- [x] Sauvegarde en DB des variantes modifiées

### ✅ PROMPT 9 : Implantation géographique
- [x] Carte Leaflet avec fond satellite Google
- [x] Recherche d'adresse → lat/lng (geocoding)
- [x] Rectangle bâtiment (bleu Pan A / orange Pan B)
- [x] Drag pour déplacer, handle orange pour orienter
- [x] Calcul azimuth par pan (Pan A = Sud, Pan B = Nord)
- [x] Affichage position (lat/lng), rotation, azimuth de chaque pan
- [x] Légende interactive
- [x] Sauvegarde en DB (lat, lng, rotation)

### ✅ PROMPT 10 : Appel PVGIS par pan
- [x] Types PVGIS complets (`lib/types/pvgis.ts`)
- [x] Conversion azimuth 0=Nord → PVGIS aspect 0=Sud
- [x] Service backend (`server/services/pvgis/index.ts`) - appels GET avec timeout 30s
- [x] Actions server (`lib/actions/pvgis.ts`) - orchestration + cache DB
- [x] API Route POST `/api/pvgis/calc` - validation Zod, gestion erreurs
- [x] Table `pvgis_results` avec cache par hash d'inputs (RLS activée)
- [x] UI Résultats: kWh/an, kWh/kWc, tableau mensuel par pan
- [x] Calcul multi-pans (appels séquentiels, agrégation pondérée)
- [x] Gate: typecheck OK, build OK, aucun appel PVGIS depuis navigateur

### 🚀 Prochaines étapes
- [ ] PROMPT 11 : Appel Enedis (profil de consommation)
- [ ] PROMPT 12 : Calcul rentabilité & ROI
- [ ] PROMPT 13 : Export PDF / rapport

---

## 2026-01-25

### Initialisation du projet

**Décision**: Utiliser Next.js 16 avec App Router
**Raison**: Dernière version stable, meilleure gestion du routing et des layouts

**Décision**: TypeScript strict avec options supplémentaires
**Options ajoutées**:
- `noUncheckedIndexedAccess`: Évite les accès non sécurisés aux tableaux/objets
- `noImplicitOverride`: Force l'utilisation explicite du mot-clé override
- `forceConsistentCasingInFileNames`: Cohérence des imports

**Décision**: Structure avec route groups
**Raison**: Séparer l'authentification `(auth)` de l'application principale `(app)` avec des layouts distincts

**Décision**: pnpm comme gestionnaire de paquets
**Raison**: Performances supérieures, gestion stricte des dépendances

**Décision**: Prettier avec configuration standard
**Raison**: Formatage automatique cohérent sur tout le code

**Décision**: Dossier `/server` pour les services backend
**Raison**: Séparation claire du code server-only (PVGIS, Enedis) du code client

**Décision**: Placeholder files dans les dossiers lib/ et server/
**Raison**: Structure prête pour l'implémentation future, évite les dossiers vides

## Hypothèses

1. **Multi-tenancy**: Chaque projet appartient à un utilisateur/organisation
2. **Authentication**: Magic link comme méthode principale (pas de mot de passe)
3. **Leaflet CSS**: Sera importée globalement dans layout.tsx quand nécessaire
4. **Types Three.js**: @types/three non nécessaire (types inclus dans three depuis v0.125)
5. **Variables d'environnement**: Configuration dans .env.local
   - Supabase (URL, anon key, service role key)
   - PVGIS API (URL de l'API européenne JRC)
   - Enedis API (URL et clé d'API)
   - App URL pour redirections et callbacks

### Schéma Supabase et RLS

**Décision**: Multi-tenant strict avec RLS sur toutes les tables
**Raison**: Isolation complète des données entre organisations, sécurité maximale

**Décision**: Workflow avec 5 états (draft, submitted, accepted, rejected, returned)
**Raison**: Permet un cycle de validation complet entre clients et professionnels

**Décision**: 2 modes de projet (PRO_SERVICE, CLIENT_SELF_SERVICE)
**Raison**: 
- PRO_SERVICE: Pro gère tout, client consulte uniquement
- CLIENT_SELF_SERVICE: Client crée et modifie son projet, pro valide

**Décision**: RLS avec fonctions helper (user_org_id, user_role, user_is_elevated)
**Raison**: Évite la duplication de logique, politiques plus lisibles et maintenables

**Décision**: Champs de décision séparés dans projects (decision_reason_code, decision_comment, etc.)
**Raison**: Audit trail clair, permet de distinguer l'édition du projet vs la décision de validation

**Décision**: PostGIS pour implantations avec types GEOGRAPHY
**Raison**: 
- GEOGRAPHY gère automatiquement les calculs sur sphéroïde
- Adapté aux coordonnées GPS (lat/lng)
- Index GIST pour performances spatiales

**Décision**: JSONB pour configs flexibles (building rulesets, PVGIS results, etc.)
**Raison**: 
- Schéma évolutif sans migrations lourdes
- Indexation et requêtes possibles avec JSONB
- Validation côté application avec Zod

**Décision**: Snapshots avec hash pour déduplication
**Raison**: Évite de stocker plusieurs fois le même état, optimise le stockage

**Décision**: Integration runs avec statut (pending, running, success, failed)
**Raison**: Traçabilité des appels API externes, permet retry et monitoring

## 2026-01-26

### Fix Auth Callback - Next.js 16 + Turbopack

**Problème**: Les variables d'environnement `process.env.NEXT_PUBLIC_*` ne sont pas chargées correctement avec Next.js 16 et Turbopack en dev.

**Décision**: Credentials Supabase en dur dans les fichiers client
**Fichiers modifiés**:
- `lib/supabase/client.ts` ✅
- `lib/supabase/server.ts` ✅
- `lib/supabase/middleware.ts` ✅

**Raison**: Bug connu de Next.js 16 avec Turbopack. En production (Vercel), les variables seront injectées au build time.

**TODO production**: Remettre `process.env.NEXT_PUBLIC_SUPABASE_URL` et `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` quand le bug sera corrigé.

**Décision**: Route callback avec gestion d'erreurs complète
**Raison**: L'ancienne route ne capturait pas les erreurs, causant des 500 silencieux.

**Décision**: Page login avec Suspense boundary pour useSearchParams
**Raison**: Next.js 16 requiert un Suspense pour les hooks qui accèdent aux query params côté client.

## 2026-01-26 - PROMPT 6 & 7: Config bâtiment + Calepinage

### Calcul de surface de toiture - Formule Pythagore

**Problème identifié**: L'ancien code utilisait `rampant = largeur / cos(pente)` ce qui suppose une pente uniforme calculée depuis la config. Pour les bâtiments asymétriques, cette approche est incorrecte.

**Décision**: Utiliser le **théorème de Pythagore** avec les vraies hauteurs
```
rampant = √(largeurPan² + Δh²)
où Δh = hauteur_faîtage - hauteur_sablière
```

**Raison**: 
- Formule exacte, fonctionne pour tous les types (SYM, ASYM, MONO, etc.)
- Utilise les données réelles (hauteurs de variantes) plutôt qu'une pente théorique
- Pour ASYM: chaque pan a son propre Δh, donc son propre rampant

### Position du faîtage

**Décision**: Ajouter `faitagePosition` (distance depuis bord gauche) dans `BuildingDerived`

**Calcul par type**:
- `SYM`: `largeur / 2` (centre)
- `ASYM1`: calculé depuis les hauteurs via `Δh_gauche / tan(pente)`
- `ASYM2`: utilise `zoneLeft` des variantes
- `MONO, VL_*, PL`: position = 0 (monotoit, pas de faîtage central)

**Raison**: Sans la position du faîtage, impossible de calculer correctement les largeurs des 2 pans d'un bâtiment asymétrique.

### Champs ajoutés à BuildingDerived

- `faitagePosition`: distance faîtage depuis bord gauche (m)
- `panWidthA`: largeur pan A au sol (m) - grand pan pour ASYM
- `panWidthB`: largeur pan B au sol (m) - petit pan pour ASYM
- `heightDeltaPanA`: Δh pan A = faîtage - sablière droite
- `heightDeltaPanB`: Δh pan B = faîtage - sablière gauche

### Calepinage avec grille réelle

**Décision**: Remplacer le calcul par ratio (`surface / ratio_calibré`) par un vrai calcul de grille

**Nouveau calcul**:
1. Surface utile = (rampant - 2×marge) × (longueur - 2×marge)
2. Nb panneaux en X = floor((longueur_utile + gap) / (largeur_panneau + gap))
3. Nb panneaux en Y = floor((rampant_utile + gap) / (longueur_panneau + gap))
4. Orientation auto: choisit portrait ou paysage selon ce qui donne le plus de panneaux

**Paramètres par défaut**:
- `margin_m`: 0.10m (10cm de marge périmètre)
- `gap_m`: 0.015m (1.5cm entre panneaux)
- Orientation: landscape (paysage) par défaut

### Rendu 3D avec React Three Fiber (PROMPT 8)

**Décision**: Intégrer un canvas 3D au-dessus du formulaire de configuration

**Stack**:
- `three@^0.182.0` (inclut ses propres types depuis v0.125+)
- `@react-three/fiber@^9.5.0` (renderer React pour Three.js)
- `@react-three/drei@^10.7.7` (helpers: OrbitControls, Grid, Html)

**Architecture**:
- `lib/geometry/building-3d.ts`: helpers pour générer colonnes, plans toiture, panneaux
- `building-3d-view.tsx`: Canvas principal avec caméra, lumières, contrôles
- `building-mesh.tsx`: Géométrie 3D (poteaux, toiture, panneaux)
- `dimension-labels.tsx`: Affichage des cotes avec toggle ON/OFF

**Géométrie générée**:
- **Poteaux**: `BoxGeometry` 0.3×height×0.3, gris métallique
- **Toiture**: Plans inclinés créés depuis vertices 3D (pan PV bleu, pan nord gris)
- **Panneaux**: Grille de rectangles bleu foncé, calculés depuis `nbPanelsPanA/B`

**Mémoïsation**:
- Tous les calculs géométriques sont `useMemo()` avec `config` en dépendance
- Évite les recalculs à chaque render → performance OK même avec changements rapides

**Gate validé**:
- ✅ Changements rapides de paramètres (type, largeur, etc.) → pas de crash
- ✅ Canvas responsive (aspect-video)
- ✅ OrbitControls pour explorer la scène
- ✅ Toggle cotes masque/affiche les labels HTML
- ✅ Build Next.js réussit sans erreurs

**Hypothèse**: Les panneaux sont placés de manière approximative pour l'instant (grille simple sur estimation de position). Une optimisation future pourrait les placer exactement sur la surface du toit en 3D en utilisant un mapping UV ou raycasting.

- `gap_m`: 0.02m (2cm entre panneaux)
- `orientation`: "auto" (choisit le meilleur)

**Raison**: Calcul plus précis et reproductible. Modifier dimensions/panneau → recalcul cohérent.

### Convention pan A / pan B

**Décision**: 
- **Pan A** = côté DROIT = sablière BASSE (pour ASYM) = **grand pan** (plus de surface PV)
- **Pan B** = côté GAUCHE = sablière HAUTE (pour ASYM) = **petit pan**

**Raison**: Cohérence avec les screenshots Nelson où le grand pan Sud (pour le solaire) est toujours à droite.
