# Momento

Momento is a single-page marketing splash screen built with Vue 3 + Vite. The goal of this repo is to keep a minimal, easy-to-run frontend that communicates the core product message without extra routing, stores, or API wiring.

## Stack

- ⚡️ Vue 3 + `<script setup>`
- 🧱 TypeScript
- 🛠️ Vite build tooling
- 🎨 PostCSS + CSS modules built by Vite

## Getting Started

1. Install Node.js 18+ / npm 9+
2. Clone the repo and install dependencies:

   ```sh
   git clone <repo-url>
   cd momento-frontend
   npm install
   ```

3. Configure backend URL (optional):

   Create a `.env` file in the root directory to set your backend URL:
   
   ```sh
   VITE_BACKEND_URL=http://localhost:8000
   ```
   
   If not set, the default is `http://localhost:8000`. The Vite dev server will proxy all `/api` requests to this backend URL.

4. Start the dev server:

   ```sh
   npm run dev
   ```

5. Visit the URL printed in the terminal (defaults to `http://localhost:5173`).

## Scripts

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start Vite dev server with HMR             |
| `npm run build` | Type-check and output production bundle    |
| `npm run preview` | Preview the production build locally    |

## Project Structure

```
momento-frontend/
├── public/            # Static assets (copied as-is)
├── src/
│   ├── assets/        # Images, fonts, etc.
│   ├── App.vue        # Single home page
│   ├── main.ts        # Vue entry point
│   └── style.css      # Global styles
├── index.html         # Root HTML template
├── package.json
└── vite.config.ts
```

## Deployment

1. Run `npm run build`
2. Deploy the contents of `dist/` to your hosting provider (Netlify, Vercel, S3, etc.)

## Editor Tips

- Use VS Code with Volar enabled (and Vetur disabled) for `.vue` type awareness.
- Turn on ESLint/Prettier integrations to keep formatting consistent.

## Type Support

`vue-tsc` backs type-checking for `.vue` files. Run `npm run build` (or invoke `vue-tsc --noEmit`) to surface type errors before deploying.