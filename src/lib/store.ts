import "server-only";

/* ══════════════════════════════════════════════════════════════════════
   STORE — one JSON key-value interface, two drivers.

   Locally the driver is the filesystem, under .data/. On Vercel it is a
   PRIVATE Blob store: user records hold password hashes and API-key
   hashes, so a public bucket would be a hole with a URL.

   There is deliberately no third driver and no ORM. The whole model is
   documents addressed by a path, and every query in db.ts is either
   "get one" or "list a prefix".
   ══════════════════════════════════════════════════════════════════ */

export interface Store {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** keys under a prefix, without the .json suffix */
  list(prefix: string): Promise<string[]>;
  /** raw bytes, for the page captures — a saved run has to keep the frame
      it actually measured, not re-render the page as it looks today */
  putBytes(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getBytes(key: string): Promise<Uint8Array | null>;
  /** del() removes a document (key + .json); bytes live at the bare key and
      need their own remover, or a deleted run leaves its capture behind. */
  delBytes(key: string): Promise<void>;
}

/* ── filesystem ─────────────────────────────────────────────────────── */

function fsStore(root: string): Store {
  const fsp = () => import("node:fs/promises");
  const p = () => import("node:path");
  const file = async (key: string) => (await p()).join(root, `${key}.json`);

  return {
    async get<T>(key: string) {
      try {
        const raw = await (await fsp()).readFile(await file(key), "utf8");
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const path = await p();
      const f = await file(key);
      await (await fsp()).mkdir(path.dirname(f), { recursive: true });
      await (await fsp()).writeFile(f, JSON.stringify(value, null, 2), "utf8");
    },
    async del(key) {
      try { await (await fsp()).unlink(await file(key)); } catch { /* already gone */ }
    },
    async list(prefix) {
      const path = await p();
      const dir = path.join(root, prefix);
      try {
        const entries = await (await fsp()).readdir(dir, { withFileTypes: true });
        return entries
          .filter((e) => e.isFile() && e.name.endsWith(".json"))
          .map((e) => `${prefix}/${e.name.slice(0, -5)}`);
      } catch {
        return [];
      }
    },
    async putBytes(key, bytes) {
      const path = await p();
      const f = path.join(root, key);
      await (await fsp()).mkdir(path.dirname(f), { recursive: true });
      await (await fsp()).writeFile(f, bytes);
    },
    async getBytes(key) {
      const path = await p();
      try {
        return new Uint8Array(await (await fsp()).readFile(path.join(root, key)));
      } catch {
        return null;
      }
    },
    async delBytes(key) {
      const path = await p();
      try { await (await fsp()).unlink(path.join(root, key)); } catch { /* already gone */ }
    },
  };
}

/* ── Vercel Blob, private ───────────────────────────────────────────── */

function blobStore(): Store {
  const sdk = () => import("@vercel/blob");
  const path = (key: string) => `${key}.json`;

  return {
    async get<T>(key: string) {
      const { get } = await sdk();
      try {
        /* get() streams the body back directly — there is no second fetch
           to make, and for a private blob there would be no unsigned URL
           to make it against. */
        const res = await get(path(key), { access: "private" });
        if (!res || res.statusCode !== 200) return null;
        return (await new Response(res.stream).json()) as T;
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const { put } = await sdk();
      await put(path(key), JSON.stringify(value), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
    async del(key) {
      const { del } = await sdk();
      try { await del(path(key)); } catch { /* already gone */ }
    },
    async list(prefix) {
      const { list } = await sdk();
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `${prefix}/`, cursor, limit: 1000 });
        for (const b of page.blobs) {
          if (b.pathname.endsWith(".json")) out.push(b.pathname.slice(0, -5));
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    async putBytes(key, bytes, contentType) {
      const { put } = await sdk();
      await put(key, Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
    },
    async getBytes(key) {
      const { get } = await sdk();
      try {
        const res = await get(key, { access: "private" });
        if (!res || res.statusCode !== 200) return null;
        return new Uint8Array(await new Response(res.stream).arrayBuffer());
      } catch {
        return null;
      }
    },
    async delBytes(key) {
      const { del } = await sdk();
      try { await del(key); } catch { /* already gone */ }
    },
  };
}

/* ── selection ──────────────────────────────────────────────────────── */

/* A Blob store is configured when either a read-write token is present or
   the function is running on Vercel with OIDC, which the SDK picks up on
   its own. Falling back to the filesystem on Vercel would look like it
   worked and then drop every account at the next cold start, so that path
   raises instead. */
const onVercel = !!process.env.VERCEL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.BLOB_STORE_ID;

function unconfigured(): Store {
  const fail = async (): Promise<never> => {
    throw new Error(
      "Precog has no persistent store. Run `vercel blob store add precog` and redeploy — " +
        "the filesystem is not durable on Vercel and silently losing accounts is worse than this error.",
    );
  };
  return { get: fail, put: fail, del: fail, list: fail, putBytes: fail, getBytes: fail, delBytes: fail };
}

export const store: Store = onVercel
  ? hasBlob
    ? blobStore()
    : unconfigured()
  : fsStore(process.env.PRECOG_DATA_DIR ?? ".data");

export const storeKind = onVercel ? (hasBlob ? "blob" : "none") : "fs";
