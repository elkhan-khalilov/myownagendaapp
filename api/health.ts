import type { IncomingMessage, ServerResponse } from 'node:http';

import { readEnv } from '../server/env.js';

/**
 * Diagnostics without secrets: is the function running, are env vars present,
 * can the token reach the data repo? Returns only booleans and HTTP status codes.
 */
export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const env = readEnv();
  const t = env.token;
  const repo = env.repo;
  const out: Record<string, unknown> = {
    ok: env.problems.length === 0,
    node: process.version,
    problems: env.problems,
    env: {
      GITHUB_TOKEN: t.length > 0,
      tokenType: t.startsWith('github_pat_') ? 'fine-grained' : t.startsWith('ghp_') ? 'classic' : t ? 'unknown' : 'missing',
      DATA_REPO: repo || null,
      SESSION_SECRET_length: env.secret.length,
    },
  };
  if (t && /^[\w.-]+\/[\w.-]+$/.test(repo)) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'User-Agent': 'myagenda-health', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      const body = r.ok ? ((await r.json()) as { private?: boolean; permissions?: Record<string, boolean> }) : null;
      out.github = { repoStatus: r.status, private: body?.private ?? null, canPush: body?.permissions?.push ?? null };
    } catch (e) {
      out.github = { error: (e as Error)?.name ?? 'fetch_failed' };
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
}
