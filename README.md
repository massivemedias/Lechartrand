# Le Chartrand 🃏

**Rami 500 - Multijoueur en temps réel**

## 🎮 Jouer

**Solo:** https://massivemedias.github.io/Lechartrand/

**Multijoueur:** Nécessite configuration Firebase (voir ci-dessous)

## 🔥 Configuration Firebase (Multijoueur)

1. Créer un projet sur [Firebase Console](https://console.firebase.google.com)

2. Activer **Realtime Database**:
   - Build → Realtime Database → Create Database
   - Choisir une région
   - Démarrer en **test mode** (ou configurer les règles)

3. Ajouter une **Web App**:
   - Project Settings → Add app → Web
   - Copier la configuration

4. Modifier `src/firebaseConfig.js`:
```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "votre-projet.firebaseapp.com",
  databaseURL: "https://votre-projet-default-rtdb.firebaseio.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. **Règles Database** (optionnel mais recommandé):
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

6. Variables d'environnement (optionnel pour GitHub Actions):
   - Settings → Secrets → Actions
   - Ajouter: `VITE_FIREBASE_API_KEY`, etc.

## 🎯 Règles du Rami 500

### Objectif
Premier à 500 points en posant des combinaisons.

### Les Frimes (Wild Cards)
- **2** et **Jokers** = 20 points, remplacent n'importe quelle carte

### Combinaisons
- **Brelan/Carré**: 3-4 cartes même valeur
- **Suite**: 3+ cartes consécutives même couleur

### Points
- As: 15 | Figures: 10 | 3-9: valeur | Frimes: 20

### Tour de jeu
1. Piocher (talon ou défausse)
2. Poser combinaisons
3. Défausser

## 🛠️ Développement

```bash
npm install
npm run dev
```

## 📦 Déploiement

Push sur `main` → GitHub Actions déploie automatiquement.

---
Créé par [Massive Medias](https://massivemedias.com) • Montréal
