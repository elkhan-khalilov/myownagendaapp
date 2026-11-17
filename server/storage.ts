/**
 * JSON file storage. Production: a private GitHub repo through the Contents API
 * (every write is a commit → full version history). Tests: in-memory.
 */
export interface StoredFile<T> {
  data: T;
  sha: string;
}

export class ConflictError extends Error {
  constructor() {
    super('conflict');
  }
}

export interface JsonStorage {
  read<T>(path: string): Promise<StoredFile<T> | null>;
  /** Writes with optimistic locking: `sha` must match the current version (undefined = file must not exist). */
  write<T>(path: string, data: T, sha: string | undefined, message: string): Promise<string>;
}

export class GitHubStorage implements JsonStorage {
  constructor(
    private token: string,
    private repo: string, // "owner/name"
    private branch?: string,
  ) {}

  private url(path: string) {
    const ref = this.branch ? `?ref=${encodeURIComponent(this.branch)}` : '';
    return `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(path)}${ref}`;
  }

  private headers(accept = 'application/vnd.github+json') {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'myagenda-sync',
    };
  }

  async read<T>(path: string): Promise<StoredFile<T> | null> {
    const res = await fetch(this.url(path), { headers: this.headers(), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`github read ${res.status}`);
    const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
    let text: string;
    if (meta.encoding === 'base64' && meta.content) {
      text = Buffer.from(meta.content, 'base64').toString('utf8');
    } else {
      // Files > 1 MB: content is omitted from the JSON response; fetch the raw body
      const raw = await fetch(this.url(path), { headers: this.headers('application/vnd.github.raw+json'), cache: 'no-store' });
      if (!raw.ok) throw new Error(`github raw read ${raw.status}`);
      text = await raw.text();
    }
    return { data: JSON.parse(text) as T, sha: meta.sha };
  }

  async write<T>(path: string, data: T, sha: string | undefined, message: string): Promise<string> {
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(JSON.stringify(data, null, 1), 'utf8').toString('base64'),
      committer: { name: 'MyAgenda Sync', email: 'sync@myagenda.local' },
    };
    if (sha) body.sha = sha;
    if (this.branch) body.branch = this.branch;
    const res = await fetch(this.url(path).split('?')[0], {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) throw new ConflictError();
    if (!res.ok) throw new Error(`github write ${res.status}`);
    const out = (await res.json()) as { content: { sha: string } };
    return out.content.sha;
  }
}

export class MemoryStorage implements JsonStorage {
  files = new Map<string, { data: string; sha: string }>();
  writes = 0;
  private n = 0;
  async read<T>(path: string) {
    const f = this.files.get(path);
    return f ? { data: JSON.parse(f.data) as T, sha: f.sha } : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async write<T>(path: string, data: T, sha: string | undefined, _message?: string) {
    const cur = this.files.get(path);
    if ((cur?.sha ?? undefined) !== sha) throw new ConflictError();
    const next = `sha${++this.n}`;
    this.files.set(path, { data: JSON.stringify(data), sha: next });
    this.writes++;
    return next;
  }
}
