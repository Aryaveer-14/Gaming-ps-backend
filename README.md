# Pokémon FireRed — Multiplayer Battle Backend

A real-time 1v1 PvP battle system built with Node.js, Socket.io, Prisma (PostgreSQL), and Redis.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express + TypeScript |
| Real-time | Socket.io (WebSockets) |
| Database | PostgreSQL (via Docker) |
| ORM | Prisma |
| Cache / Battle State | Redis (via Docker) |
| Auth | JWT (JSON Web Tokens) |
| Client | React + Vite + Zustand + TailwindCSS |

---

## Project Structure

```
Gaming-ps-backend/
├── client/               # React frontend (Vite)
│   └── src/
│       ├── components/   # LoginPage, LobbyPage, BattleUI
│       ├── store/        # authStore, battleStore (Zustand)
│       └── lib/          # battleSocket.ts (Socket.io client)
├── server/               # Express + Socket.io backend
│   ├── src/
│   │   ├── data/         # creatures.ts — 5 creatures, 17 moves
│   │   ├── engine/       # battleEngine.ts — damage, type chart, turn logic
│   │   ├── lib/          # prisma.ts, redis.ts singletons
│   │   ├── middleware/   # auth.ts — JWT verify
│   │   ├── namespaces/   # battle.ts — Socket.io /battle namespace
│   │   └── routes/       # auth.ts — POST /auth/register, /auth/login
│   ├── prisma/
│   │   ├── schema.prisma # DB schema
│   │   └── seed.ts       # Seeds creatures + moves into DB
│   └── .env              # ⚠️ NOT committed — copy from .env.example
├── docker-compose.yml    # Postgres + Redis containers
└── package.json          # Root — runs both workspaces concurrently
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- npm v9+

---

## First-Time Setup

### 1. Clone the repo
```bash
git clone <repo-url>
cd Gaming-ps-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start Docker (Postgres + Redis)
Make sure **Docker Desktop is open**, then:
```bash
docker-compose up -d
```
This starts:
- **PostgreSQL** on port `5432` — user: `pokemon`, password: `pokemon`, db: `pokemondb`
- **Redis** on port `6379`

### 4. Create your `.env` file
```bash
cp .env.example server/.env
```

Then open `server/.env` and make sure it looks exactly like this:
```env
DATABASE_URL="postgresql://pokemon:pokemon@localhost:5432/pokemondb?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change_this_to_any_long_random_string"
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

> ⚠️ The credentials **must match** what's in `docker-compose.yml`. Do not change the Docker credentials without updating `.env` too.

### 5. Push the DB schema + seed data
```bash
cd server
npx prisma generate
npx prisma db push
npm run seed
cd ..
```

You should see:
```
✅ Seeded 17 moves
✅ Seeded 5 creatures with moves
🎉 Database seeded successfully!
```

### 6. Start the dev server
```bash
npm run dev
```
This starts **both** server and client concurrently:
- Server → `http://localhost:3001`
- Client → `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## Database

### Schema overview

| Table | Purpose |
|---|---|
| `User` | Accounts — username, email, hashed password |
| `Creature` | Master list of 5 creatures (Fire/Water/Grass/Electric/Normal/Ground types) |
| `Move` | Master list of 17 moves with power, accuracy, PP, effect |
| `CreatureMove` | Many-to-many join — which moves each creature can learn |
| `PlayerCreature` | A player's owned creature — tracks level, HP, XP, isLead |
| `InventoryItem` | Reserved for future items |
| `BattleResult` | Persisted battle history — winner, XP awarded, turns count |

### Key rules
- Every new user gets **one starter creature** (Flameling, Fire-type, Lv.5) automatically on registration
- The `isLead = true` creature is the one used in battle
- Battle state (live HP, pending moves, turn timers) lives in **Redis**, not the DB, for speed
- After a battle ends, the result is written to `BattleResult` and XP is persisted to `PlayerCreature`

### Running migrations
If you change `schema.prisma`:
```bash
cd server
npx prisma db push        # push changes to DB (dev only)
npx prisma generate       # regenerate Prisma client
```

---

## Authentication

Auth uses **JWT (JSON Web Tokens)**.

### How it works
1. `POST /auth/register` — creates a user, hashes password with bcrypt, returns a JWT
2. `POST /auth/login` — verifies credentials, returns a JWT
3. The client stores the JWT in **localStorage** via Zustand persist
4. REST requests send it as `Authorization: Bearer <token>`
5. Socket.io connections send it in `socket.handshake.auth.token`

### JWT payload
```json
{ "userId": "cuid...", "username": "ash" }
```

### Token expiry
Tokens expire after **7 days**. Users need to log in again after expiry.

### Secret key
The `JWT_SECRET` in `.env` can be any random string. For production use a long random value like:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Real-time Battle System

Battle state is managed entirely over **Socket.io** on the `/battle` namespace.

### Events (Client → Server)
| Event | Payload | Description |
|---|---|---|
| `battle-request` | `{ targetUserId }` | Challenge another online player |
| `battle-accept` | `{ fromUserId }` | Accept an incoming challenge |
| `battle-decline` | `{ fromUserId }` | Decline a challenge |
| `battle-action` | `{ moveId }` | Submit your move for the current turn |
| `forfeit` | — | Forfeit the current battle |

### Events (Server → Client)
| Event | Description |
|---|---|
| `battle-incoming` | Someone challenged you |
| `battle-start` | Battle accepted, initial state |
| `battle-update` | Turn resolved — new HP, battle log |
| `battle-end` | Battle over — winner, XP, reason |
| `opponent-disconnected` | Opponent lost connection (15s grace) |
| `battle-error` | Something went wrong |

### Turn timer
Each turn has a **30-second timer**. If only one player submits a move, the idle player loses.

---

## Running Tests
```bash
cd server && npm test
```
17 unit tests covering the battle engine (damage calc, type chart, status effects, turn resolution).

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `EADDRINUSE :::3001` | Port already in use | `lsof -ti:3001 \| xargs kill -9` |
| `Authentication failed against database server` | Wrong DB credentials in `.env` | Make sure `DATABASE_URL` uses `pokemon:pokemon@localhost:5432/pokemondb` |
| `DATABASE_URL must start with postgresql://` | Malformed `.env` (e.g. `DATABASE_URL=DATABASE_URL=...`) | Open `server/.env` and fix line 1 to be just `DATABASE_URL="postgresql://..."` |
| `Player is not online` (battle error) | Target user not connected via socket | Both players must be on the lobby page at the same time |
| Redis connection error | Docker not running | Start Docker Desktop, then `docker-compose up -d` |

---

## Environment Variables Reference

All variables live in `server/.env` (never committed to git).

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://pokemon:pokemon@localhost:5432/pokemondb?schema=public` | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `any_long_random_string` | Signs/verifies JWTs |
| `PORT` | `3001` | Server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
