const DEFAULT_REPO = 'GG100-eng/heimdall';
const DEFAULT_BRANCH = 'main';
const GOALS_PATH = 'artifacts/heimdall/public/goals.json';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      allow: 'POST, OPTIONS',
    },
  });
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function uniqueStrings(items) {
  const seen = new Set();
  const next = [];
  for (const item of items) {
    const entry = text(item).trim();
    const key = entry.toLowerCase();
    if (!entry || seen.has(key)) continue;
    seen.add(key);
    next.push(entry);
  }
  return next;
}

export function normalizeGoals(value) {
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value.goals) || !Array.isArray(value.exclude) || !Array.isArray(value.geos)) return null;
  const goals = value.goals.map((item, index) => ({
    id: text(item?.id) || `goal-${index + 1}`,
    title: text(item?.title).trim(),
    detail: text(item?.detail).trim(),
    active: item?.active !== false,
  }));
  if (goals.some((goal) => !goal.id || !goal.title)) return null;
  const ids = new Set();
  for (const goal of goals) {
    if (ids.has(goal.id)) return null;
    ids.add(goal.id);
  }
  return {
    updatedAt: text(value.updatedAt) || new Date().toISOString(),
    intent: text(value.intent).trim(),
    goals,
    exclude: uniqueStrings(value.exclude),
    geos: uniqueStrings(value.geos),
  };
}

export function encodeContent(raw) {
  const bytes = new TextEncoder().encode(raw);
  const chunk = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'heimdall-pages-goals',
  };
}

function contentsUrl(repo, path, branch) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${repo}/contents/${encoded}`;
  return branch ? `${url}?ref=${encodeURIComponent(branch)}` : url;
}

async function readGithubJson(response) {
  const data = await response.json().catch(() => ({}));
  return data && typeof data === 'object' ? data : {};
}

export async function commitGoalsFile({ token, repo, branch, spec, githubFetch = fetch }) {
  const body = `${JSON.stringify(spec, null, 2)}\n`;
  const content = encodeContent(body);
  const getResponse = await githubFetch(contentsUrl(repo, GOALS_PATH, branch), {
    headers: githubHeaders(token),
  });
  const current = await readGithubJson(getResponse);
  if (getResponse.status === 200 && typeof current.content === 'string' && typeof current.sha === 'string') {
    const existing = current.content.replace(/\n/g, '');
    if (existing === content) {
      return { unchanged: true, sha: current.sha, spec };
    }
  } else if (getResponse.status !== 404) {
    const message = typeof current.message === 'string' ? current.message : `GitHub GET failed (${getResponse.status})`;
    return { error: message, status: getResponse.status === 401 || getResponse.status === 403 ? 502 : 502 };
  }

  const putOnce = async (sha) => {
    const payload = {
      message: 'Update goals.json from Heimdall',
      content,
      branch,
      sha,
    };
    if (!sha) delete payload.sha;
    return githubFetch(contentsUrl(repo, GOALS_PATH), {
      method: 'PUT',
      headers: { ...githubHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  let sha = typeof current.sha === 'string' ? current.sha : undefined;
  let putResponse = await putOnce(sha);
  if (putResponse.status === 409 || putResponse.status === 422) {
    const retryGet = await githubFetch(contentsUrl(repo, GOALS_PATH, branch), { headers: githubHeaders(token) });
    const retryBody = await readGithubJson(retryGet);
    sha = typeof retryBody.sha === 'string' ? retryBody.sha : undefined;
    putResponse = await putOnce(sha);
  }
  const putBody = await readGithubJson(putResponse);
  if (!putResponse.ok) {
    const message = typeof putBody.message === 'string' ? putBody.message : `GitHub PUT failed (${putResponse.status})`;
    return { error: message, status: 502 };
  }
  return {
    unchanged: false,
    sha: putBody.content?.sha ?? sha,
    commitSha: putBody.commit?.sha,
    spec,
  };
}

export async function handleGoalsPost(request, env, githubFetch = fetch) {
  const origin = request.headers.get('origin');
  if (origin) {
    const url = new URL(request.url);
    if (origin !== url.origin) return json(403, { ok: false, code: 'forbidden', error: 'Origin mismatch' });
  }

  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    return json(503, {
      ok: false,
      code: 'missing_github_token',
      error: 'Set a GITHUB_TOKEN or GH_TOKEN secret on this Cloudflare Pages project with contents:write.',
    });
  }

  let parsed;
  try {
    parsed = await request.json();
  } catch {
    return json(400, { ok: false, code: 'invalid_json', error: 'Body must be JSON' });
  }

  const spec = normalizeGoals(parsed);
  if (!spec) {
    return json(400, {
      ok: false,
      code: 'invalid_spec',
      error: 'Expected { intent, goals: [{id, title, detail, active}], exclude, geos }',
    });
  }
  spec.updatedAt = new Date().toISOString();

  const repo = (env.GITHUB_REPO || DEFAULT_REPO).replace(/^\/+|\/+$/g, '');
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return json(500, { ok: false, code: 'bad_repo', error: 'GITHUB_REPO must be owner/name' });
  }

  const result = await commitGoalsFile({ token, repo, branch, spec, githubFetch });
  if (result.error) {
    return json(result.status ?? 502, { ok: false, code: 'github_error', error: result.error });
  }
  return json(200, {
    ok: true,
    published: true,
    unchanged: Boolean(result.unchanged),
    commitSha: result.commitSha ?? null,
    spec: result.spec,
  });
}

export async function onRequestPost(context) {
  return handleGoalsPost(context.request, context.env);
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    },
  });
}

export function onRequestGet() {
  return json(405, {
    ok: false,
    code: 'method_not_allowed',
    error: 'Use GET /goals.json for the ranking spec. POST this route to publish.',
  });
}
