/**
 * BackupPage — 全量备份 / 恢复
 *
 * 备份范围：影视源、当前源、播放器/缓存设置、CORS 代理、历史上限、历史、收藏、观看统计。
 * 第一期不含 IDB 内的主题包资产与壁纸位图（第二期再纳入）。
 * 恢复前自动留一份本地快照（保留最近一份），单域失败只回滚该域。
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, Download, ShieldAlert, FileJson, DatabaseBackup, AlertTriangle } from 'lucide-react';
import {
  createBackup, writeBackupToFile, parseBackupText, summarize, verifyPayload, restoreBackup,
  getSnapshot, MAX_BACKUP_BYTES,
  type BackupPayload, type BackupSummary,
} from '@/services/backup';
import { toast } from '@/hooks/use-toast';

interface BackupPageProps {
  onBack: () => void;
}

interface PendingRestore {
  payload: BackupPayload;
  summary: BackupSummary;
}

export function BackupPage({ onBack }: BackupPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);

  useEffect(() => {
    const snap = getSnapshot();
    setSnapshotAt(snap ? new Date(snap.at).toLocaleString() : null);
  }, []);

  /* ── 导出备份（与影视源导出同一套文件下载方式） ── */
  const exportBackup = async () => {
    try {
      const payload = await createBackup(__APP_VERSION__);
      const filename = writeBackupToFile(payload);
      toast({ title: '导出成功', description: `全量备份已保存至 ${filename}` });
    } catch (e) {
      toast({ title: '导出失败', description: (e as Error).message });
    }
  };

  /* ── 导入：解析 → 预览 → 确认恢复 ── */
  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BACKUP_BYTES) {
      toast({ title: '导入失败', description: '备份文件超过 10MB 上限' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = parseBackupText(String(reader.result));
        setPending({ payload, summary: summarize(payload) });
      } catch (e) {
        toast({ title: '导入失败', description: (e as Error).message });
      }
    };
    reader.readAsText(f);
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    try {
      const intact = await verifyPayload(pending.payload);
      if (!intact) {
        toast({ title: '恢复失败', description: '校验和不一致，备份可能已损坏或被修改' });
        return;
      }
      const result = await restoreBackup(pending.payload);
      if (result.ok) {
        toast({ title: '恢复完成', description: `已还原 ${result.restored.length} 个数据域` });
      } else {
        toast({
          title: '部分数据恢复失败',
          description: result.errors.join('；') + (result.rolledBack.length ? `；已回滚：${result.rolledBack.join(', ')}` : ''),
        });
      }
      setPending(null);
      const snap = getSnapshot();
      setSnapshotAt(snap ? new Date(snap.at).toLocaleString() : null);
    } catch (e) {
      toast({ title: '恢复失败', description: (e as Error).message });
    } finally {
      setRestoring(false);
    }
  };

  const s = pending?.summary;

  return (
    <div className="h-full flex flex-col bg-base">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-3 bg-base border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all md:hidden"
        >
          <ArrowLeft size={20} />
        </button>
        <DatabaseBackup className="w-5 h-5 text-sky-400" />
        <h1 className="text-white text-lg md:text-xl font-bold tracking-tight flex-1">备份与恢复</h1>
        <button
          onClick={onBack}
          className="hidden md:block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          返回设置
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* 导出 */}
          <section className="rounded-xl bg-surface border border-white/5 p-4">
            <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-1.5">
              <Download size={15} className="text-sky-400" /> 导出全量备份
            </h2>
            <p className="text-gray-500 text-xs leading-relaxed mb-3">
              包含影视源、历史、收藏、观看统计、代理与各项设置；不含主题包资产与壁纸图片。
              重装或换设备前建议先导出一份 JSON 保存到 Download 目录。
            </p>
            <button
              onClick={exportBackup}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500/15 text-sky-300 text-xs hover:bg-sky-500/25 transition-all"
            >
              <Download size={14} /> 导出备份文件
            </button>
          </section>

          {/* 导入 */}
          <section className="rounded-xl bg-surface border border-white/5 p-4">
            <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-1.5">
              <Upload size={15} className="text-purple-400" /> 从备份恢复
            </h2>
            <p className="text-gray-500 text-xs leading-relaxed mb-3">
              恢复会覆盖当前对应数据；开始前会自动保留一份本地快照，出问题可据此回滚。
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-elevated text-gray-300 text-xs hover:bg-white/10 transition-all"
            >
              <FileJson size={14} /> 选择备份 JSON 文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            {snapshotAt && (
              <p className="mt-3 text-gray-600 text-xs flex items-center gap-1.5">
                <ShieldAlert size={13} /> 最近一次恢复前快照：{snapshotAt}
              </p>
            )}
          </section>

          <p className="text-gray-600 text-xs leading-relaxed">
            备份文件来自更新版本的应用时会被拒绝；文件损坏或被篡改会校验和拦截，不会写入本地数据。
          </p>
        </div>
      </div>

      {/* 恢复预览弹窗 */}
      {pending && s && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bi-glass-overlay p-4" onClick={() => setPending(null)}>
          <div className="bi-glass-panel rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-white font-bold">确认恢复这份备份？</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-3">
              备份于 {new Date(pending.payload.exportedAt).toLocaleString()}，来自版本 {s.appVersion}。
              当前对应数据将被覆盖。
            </p>
            <ul className="text-gray-300 text-xs leading-relaxed mb-4 space-y-1.5">
              <li>影视源：{s.sources} 个</li>
              <li>播放历史：{s.history} 条</li>
              <li>收藏：{s.favorites} 条</li>
              <li>已看视频：{s.watchVideos} 个</li>
              <li>CORS 代理：{s.proxies} 个</li>
            </ul>
            <div className="flex gap-2.5">
              <button onClick={() => setPending(null)}
                className="flex-1 py-2.5 rounded-xl bg-elevated text-gray-300 text-sm hover:bg-white/10 transition-all">
                取消
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoring}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm hover:bg-purple-400 disabled:opacity-40 transition-all"
              >
                {restoring ? '恢复中…' : '确认恢复'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
