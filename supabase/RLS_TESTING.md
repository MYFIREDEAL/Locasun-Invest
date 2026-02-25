# Tests RLS - Guide d'Exécution

## Prérequis

1. Projet Supabase créé et configuré
2. Migrations appliquées (voir supabase/migrations/)
3. Variables d'environnement configurées dans .env.local

## Étapes de Test

### 1. Créer les utilisateurs de test

Dans Supabase Dashboard → Authentication → Users, créer 4 utilisateurs:

**Organisation A:**
- `user-a1-pro@test.com` (will be pro)
- `user-a2-client@test.com` (will be client)

**Organisation B:**
- `user-b1-pro@test.com` (will be pro)
- `user-b2-client@test.com` (will be client)

Copier les UUIDs générés pour chaque utilisateur.

### 2. Modifier le script de test

Éditer `supabase/migrations/20260125000002_rls_tests.sql` et remplacer les UUIDs par les vrais:

```sql
-- Remplacer ces valeurs avec les vrais UUIDs de vos users
'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' → UUID de user-a1-pro@test.com
'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb' → UUID de user-a2-client@test.com
'bbbbbbbb-bbbb-bbbb-bbbb-aaaaaaaaaaaa' → UUID de user-b1-pro@test.com
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' → UUID de user-b2-client@test.com
```

### 3. Exécuter le setup

Dans Supabase SQL Editor (avec service_role):

```sql
-- Copier/coller les sections SETUP et TEST PROFILES/PROJECTS
-- du fichier 20260125000002_rls_tests.sql
```

### 4. Tester avec l'API Supabase

Créer un script Node.js pour tester avec les vraies credentials:

```javascript
// test-rls.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Test avec user A1 (pro)
const userA1Email = 'user-a1-pro@test.com';
const userA1Password = 'test-password-123';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserA1() {
  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: userA1Email,
    password: userA1Password,
  });
  
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  
  console.log('✓ Logged in as User A1 (pro)');
  
  // Test 1: Voir les projets
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, name, org_id');
  
  console.log('Projects visible to User A1:', projects?.length);
  console.log(projects);
  
  // Test 2: Essayer de voir les projets de Org B (devrait être vide)
  const { data: orgBProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', '22222222-2222-2222-2222-222222222222');
  
  console.log('Org B projects visible (should be 0):', orgBProjects?.length);
  
  await supabase.auth.signOut();
}

testUserA1();
```

### 5. Tests manuels critiques

#### Test A: Isolation multi-tenant ✓
```sql
-- En tant que User A1 (pro, Org A)
SELECT COUNT(*) FROM projects; -- Devrait retourner 3 (projets de Org A)

-- En tant que User B1 (pro, Org B)  
SELECT COUNT(*) FROM projects; -- Devrait retourner 2 (projets de Org B)
```

#### Test B: Client ne peut pas éditer après soumission ✓
```sql
-- En tant que User A2 (client, Org A)
-- Draft project - DEVRAIT RÉUSSIR
UPDATE projects SET name = 'Updated' 
WHERE id = 'aaaa0002-0000-0000-0000-000000000002';

-- Submitted project - DEVRAIT ÉCHOUER
UPDATE projects SET name = 'Hacking' 
WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
```

#### Test C: Pro peut gérer les décisions ✓
```sql
-- En tant que User A1 (pro, Org A)
UPDATE projects 
SET status = 'accepted',
    decision_reason_code = 'APPROVED',
    decision_comment = 'Looks good',
    decided_by_user_id = auth.uid(),
    decided_at = NOW()
WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
-- DEVRAIT RÉUSSIR
```

#### Test D: Client peut ré-éditer après returned ✓
```sql
-- En tant que User B2 (client, Org B)
-- Status = 'returned' - DEVRAIT RÉUSSIR
UPDATE projects SET name = 'Fixed issues' 
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';

-- Puis soumettre à nouveau
UPDATE projects SET status = 'submitted'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';

-- Maintenant édition devrait ÉCHOUER
UPDATE projects SET name = 'Hacking again'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
```

## Critères de Validation (Gate)

✅ **PASS si:**
1. User A ne voit aucun projet de Org B et vice-versa
2. Client ne peut PAS éditer un projet avec status 'submitted'
3. Pro PEUT mettre à jour les champs de décision sur un projet 'submitted'
4. Client PEUT éditer un projet avec status 'returned'
5. Aucune fuite de données entre organisations sur toutes les tables

❌ **FAIL si:**
- Un utilisateur voit des données d'une autre organisation
- Un client peut modifier un projet après submission
- Les politiques RLS permettent des accès non autorisés

## Nettoyage

Après les tests, exécuter le cleanup:

```sql
-- Voir la section CLEANUP dans 20260125000002_rls_tests.sql
DELETE FROM project_snapshots WHERE project_id LIKE 'aaaa%' OR project_id LIKE 'bbbb%';
DELETE FROM building_configs WHERE project_id LIKE 'aaaa%' OR project_id LIKE 'bbbb%';
DELETE FROM projects WHERE id LIKE 'aaaa%' OR id LIKE 'bbbb%';
DELETE FROM profiles WHERE org_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM organizations WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Supprimer les users de test dans Supabase Dashboard
```

## Notes

- Les tests RLS doivent être effectués avec les clés `anon` (pas `service_role`)
- La clé `service_role` bypass TOUTES les politiques RLS
- Utiliser le SQL Editor de Supabase avec l'option "Run as user" pour simuler un user spécifique
- En production, toujours tester avec de vraies sessions utilisateur
