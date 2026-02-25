# HANGAR3D - Spécifications Techniques

## Vue d'ensemble
Application web Next.js pour la modélisation 3D de hangars agricoles avec calculs solaires photovoltaïques.

## Stack Technique
- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS
- **3D**: Three.js, React Three Fiber, React Three Drei
- **Cartographie**: Leaflet, React Leaflet
- **Géométrie**: Turf.js
- **Backend**: Supabase (Auth, Postgres, Storage)
- **Validation**: Zod
- **Formulaires**: React Hook Form

## Architecture

### Routes
- `/login` - Authentification magic link
- `/projects` - Liste des projets
- `/projects/[id]` - Détail et édition du projet

### Structure des dossiers
```
/app
  /(auth)/login
  /(app)/projects
/components     # Composants UI réutilisables
/lib
  /supabase     # Clients Supabase
  /validators   # Schémas Zod
  /geometry     # Utilitaires géométriques
/server
  /services
    /pvgis      # API PVGIS (server-only)
    /enedis     # API Enedis (server-only)
  /integrations # Services externes
/docs           # Documentation
```

## Contraintes
- TypeScript strict mode
- RLS multi-tenant sur toutes les tables
- Appels API externes (PVGIS, Enedis) côté serveur uniquement
- Validation Zod sur tous les inputs
- Pas de `console.log` en production

## Déploiement
- Plateforme: Vercel
- Base de données: Supabase Postgres
- Stockage: Supabase Storage
