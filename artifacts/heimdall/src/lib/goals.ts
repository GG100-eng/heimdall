export type GoalItem = {
  id: string;
  title: string;
  detail: string;
  active: boolean;
};

export type GoalsDocument = {
  updatedAt: string;
  intent: string;
  goals: GoalItem[];
  exclude: string[];
  geos: string[];
};

export const GOALS_URL = `${import.meta.env.BASE_URL}goals.json`;
export const GOALS_API_URL = `${import.meta.env.BASE_URL}api/goals`;
export const GOALS_STORAGE_KEY = 'heimdall-goals';
export const GOALS_UNPUBLISHED_KEY = 'heimdall-goals-unpublished';

export const DEFAULT_GOALS: GoalsDocument = {
  updatedAt: '2026-09-02T18:00:00.000Z',
  intent: 'job hunt',
  goals: [
    {
      id: 'goal-role',
      title: 'Land an excellent senior / founding / product-lead role',
      detail: 'AI, crypto/Web3, or consumer tech. Geos: India, UAE, Singapore, Malaysia, Japan, plus compatible remote.',
      active: true,
    },
    {
      id: 'goal-health',
      title: 'Get leaner while keeping or building muscle',
      detail: 'Vegetarian high-protein meals (India ingredients), resistance training, walking, recovery, sleep. Consistency over extreme intensity.',
      active: true,
    },
    {
      id: 'goal-proof',
      title: 'Build public proof of work',
      detail: 'AI agents, personal AI, browser agents, recsys, consumer AI, AI video, crypto/onchain, social/creator tools, intentional tech.',
      active: true,
    },
    {
      id: 'goal-network',
      title: 'Grow a professional network',
      detail: 'Founders, PMs, recruiters, engineers, researchers, builders, investors — when there is a concrete reason to know them.',
      active: true,
    },
  ],
  exclude: [
    'jokes',
    'memes',
    'politics/policy',
    'outrage',
    'internships',
    'beginner career bait',
    'generic fitness motivation',
    'ads',
  ],
  geos: ['India', 'UAE', 'Singapore', 'Malaysia', 'Japan', 'remote'],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function isGoalsDocument(value: unknown): value is GoalsDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<GoalsDocument>;
  if (typeof doc.intent !== 'string' || !Array.isArray(doc.goals) || !Array.isArray(doc.exclude)) return false;
  return doc.goals.every((goal) => (
    goal
    && typeof goal === 'object'
    && typeof goal.id === 'string'
    && typeof goal.title === 'string'
    && typeof goal.active === 'boolean'
  ));
}

export function normalizeGoals(value: unknown, updatedAt = new Date().toISOString()): GoalsDocument | null {
  if (!isGoalsDocument(value)) return null;
  return {
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : updatedAt,
    intent: value.intent.trim(),
    goals: value.goals.map((goal) => ({
      id: goal.id,
      title: goal.title.trim(),
      detail: typeof goal.detail === 'string' ? goal.detail.trim() : '',
      active: goal.active,
    })),
    exclude: asStringArray(value.exclude),
    geos: asStringArray(value.geos),
  };
}

export function cloneGoals(doc: GoalsDocument): GoalsDocument {
  return {
    updatedAt: doc.updatedAt,
    intent: doc.intent,
    goals: doc.goals.map((goal) => ({ ...goal })),
    exclude: [...doc.exclude],
    geos: [...doc.geos],
  };
}

export function newGoalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `goal-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `goal-${Date.now().toString(36)}`;
}

export function emptyGoal(): GoalItem {
  return { id: newGoalId(), title: '', detail: '', active: true };
}

export function readLocalGoals(): GoalsDocument | null {
  try {
    return normalizeGoals(JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function writeLocalGoals(doc: GoalsDocument, unpublished: boolean) {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(doc));
  if (unpublished) localStorage.setItem(GOALS_UNPUBLISHED_KEY, '1');
  else localStorage.removeItem(GOALS_UNPUBLISHED_KEY);
}

export function hasUnpublishedGoals(): boolean {
  return localStorage.getItem(GOALS_UNPUBLISHED_KEY) === '1';
}

export async function fetchGoalsDocument(): Promise<GoalsDocument | null> {
  try {
    const response = await fetch(GOALS_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    return normalizeGoals(await response.json());
  } catch {
    return null;
  }
}

export type PublishResult =
  | { ok: true; doc: GoalsDocument }
  | { ok: false; reason: 'missing_token' | 'invalid_body' | 'github_error' | 'network'; message: string };

export async function publishGoals(doc: GoalsDocument): Promise<PublishResult> {
  const payload: GoalsDocument = {
    ...doc,
    intent: doc.intent.trim(),
    goals: doc.goals
      .map((goal) => ({ ...goal, title: goal.title.trim(), detail: goal.detail.trim() }))
      .filter((goal) => goal.title.length > 0),
    exclude: doc.exclude.map((item) => item.trim()).filter(Boolean),
    geos: doc.geos.map((item) => item.trim()).filter(Boolean),
  };

  try {
    const response = await fetch(GOALS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const data: unknown = await response.json().catch(() => null);
    const error = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '';
    if (response.ok && data && typeof data === 'object' && 'ok' in data && (data as { ok: unknown }).ok === true) {
      const live = await fetchGoalsDocument();
      const next = live ?? normalizeGoals({ ...payload, updatedAt: new Date().toISOString() }) ?? payload;
      writeLocalGoals(next, false);
      return { ok: true, doc: next };
    }
    const reason = error === 'missing_token' || error === 'invalid_body' || error === 'github_error' ? error : 'missing_token';
    writeLocalGoals({ ...payload, updatedAt: new Date().toISOString() }, true);
    const message = data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
      ? (data as { message: string }).message
      : 'Publish needs GITHUB_TOKEN on Cloudflare Pages.';
    return { ok: false, reason: response.status === 400 ? 'invalid_body' : reason, message };
  } catch {
    writeLocalGoals({ ...payload, updatedAt: new Date().toISOString() }, true);
    return { ok: false, reason: 'network', message: 'Saved on this device. Publishing to /goals.json needs GITHUB_TOKEN on Cloudflare Pages.' };
  }
}

export async function loadGoalsDocument(): Promise<{ doc: GoalsDocument; unpublished: boolean; from: 'remote' | 'local' | 'seed' }> {
  const local = readLocalGoals();
  const unpublished = hasUnpublishedGoals();
  const remote = await fetchGoalsDocument();
  if (unpublished && local) return { doc: local, unpublished: true, from: 'local' };
  if (remote) {
    writeLocalGoals(remote, false);
    return { doc: remote, unpublished: false, from: 'remote' };
  }
  if (local) return { doc: local, unpublished, from: 'local' };
  return { doc: cloneGoals(DEFAULT_GOALS), unpublished: false, from: 'seed' };
}
