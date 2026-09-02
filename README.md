# Heimdall

Cloudflare Pages: Framework Vite, Build command `npm run build`, Output directory `dist`, Root `/`.

Pages Functions live in `/functions` at the repo root (next to `dist`, not inside `artifacts/heimdall`). `POST /api/goals` commits `artifacts/heimdall/public/goals.json` on `main` via the GitHub Contents API. Ranking should `GET /goals.json` with `cache: no-store`.

Set a Cloudflare Pages secret `GITHUB_TOKEN` or `GH_TOKEN` with `contents:write` on this repo so phone Save can publish. Optional: `GITHUB_REPO` (default `GG100-eng/heimdall`), `GITHUB_BRANCH` (default `main`).
