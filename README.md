# ⚽ gamarha — Le jeu de pronostics foot

Jeu multijoueur en ligne : constitue une équipe de **3 joueurs de foot** dont la somme d'une statistique
est la plus proche possible d'une **cible mystère**. La cible, la statistique et la compétition sont
générées par une **IA générative (Groq)**, calibrée sur les vraies stats carrières.

## ✨ Fonctionnalités

- 🔎 Recherche de joueurs **réels avec photos** (via FotMob)
- 🧠 Défi généré par **Groq** : stat + compétition choisis, cible logique basée sur un **échantillon réel** du cumul carrière des joueurs de cette ligue
- ⚽ Score = **cumul carrière** d'une stat dans la compétition du défi (ex : "Buts en Premier League" = total des buts PL de toute la carrière)
- 👥 Multijoueur : **salles privées par code** + **matchmaking classé** (Elo)
- ⚡ Temps réel via **Socket.IO**
- 🏆 Classement global Elo

## 🏗 Architecture (100% gratuit)

Un backend Socket.IO a besoin d'un **process persistant** (état en mémoire + WebSockets), ce que Vercel
serverless ne fournit pas. On combine donc :

```
[React frontend — Vercel]  ←─HTTP/WS──  [Express + Socket.IO — Render free]

                                            ├─ FotMob (stats joueurs)
                                            └─ Groq   (défis IA)
```

- **Frontend** → Vercel (statique, gratuit)
- **Backend** → Render (process Node continu, plan gratuit). Comme un process singulier + état en
  mémoire, le jeu tourne exactement comme en local.

## 🚀 Démarrage en local

Prérequis : **Node 18+**, une clé **Groq** (gratuite sur console.groq.com).

```bash
# 1. Installer les dépendances (tous les workspaces)
npm install

# 2. Configurer le backend
cd server
cp .env.example .env
#   édite .env  →  GROQ_API_KEY=ta-cle-groq

# 3. Tout lancer (client + serveur)
cd ..
npm run dev
```

- Frontend → http://localhost:5173
- Backend → http://localhost:5000

> Sans clé Groq (ou si l'API est injoignable), le serveur retombe sur des défis pré-définis pour ne jamais bloquer.

## 🌍 Déploiement (gratuit)

### 1. Backend sur Render (https://render.com)

Le jeu multijoueur temps réel a besoin d'un **process qui tourne en continu** : Render free fait ça.
Son état (salles, paris, classement) est en mémoire, comme en local.

1. Pousse le repo sur GitHub.
2. Sur Render → **New → Web Service** → connecte le repo → choisis `/server` comme **Root Directory**.
3. **Runtime** : Node. **Build Command** : `npm install` — **Start Command** : `npm start`.
4. Ajoute les variables d'environnement :
   - `GROQ_API_KEY` = ta clé Groq
   - `GROQ_MODEL` = `openai/gpt-oss-120b`
   - `CLIENT_ORIGINS` = l'URL Vercel du frontend (ex : `https://gamarha.vercel.app`)
   - `FOTMOB_BASE_URL` = `https://www.fotmob.com`
5. Render te donne une URL type `https://gamarha-server.onrender.com`. **Copie-la.**

> ⚠️ Plan free Render : le service **« dort » après 15 min sans activité** ; la première connexion peut
> prendre 30–60 s (cold start), puis tout est normal.

### 2. Frontend sur Vercel (https://vercel.com)

1. Sur Vercel → **Add New → Project** → importe le même repo.
2. **Root Directory** : `client`. **Framework** : Vite. **Build** : `npm run build`, **Output** : `dist`.
3. Variable d'environnement : `VITE_API_URL` = l'URL du backend Render (ex : `https://gamarha-server.onrender.com`).
4. Déploie → tu obtiens `https://gamarha.vercel.app` (ou auto).

Ton jeu est en ligne : le front Vercel parle au backend Render via REST (recherche) + WebSocket (salle),
exactement comme en local.

## 🔌 API

| Méthode | Route                         | Description |
|---------|-------------------------------|-------------|
| GET     | `/api/health`                 | Santé du serveur |
| GET     | `/api/players/search?name=`   | Recherche de joueurs (photos) |
| GET     | `/api/players/:id/stats`      | Stats d'un joueur |
| GET     | `/api/challenges/random`      | Génère un défi IA |
| POST    | `/api/rooms/create`           | Crée une salle |
| GET     | `/api/rooms/:code`            | Détails d'une salle |

### Événements Socket.IO

| Événement          | Direction  | Usage |
|--------------------|-----------|-------|
| `room:create`      | client→hôte | Créer la salle |
| `room:join`        | client→hôte | Rejoindre par code |
| `room:start`       | client→hôte | Lancer la manche (hôte) |
| `bet:place`        | client→hôte | Poster un pronostic (3 joueurs) |
| `room:leave`       | client→hôte | Quitter |
| `room:sync`        | client→hôte | Resynchro (refresh) |
| `challenge`        | hôte→client | Le défi généré |
| `phase`            | hôte→client | Changement de phase |
| `bet:progress`     | hôte→client | Compteur de paris |
| `reveal`           | hôte→client | Résultats + classement |

## 🔐 Notes sécurité / limites

- Les clés (Groq) et origins CORS sont côté **serveur** uniquement, jamais dans le client.
- Le client ne voit que des endpoints sûrs (recherche, stats).
- Le `leaderboard`, les salles et les paris sont **en mémoire** (pas de persistance) : ils disparaissent si
  le backend redémarre. Pour une persistance longue durée, ajouter Redis/Postgres.
- Plan Render free : cold start de 15 min d'inactivité (voir ci-dessus).