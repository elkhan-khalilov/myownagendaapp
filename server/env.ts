/** Tolerant env parsing: trims whitespace/quotes, accepts a full GitHub URL for DATA_REPO. */
const unquote = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

export function readEnv() {
  const token = unquote(process.env.GITHUB_TOKEN);
  const secret = unquote(process.env.SESSION_SECRET);
  const repo = unquote(process.env.DATA_REPO)
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const branch = unquote(process.env.DATA_BRANCH) || undefined;
  const problems: string[] = [];
  if (!token) problems.push('GITHUB_TOKEN yoxdur');
  if (!repo) problems.push('DATA_REPO yoxdur');
  else if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) problems.push('DATA_REPO formatı "istifadəçi/repo" olmalıdır');
  if (!secret) problems.push('SESSION_SECRET yoxdur');
  else if (secret.length < 32) problems.push(`SESSION_SECRET qısadır (${secret.length} simvol, ən azı 32)`);
  return { token, secret, repo, branch, problems };
}
