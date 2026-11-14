import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
  return map;
}

const SCHEMA_VERSION_KEY = 'bismuth_schema_version';

async function load() {
  return import('./migrate');
}

describe('存储迁移失败处理', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('迁移抛错时不推进版本号，写入错误记录，下次启动重试同一版本', async () => {
    const migrate = await load();
    localStorage.setItem(SCHEMA_VERSION_KEY, '0');

    let attempts = 0;
    const throwing: Record<number, () => void> = {
      1: () => { attempts += 1; throw new Error('boom'); },
    };

    migrate.runMigrationsForTest(throwing, 1);
    expect(attempts).toBe(1);
    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('0'); // 版本未推进
    const err = migrate.getMigrationError();
    expect(err?.version).toBe(1);
    expect(err?.message).toBe('boom');

    // 再次启动：仍从 0 重试，错误记录被刷新而非清除
    migrate.runMigrationsForTest(throwing, 1);
    expect(attempts).toBe(2);
    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('0');
    expect(migrate.getMigrationError()?.version).toBe(1);
  });

  it('迁移成功后推进版本号并清掉错误记录', async () => {
    const migrate = await load();
    localStorage.setItem(SCHEMA_VERSION_KEY, '0');
    localStorage.setItem('bismuth_player', JSON.stringify({ oldField: 1 }));

    const ok: Record<number, () => void> = {
      1: () => { localStorage.setItem('migrated', '1'); },
    };
    migrate.runMigrationsForTest(ok, 1);

    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('1');
    expect(localStorage.getItem('migrated')).toBe('1');
    expect(migrate.getMigrationError()).toBeNull();
  });
});
