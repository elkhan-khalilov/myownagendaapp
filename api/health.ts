import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Diagnostics without secrets: is the function running, are env vars present,
 * can the token reach the data repo? Returns only booleans and HTTP status codes.
 * Deliberately has no imports from server/ so it works even if those fail to load.
 */
export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const token = process.env.GITHUB_TOKEN ?? '';
  const repo = (process.env.DATA_REPO ?? '').trim();
  const secret = (process.env.SESSION_SECRET ?? '').trim();
  const t = token.trim();
  const out: Record<string, unknown> = {
    ok: true,
    node: process.version,
    env: {
      GITHUB_TOKEN: t.length > 0,
      tokenHasWhitespaceOrQuotes: t.length > 0 && (t !== token || /["'\s]/.test(t)),
      tokenType: t.startsWith('github_pat_') ? 'fine-grained' : t.startsWith('ghp_') ? 'classic' : t ? 'unknown' : 'missing',
      DATA_REPO_format_ok: /^[\w.-]+\/[\w.-]+$/.test(repo),
      SESSION_SECRET_length_ok: secret.length >= 32,
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
