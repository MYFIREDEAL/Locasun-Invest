# Guide de Configuration Supabase

## Étape 1 : Appliquer les migrations SQL ✅

### Option A : Via Supabase Dashboard (Recommandé pour débuter)

1. **Ouvrir le SQL Editor**
   - Va sur https://supabase.com/dashboard
   - Sélectionne ton projet `bqgzxjieyfcwamyaplzf`
   - Clique sur "SQL Editor" dans le menu de gauche

2. **Exécuter la migration 1 - Schema**
   - Clique sur "New query"
   - Copie tout le contenu de `supabase/migrations/20260125000000_initial_schema.sql`
   - Colle dans l'éditeur
   - Clique sur "Run" ou Cmd+Enter
   - ✅ Vérifie qu'il n'y a pas d'erreurs

3. **Exécuter la migration 2 - RLS**
   - Nouvelle query
   - Copie tout le contenu de `supabase/migrations/20260125000001_rls_policies.sql`
   - Colle et exécute
   - ✅ Vérifie qu'il n'y a pas d'erreurs

4. **Vérifier les tables**
   - Clique sur "Table Editor" dans le menu
   - Tu devrais voir toutes les tables : organizations, profiles, projects, etc.

### Option B : Via Supabase CLI (Pour automatiser)

Si tu veux utiliser le CLI Supabase :

```bash
# Installer Supabase CLI
brew install supabase/tap/supabase

# Se connecter à Supabase
supabase login

# Lier le projet local au projet distant
supabase link --project-ref bqgzxjieyfcwamyaplzf

# Appliquer les migrations
supabase db push
```

## Étape 2 : Créer les premières données de test

Dans le SQL Editor, exécute :

```sql
-- Créer une organisation de test
INSERT INTO organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mon Organisation Test');

-- Note l'UUID de ton compte Supabase Auth
-- Tu le trouveras dans Authentication → Users
```

## Étape 3 : Créer ton profil utilisateur

Une fois que tu as ton user_id de Supabase Auth :

```sql
-- Remplace YOUR_USER_ID par ton vrai UUID
INSERT INTO profiles (user_id, org_id, role) VALUES
  ('YOUR_USER_ID', '00000000-0000-0000-0000-000000000001', 'admin');
```

## Étape 4 : Tester la connexion depuis Next.js

Une fois les migrations appliquées, on pourra tester la connexion avec :

```bash
pnpm dev
```

## Notes Importantes

⚠️ **Ne pas committer .env.local** - Il contient des secrets
✅ **PostGIS** : S'active automatiquement avec la migration
✅ **RLS** : Toutes les tables sont protégées
🔒 **Service Role Key** : À utiliser UNIQUEMENT côté serveur

## Prochaines étapes après migrations

1. Implémenter les clients Supabase dans `lib/supabase/`
2. Créer les composants d'authentification
3. Tester les politiques RLS
4. Créer des projets de test
