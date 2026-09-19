/**
 * themeStore — Bismuth 主题资产 IndexedDB 存储层
 *
 * localStorage 只有 ~5MB，壁纸/Logo 等 dataURL 资产和远程 CSS 缓存放这里。
 * 库名 bismuth，两个 store：
 *  - themes: 导入/自制的主题包 JSON（keyPath id）
 *  - assets: 大体积资产（壁纸 dataURL、Logo、远程 CSS 缓存），按字符串 key 存取
 * IDB 不可用（隐私模式等）时自动降级为内存 Map，功能不中断、重启后丢失。
 */

const DB_NAME = 'bismuth';
const DB_VERSION = 1;
const THEMES_STORE = 'themes';
const ASSETS_STORE = 'assets';

let dbPromise: Promise<IDBDatabase | null> | null = null;
// IDB 不可用时的内存降级
const memThemes = new Map<string, unknown>();
const memAssets = new Map<string, unknown>();

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(THEMES_STORE)) {
          db.createObjectStore(THEMES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const t = db.transaction(store, mode);
          const req = run(t.objectStore(store));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

/* ── 主题包存取 ── */

export async function putTheme(pack: unknown): Promise<void> {
  const id = (pack as { id?: string })?.id;
  if (!id) return;
  const ok = await tx(THEMES_STORE, 'readwrite', (s) => s.put(pack));
  if (ok === null) memThemes.set(id, pack);
}

export async function getTheme<T = unknown>(id: string): Promise<T | null> {
  const v = await tx<T>(THEMES_STORE, 'readonly', (s) => s.get(id) as IDBRequest<T>);
  if (v !== null) return v;
  return (memThemes.get(id) as T) ?? null;
}

export async function listThemes<T = unknown>(): Promise<T[]> {
  const v = await tx<T[]>(THEMES_STORE, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  if (v !== null) return v;
  return Array.from(memThemes.values()) as T[];
}

export async function deleteTheme(id: string): Promise<void> {
  await tx(THEMES_STORE, 'readwrite', (s) => s.delete(id));
  memThemes.delete(id);
}

/* ── 大体积资产存取（壁纸/Logo/远程CSS缓存）── */

export async function putAsset(key: string, value: unknown): Promise<void> {
  const ok = await tx(ASSETS_STORE, 'readwrite', (s) => s.put(value, key));
  if (ok === null) memAssets.set(key, value);
}

export async function getAsset<T = unknown>(key: string): Promise<T | null> {
  const v = await tx<T>(ASSETS_STORE, 'readonly', (s) => s.get(key) as IDBRequest<T>);
  if (v !== null) return v;
  return (memAssets.get(key) as T) ?? null;
}

export async function deleteAsset(key: string): Promise<void> {
  await tx(ASSETS_STORE, 'readwrite', (s) => s.delete(key));
  memAssets.delete(key);
}

/** 清空全部主题资产（清缓存页「主题资源」入口用） */
export async function clearThemeData(): Promise<void> {
  await tx(THEMES_STORE, 'readwrite', (s) => s.clear());
  await tx(ASSETS_STORE, 'readwrite', (s) => s.clear());
  memThemes.clear();
  memAssets.clear();
}
