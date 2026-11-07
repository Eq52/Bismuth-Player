// 本地存储 schema 版本与迁移
//
// 此前数据无统一版本，结构兼容仅靠 getPlayerSettings 等读取处的字段合并（{...defaults, ...stored}）兜底，
// 无法处理字段重命名/结构重组。这里引入显式版本号：应用启动时（早于 React 渲染）检查版本，
// 按顺序执行迁移并写回，再让组件读取。

import { notifyStorageChange } from './store';

const SCHEMA_VERSION_KEY = 'bismuth_schema_version';

// 当前存储结构版本。发生不兼容结构变更时 +1，并在下方 migrations 补对应迁移函数
export const CURRENT_SCHEMA_VERSION = 1;

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
  let version = readVersion();

  if (version >= CURRENT_SCHEMA_VERSION) return;

  while (version < CURRENT_SCHEMA_VERSION) {
    const nextVersion = version + 1;
    const migrate = migrations[nextVersion];
    if (migrate) {
      try {
        migrate();
      } catch (err) {
        // 单个迁移失败不阻断后续版本号写入，避免启动时反复尝试同一失败迁移
        console.error(`存储迁移 v${nextVersion} 失败:`, err);
      }
    }
    version = nextVersion;
    localStorage.setItem(SCHEMA_VERSION_KEY, String(version));
  }

  // 迁移可能改写数据，通知订阅者刷新
  notifyStorageChange();
}
