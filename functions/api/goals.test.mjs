import assert from 'node:assert/strict';
import {
  commitGoalsFile,
  encodeContent,
  handleGoalsPost,
  normalizeGoals,
} from './goals.js';

const spec = {
  updatedAt: '2026-09-02T18:00:00.000Z',
  intent: 'job hunt',
  goals: [{ id: 'role', title: 'Land the role', detail: '', active: true }],
  exclude: ['memes', 'memes', ' jokes '],
  geos: ['India', 'remote'],
};

const normalized = normalizeGoals(spec);
assert.equal(normalized.intent, 'job hunt');
assert.deepEqual(normalized.exclude, ['memes', 'jokes']);
assert.equal(normalizeGoals({ intent: 'x' }), null);
assert.equal(normalizeGoals({ ...spec, goals: [{ id: 'role', title: '', detail: '', active: true }] }), null);

const missing = await handleGoalsPost(
  new Request('https://heimdall-aae.pages.dev/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://heimdall-aae.pages.dev' },
    body: JSON.stringify(spec),
  }),
  {},
);
assert.equal(missing.status, 503);
assert.equal((await missing.json()).code, 'missing_github_token');

const forbidden = await handleGoalsPost(
  new Request('https://heimdall-aae.pages.dev/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify(spec),
  }),
  { GITHUB_TOKEN: 'token' },
);
assert.equal(forbidden.status, 403);

const puts = [];
const githubFetch = async (url, init = {}) => {
  if (init.method === 'PUT') {
    puts.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ content: { sha: 'new-sha' }, commit: { sha: 'commit-sha' } }), { status: 200 });
  }
  return new Response(JSON.stringify({ sha: 'old-sha', content: encodeContent('stale') }), { status: 200 });
};

const published = await handleGoalsPost(
  new Request('https://heimdall-aae.pages.dev/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://heimdall-aae.pages.dev' },
    body: JSON.stringify(spec),
  }),
  { GITHUB_TOKEN: 'token' },
  githubFetch,
);
const publishedBody = await published.json();
assert.equal(published.status, 200);
assert.equal(publishedBody.ok, true);
assert.equal(publishedBody.commitSha, 'commit-sha');
assert.equal(puts.length, 1);
assert.equal(puts[0].body.branch, 'main');
assert.equal(puts[0].body.sha, 'old-sha');
assert.match(puts[0].url, /artifacts\/heimdall\/public\/goals\.json$/);
const committed = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8'));
assert.equal(committed.intent, 'job hunt');
assert.equal(committed.goals[0].title, 'Land the role');
assert.deepEqual(committed.exclude, ['memes', 'jokes']);

const unchanged = await commitGoalsFile({
  token: 'token',
  repo: 'GG100-eng/heimdall',
  branch: 'main',
  spec: normalized,
  githubFetch: async () => new Response(JSON.stringify({
    sha: 'same',
    content: encodeContent(`${JSON.stringify(normalized, null, 2)}\n`),
  }), { status: 200 }),
});
assert.equal(unchanged.unchanged, true);

console.log('goals function tests passed');
