# Fun Game - Baby Sleep Timer

A baby sleep tracking app built with **React on Vite** and styled with **Tailwind CSS**.

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework for styling

## Run locally

```bash
npm install
npm run dev
```

Open the shown URL (usually http://localhost:5173).

## Deploy: GitHub Pages (recommended)
This repo includes a GitHub Actions workflow that builds and deploys to Pages on every push to `main`.

Steps:
1. Create a GitHub repo and push this folder as the default branch `main`.
2. In GitHub → Settings → Pages:
   - Source: "GitHub Actions".
3. Push to `main`. The workflow `Deploy to GitHub Pages` will run and publish.
4. Your site will be available at:
   - `https://<your-username>.github.io/<repo-name>/`

Notes:
- The build sets Vite `base` automatically using `--base=/repo-name/` via env, so no manual config is needed.

## Deploy: Vercel (one-click)
1. Push this project to GitHub.
2. In Vercel, click New Project → Import your repo.
3. Framework preset: Vite (auto). Build: `vite build`. Output: `dist/` (auto).
4. Deploy. You get a live URL in ~1 min.

`vercel.json` is included for clean static build and SPA routing.

