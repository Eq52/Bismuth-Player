// 本地存储 schema 版本与迁移
//
// 此前数据无统一版本，结构兼容仅靠 getPlayerSettings 等读取处的字段合并（{...defaults, ...stored}）兜底，
// 无法处理字段重命名/结构重组。这里引入显式版本号：应用启动时（早于 React 渲染）检查版本，
// 按顺序执行迁移并写回，再让组件读取。

import { notifyStorageChange } from './store';

const SCHEMA_VERSION_KEY = 'bismuth_schema_version';
const MIGRATION_ERROR_KEY = 'bismuth_migration_error';

// 当前存储结构版本。发生不兼容结构变更时 +1，并在下方 migrations 补对应迁移函数
export const CURRENT_SCHEMA_VERSION = 1;

// 迁移失败快照：版本号停在失败的那一版，下次启动会重试同一迁移，不会把半迁移状态当成已完成
export interface MigrationError {
  version: number;
  message: string;
  at: number;
}

export function getMigrationError(): MigrationError | null {
  try {
    const raw = localStorage.getItem(MIGRATION_ERROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MigrationError;
    return Number.isInteger(parsed.version) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearMigrationError(): void {
  localStorage.removeItem(MIGRATION_ERROR_KEY);
}

// 迁移函数：把数据从 (version-1) 迁移到 version，直接操作 localStorage。
// 每个函数只负责相邻一个版本的转换，按版本号顺序链式执行。
const migrations: Record<number, () => void> = {
  // 示例（未来重命名字段时）：
  // 2: () => {
  //   const raw = localStorage.getItem('bismuth_player');
  //   if (raw) {
  //     const data = JSON.parse(raw);
  //     data.autoPlay = data.autoResume;
  //     delete data.autoResume;
  //     localStorage.setItem('bismuth_player', JSON.stringify(data));
  //   }
  // },
};

// 读取当前版本：无版本键的老数据视为 0
function readVersion(): number {
  const raw = localStorage.getItem(SCHEMA_VERSION_KEY);
  const version = Number(raw);
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

/** 应用启动时调用：逐步迁移到当前版本并持久化版本号 */
export function runStorageMigrations(): void {
  runMigrations(migrations, CURRENT_SCHEMA_VERSION);
}

// 可注入版本表与目标版本，便于单测覆盖失败 / 重试路径；生产走上方固定封装
export function runMigrationsForTest(
  registry: Record<number, () => void>,
  currentVersion: number,
): void {
  runMigrations(registry, currentVersion);
}

function runMigrations(registry: Record<number, () => void>, currentVersion: number): void {
  let version = readVersion();

  if (version >= currentVersion) return;

  clearMigrationError(); // 之前的错误已处理/重试成功，先清掉失败记录

  while (version < currentVersion) {
    const nextVersion = version + 1;
    const migrate = registry[nextVersion];
    if (migrate) {
      try {
        migrate();
      } catch (err) {
        // 迁移失败：不推进版本号、不写回版本键，把错误落到独立键；
        // 下次启动从原版本重试，避免半迁移数据被标记为已完成、永不再试。
        const message = err instanceof Error ? err.message : String(err);
        const snapshot: MigrationError = { version: nextVersion, message, at: Date.now() };
        localStorage.setItem(MIGRATION_ERROR_KEY, JSON.stringify(snapshot));
        console.error(`存储迁移 v${nextVersion} 失败，已暂停等待重试:`, err);
        return;
      }
    }
    version = nextVersion;
    localStorage.setItem(SCHEMA_VERSION_KEY, String(version));
  }

  // 迁移可能改写数据，通知订阅者刷新
  notifyStorageChange();
}
