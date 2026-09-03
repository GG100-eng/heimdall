# Heimdall

Cloudflare Pages: Framework Vite, Build command `npm run build`, Output directory `dist`, Root `/`.

## Live ranking spec

Feed Filter should `GET https://heimdall-aae.pages.dev/goals.json` (`Cache-Control: no-store`) and rank against that document, not hardcoded mock intent.

Schema:

```json
{
  "updatedAt": "ISO-8601",
  "intent": "job hunt",
  "goals": [{ "id": "goal-role", "title": "...", "detail": "...", "active": true }],
  "exclude": ["jokes", "memes"],
  "geos": ["India", "UAE"]
}
```

The PWA edits this at `/goals`. Save `POST`s `/api/goals`. That route is a Pages Function at repo-root `functions/api/goals.ts`. It commits `artifacts/heimdall/public/goals.json` on `main` through the GitHub Contents API.

Functions live at the **repo root** because Pages root is `/` and the static output is `dist`. Cloudflare looks for `functions/` next to that output directory, not inside `artifacts/heimdall`. No Wrangler `pages_build_output_dir` change is required; keep the dashboard at output `dist`.

Set a **production** Pages secret `GITHUB_TOKEN` or `GH_TOKEN` (fine-grained PAT, Contents read/write on `GG100-eng/heimdall`). Never put a token in client JS. If the binding is missing (local Vite, or Pages without the secret), the phone still writes `localStorage` and shows that publish needs the token once. After a successful publish, `GET /goals.json` is the source of truth (Pages rebuilds from the commit).
