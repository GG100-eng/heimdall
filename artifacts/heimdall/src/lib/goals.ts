export type GoalItem = {
  id: string;
  title: string;
  detail: string;
  active: boolean;
};

export type GoalsSpec = {
  updatedAt: string;
  intent: string;
  goals: GoalItem[];
  exclude: string[];
  geos: string[];
};

export const GOALS_STORAGE_KEY = 'heimdall-goals';
export const liveGoalsUrl = `${import.meta.env.BASE_URL}goals.json`;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export function normalizeGoals(value: unknown): GoalsSpec | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<GoalsSpec>;
  if (!Array.isArray(raw.goals) || !Array.isArray(raw.exclude) || !Array.isArray(raw.geos)) return null;
  const goals = raw.goals.map((item, index) => {
    const goal = item as Partial<GoalItem>;
    return {
      id: text(goal.id) || `goal-${index + 1}`,
      title: text(goal.title),
      detail: text(goal.detail),
      active: goal.active !== false,
    };
  });
  const unique = (items: unknown[]) => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const item of items) {
      const entry = text(item).trim();
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) continue;
      seen.add(key);
      next.push(entry);
    }
    return next;
  };
  return {
    updatedAt: text(raw.updatedAt) || new Date().toISOString(),
    intent: text(raw.intent).trim(),
    goals,
    exclude: unique(raw.exclude),
    geos: unique(raw.geos),
  };
}

export function newGoalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `goal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function stampGoals(spec: GoalsSpec): GoalsSpec {
  return { ...spec, updatedAt: new Date().toISOString(), intent: spec.intent.trim() };
}

export function readLocalGoals(): GoalsSpec | null {
  try {
    return normalizeGoals(JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function writeLocalGoals(spec: GoalsSpec) {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(spec));
}

export async function fetchLiveGoals(): Promise<GoalsSpec | null> {
  try {
    const response = await fetch(liveGoalsUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return normalizeGoals(await response.json());
  } catch {
    return null;
  }
}

function laterSpec(left: GoalsSpec | null, right: GoalsSpec | null): GoalsSpec | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
}

export async function loadGoals(fallback: GoalsSpec): Promise<{ spec: GoalsSpec; source: 'live' | 'local' | 'seed' }> {
  const live = await fetchLiveGoals();
  const local = readLocalGoals();
  const chosen = laterSpec(live, local);
  if (chosen === live && live) return { spec: live, source: 'live' };
  if (chosen === local && local) return { spec: local, source: 'local' };
  return { spec: fallback, source: 'seed' };
}

export type PublishResult = {
  published: boolean;
  spec: GoalsSpec;
  code?: string;
  message: string;
};

export async function publishGoals(spec: GoalsSpec): Promise<PublishResult> {
  const payload = stampGoals(spec);
  writeLocalGoals(payload);
  try {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const data: unknown = await response.json().catch(() => null);
    const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const code = typeof body.code === 'string' ? body.code : undefined;
    const returned = normalizeGoals(body.spec) ?? payload;
    if (response.ok && body.ok === true) {
      writeLocalGoals(returned);
      return {
        published: true,
        spec: returned,
        message: 'Published. Live /goals.json updates after Pages rebuilds — ranking will use it on the next weekday push.',
      };
    }
    if (code === 'missing_github_token' || response.status === 503) {
      return {
        published: false,
        spec: payload,
        code: 'missing_github_token',
        message: 'Saved on this phone. Add a GITHUB_TOKEN or GH_TOKEN secret in Cloudflare Pages so Save can publish /goals.json.',
      };
    }
    return {
      published: false,
      spec: payload,
      code: code ?? `http_${response.status}`,
      message: typeof body.error === 'string'
        ? `Saved on this phone. Publish failed: ${body.error}`
        : 'Saved on this phone. Publish needs POST /api/goals after this deploy.',
    };
  } catch {
    return {
      published: false,
      spec: payload,
      code: 'network',
      message: 'Saved on this phone. Could not reach POST /api/goals.',
    };
  }
}
