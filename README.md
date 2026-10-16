# Heimdall

A finite feed for what matters to you right now.

Heimdall takes a selected set of X posts, puts them in a focused reading experience, and gives the session an end. The session ends when you finish the list.

[Try the demo](https://heimdall-aae.pages.dev/) · [Evaluation plan](docs/evaluation-plan.md)

I’m [Gagan Gehani](https://github.com/GG100-eng). I built Heimdall to try a feed organised around what I’m working on. This repo covers the reader, the product choices and the evaluation plan.

## The problem

Finding useful information on a social feed still requires a lot of filtering. Something can be interesting without being relevant to what you're trying to do today.

Heimdall explores a simple product hypothesis: a short feed organised around a current goal can make useful information easier to act on. The current version is a personal prototype, with job search as one of its visible use cases.

## Product choices

| Choice | How it works |
| --- | --- |
| Give the session an end | A finite list ends with “You're done.” There is no infinite scroll. |
| Separate urgency from interest | Posts arrive in `now`, `serendipity` and `later` buckets. The app sorts by bucket, then recency. |
| Keep room for discovery | Serendipity has a place alongside content directly tied to the current goal. |
| Separate selection from presentation | The frontend reads a prepared `feed.json`. The selection process can change without rebuilding the reading experience. |
| Keep prototype actions local | Posts, likes, reposts and bookmarks are stored in the browser. They don't publish to X. |

## What works today

- Responsive feed and individual post views.
- Feed loading on entry and refresh, with a bundled snapshot as a fallback.
- Local posting and saved interaction state.
- Keyboard navigation: `j`, `k` and `Enter`.
- A web app manifest and icons for adding the app to a home screen.

The public repository contains the reader and prepared feed snapshots. It does not contain the upstream collection or AI ranking pipeline. Search and several navigation controls are placeholders. The [goals editor](https://github.com/GG100-eng/heimdall/pull/2) is a separate, unmerged proposal.

## Where AI fits

The useful AI task is deciding whether a post matters to a stated goal. Keyword overlap alone may miss that connection. It may also select posts that mention the right topic but offer nothing useful.

That is a hypothesis to test. The next evaluation compares chronological ordering, keyword filtering and an AI ranker on the same labelled posts. It measures useful selections, important misses, unsupported explanations, latency and cost. [Read the proposed evaluation](docs/evaluation-plan.md).

There are no published ranking benchmarks or user-study results yet.

## Run locally

Use Node.js 24 and pnpm. The workspace requires pnpm for dependency installation.

```bash
pnpm install
pnpm --filter @workspace/heimdall run dev
```

The default development port is `5173`. The feed reader uses local JSON and browser storage; it does not need an X API key or a database connection.

```bash
pnpm --filter @workspace/heimdall run typecheck
pnpm run build
```

The root build command copies the frontend output to `dist`.

For Cloudflare Pages, use repository root `/`, the Vite preset, `pnpm install` for installation, `pnpm run build` for the build and `dist` as the output directory.

## Code map

- [Feed loading, sorting and local state](artifacts/heimdall/src/App.tsx)
- [Feed and post components](artifacts/heimdall/src/components/heimdall/HeimdallUI.tsx)
- [Published feed snapshot](artifacts/heimdall/public/feed.json)
- [Bundled fallback](artifacts/heimdall/src/data/feed.json)

Built with React, TypeScript, Vite and Tailwind CSS. The broader workspace also contains an Express API scaffold and database packages; the current reader does not depend on them.
