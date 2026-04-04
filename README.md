# Altered Deck Builder Poc

A deck builder web application for the **Altered TCG** card game, built with Next.js 15, React 19, TypeScript and Tailwind CSS v4.

## Features

- Browse cards via the API (filters by faction, type, cost, set, rarity)
- Build decks with format-aware validation (Standard, NUC, Singleton)
- Save and manage decks (create, edit, delete)
- Import an existing deck from the API
- Light / dark mode

## Requirements

- Node.js >= 18
- npm >= 9

## Local setup (development)

### 1. Clone the repository

```bash
git clone git@github.com:Altered-Community/altered-deckbuilder-poc-v2.git
cd altered-deckbuilder-poc-v2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.local.example .env.local
```

`.env.local` content:

```env
NEXT_PUBLIC_API_URL=https://altered-core-cards-api.toxicity.be/api
NEXT_PUBLIC_DECK_API_URL=https://altered-core-decks-api.toxicity.be/api
```

> Both variables can point to local instances if you are running the APIs locally, e.g. `http://localhost:8000/api`.

### 4. Start the development server

```bash
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

---

## Server deployment (production)

### 1. Install Node.js

```bash
# Using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

### 2. Clone and install

```bash
git clone git@github.com:Altered-Community/altered-deckbuilder-poc-v2.git
cd /var/www/altered-deckbuilder-poc-v2
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
nano .env.local
```

Set the production URLs for both APIs.

### 4. Build the application

```bash
npm run build
```

### 5. Start in production

```bash
npm run start
```

The app listens on port **3000** by default. To change the port:

```bash
PORT=8080 npm run start
```

### 6. Reverse proxy with Nginx (recommended)

An `nginx.conf.example` file is provided at the root of the project. To use it:

```bash
# Copy the config to sites-available
cp nginx.conf.example /etc/nginx/sites-available/altered-deckbuilder-poc-v2

# Replace your-domain.com with your actual domain
nano /etc/nginx/sites-available/altered-deckbuilder-poc-v2

# Enable the site
ln -s /etc/nginx/sites-available/altered-deckbuilder-poc-v2 /etc/nginx/sites-enabled/

# Test and reload
nginx -t && systemctl reload nginx
```

Enable HTTPS with Certbot:

```bash
certbot --nginx -d your-domain.com
```

Certbot will automatically update the config to enable the HTTPS block and redirect HTTP.

### 7. Process management with PM2 (recommended)

```bash
npm install -g pm2
pm2 start npm --name "altered-deckbuilder-poc-v2" -- start
pm2 save
pm2 startup
```

To redeploy after an update:

```bash
git pull
npm install
npm run build
pm2 restart altered-deckbuilder-poc-v2
```

---

## Environment variables

| Variable                   | Description              | Example                                          |
|----------------------------|--------------------------|--------------------------------------------------|
| `NEXT_PUBLIC_API_URL`      | Cards API base URL       | `https://altered-core-cards-api.toxicity.be/api` |
| `NEXT_PUBLIC_DECK_API_URL` | Decks API base URL       | `htps://altered-core-decks-api.toxicity.be/api`  |

> The `NEXT_PUBLIC_` prefix exposes these variables client-side. Never store secrets in them.

---

## Project structure

```
app/              # Next.js pages (App Router)
  deck/           # Deck editor
  decks/          # Deck list, detail and import
components/       # React components
  cards/          # Card browser and card item
  deck/           # Deck panel, stats, save button
lib/
  api/            # API calls (cardApi, deckApi)
  types/          # TypeScript interfaces (card, deck, constants)
  utils/          # Utilities (card, format)
store/            # Global Zustand state (deckStore, authStore)
```

## Tech stack

- [Next.js 15](https://nextjs.org/) — App Router
- [React 19](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [TanStack Query v5](https://tanstack.com/query) — data fetching
- [Zustand v5](https://zustand-demo.pmnd.rs/) — state management
- [next-themes](https://github.com/pacocoursey/next-themes) — dark/light mode
