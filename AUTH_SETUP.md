# Configuration de l'authentification Magic Link

## ✅ Code implémenté

L'authentification par magic link est maintenant configurée !

## 🔧 Configuration Supabase requise

### 1. Configurer l'URL de redirection

Dans ton **Supabase Dashboard** :

1. Va dans **Authentication** → **URL Configuration**
2. Ajoute ces URLs :

**Site URL :**
```
http://localhost:3000
```

**Redirect URLs** (ajouter les deux) :
```
http://localhost:3000/auth/callback
http://localhost:3000/**
```

### 2. Configurer le template d'email (optionnel)

Dans **Authentication** → **Email Templates** → **Magic Link** :
Tu peux personnaliser l'email envoyé aux utilisateurs.

## 🧪 Test du flow complet

### 1. Démarrer le serveur
```bash
pnpm dev
```

### 2. Tester le parcours utilisateur

**A. Login :**
- Va sur http://localhost:3000/login
- Entre ton email (celui que tu as utilisé dans Supabase)
- Clique sur "Recevoir mon lien"
- Tu devrais voir "Email envoyé !"

**B. Magic Link :**
- Va dans ta boîte mail
- Clique sur le lien dans l'email
- Tu seras redirigé vers `/auth/callback` puis `/projects`

**C. Session :**
- Rafraîchis la page → tu restes connecté ✅
- Va sur `/projects` → page accessible ✅

**D. Logout :**
- Clique sur "Se déconnecter" dans le header
- Tu es redirigé vers `/login`
- Essaie d'aller sur `/projects` → redirection vers `/login` ✅

**E. Protection :**
- Sans être connecté, essaie d'aller sur `/projects`
- Tu es automatiquement redirigé vers `/login` ✅

## ✅ Gate : Critères de validation

- [ ] Email envoyé après soumission du formulaire
- [ ] Clic sur le magic link redirige vers `/projects`
- [ ] Refresh de la page conserve la session
- [ ] Logout fonctionne et redirige vers `/login`
- [ ] Routes `/projects*` protégées (redirection vers `/login` si non connecté)
- [ ] User connecté ne peut pas accéder à `/login` (redirection vers `/projects`)

## 🐛 Troubleshooting

**Email pas reçu ?**
- Vérifie tes spams
- Vérifie que l'email est confirmé dans Supabase Auth
- En dev, Supabase peut limiter l'envoi d'emails

**Redirection ne fonctionne pas ?**
- Vérifie que les Redirect URLs sont bien configurées dans Supabase
- Vérifie que `NEXT_PUBLIC_APP_URL` est défini dans `.env.local`

**Session perdue au refresh ?**
- Vérifie que le middleware est bien configuré
- Vérifie les cookies dans les DevTools (devrait y avoir des cookies `sb-*`)
