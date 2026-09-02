/**
 * POST /api/goals
 *
 * Lives at repo-root `functions/` because this Cloudflare Pages project uses
 * Root `/` and Output `dist`. Pages bundles Functions from a `functions/`
 * directory next to that output, not from `artifacts/heimdall`.
 *
 * Commits `artifacts/heimdall/public/goals.json` on `main` via the GitHub
 * Contents API. Set `GITHUB_TOKEN` or `GH_TOKEN` as a Pages production secret.
 * Never put a token in client JS.
 */

type GoalItem = {
  id: string;
  title: string;
  detail: string;
  active: boolean;
};

type GoalsDocument = {
  updatedAt: string;
  intent: string;
  goals: GoalItem[];
  exclude: string[];
  geos: string[];
};

type Env = {
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const FILE_PATH = 'artifacts/heimdall/public/goals.json';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_INTENT = 280;
const MAX_TITLE = 200;
const MAX_DETAIL = 2000;
const MAX_GOALS = 50;
const MAX_TAGS = 50;
const MAX_TAG = 80;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringList(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value)) return [];
  if (value.length > maxItems) return null;
  const next: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_TAG) return null;
    next.push(trimmed);
  }
  return next;
}

function parseDocument(value: unknown): GoalsDocument | string {
  if (!value || typeof value !== 'object') return 'Body must be a JSON object.';
  const input = value as Record<string, unknown>;
  const intent = asTrimmedString(input.intent);
  if (!intent) return 'Intent is required.';
  if (intent.length > MAX_INTENT) return 'Intent is too long.';
  if (!Array.isArray(input.goals)) return 'goals must be an array.';
  if (input.goals.length > MAX_GOALS) return 'Too many goals.';

  const goals: GoalItem[] = [];
  for (const item of input.goals) {
    if (!item || typeof item !== 'object') return 'Each goal must be an object.';
    const goal = item as Record<string, unknown>;
    const title = asTrimmedString(goal.title);
    if (!title) continue;
    if (title.length > MAX_TITLE) return 'A goal title is too long.';
    const detail = asTrimmedString(goal.detail);
    if (detail.length > MAX_DETAIL) return 'A goal detail is too long.';
    const id = asTrimmedString(goal.id) || `goal-${goals.length + 1}`;
    if (typeof goal.active !== 'boolean') return 'Each goal needs an active boolean.';
    goals.push({ id, title, detail, active: goal.active });
  }

  const exclude = asStringList(input.exclude, MAX_TAGS);
  if (exclude === null) return 'exclude must be a short string list.';
  const geos = asStringList(input.geos ?? [], MAX_TAGS);
  if (geos === null) return 'geos must be a short string list.';

  return {
    updatedAt: new Date().toISOString(),
    intent,
    goals,
    exclude,
    geos,
  };
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function githubJson(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'heimdall-goals',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body: body && typeof body === 'object' ? body as Record<string, unknown> : null };
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } });
  }
  if (context.request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed', message: 'POST JSON to publish /goals.json.' }, 405);
  }

  const token = context.env.GITHUB_TOKEN || context.env.GH_TOKEN;
  if (!token) {
    return json({
      ok: false,
      error: 'missing_token',
      message: 'Publish needs GITHUB_TOKEN or GH_TOKEN on Cloudflare Pages.',
    }, 503);
  }

  const raw = await context.request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'too_large', message: 'Goals document is too large.' }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return json({ ok: false, error: 'invalid_body', message: 'Body must be JSON.' }, 400);
  }

  const document = parseDocument(parsed);
  if (typeof document === 'string') {
    return json({ ok: false, error: 'invalid_body', message: document }, 400);
  }

  const repo = context.env.GITHUB_REPO || 'GG100-eng/heimdall';
  const branch = context.env.GITHUB_BRANCH || 'main';
  const apiBase = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const content = utf8ToBase64(serialized);

  const existing = await githubJson(token, `${apiBase}?ref=${encodeURIComponent(branch)}`);
  const sha = existing.status === 200 && typeof existing.body?.sha === 'string' ? existing.body.sha : undefined;

  const putOnce = (fileSha?: string) => githubJson(token, apiBase, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update goals.json from Heimdall',
      content,
      branch,
      ...(fileSha ? { sha: fileSha } : {}),
    }),
  });

  let result = await putOnce(sha);
  if (result.status === 409 || result.status === 422) {
    const retry = await githubJson(token, `${apiBase}?ref=${encodeURIComponent(branch)}`);
    const retrySha = retry.status === 200 && typeof retry.body?.sha === 'string' ? retry.body.sha : undefined;
    result = await putOnce(retrySha);
  }

  if (result.status >= 200 && result.status < 300) {
    return json({ ok: true, updatedAt: document.updatedAt, published: true });
  }

  const githubMessage = typeof result.body?.message === 'string' ? result.body.message : 'GitHub Contents API rejected the write.';
  return json({ ok: false, error: 'github_error', message: githubMessage }, 502);
}
