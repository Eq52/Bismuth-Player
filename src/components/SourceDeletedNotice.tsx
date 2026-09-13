import { CloudOff } from 'lucide-react';

interface SourceDeletedNoticeProps {
  sourceId: string;
  sourceName?: string;
}

/** 对应影视源被删除时的提示（详情页/播放器共用） */
export function SourceDeletedNotice({ sourceId, sourceName }: SourceDeletedNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-5">
        <CloudOff className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-white text-lg font-bold mb-3">没了 o(TヘTo)</h2>
      <div className="bg-[#141414] border border-white/5 rounded-xl px-5 py-4 text-sm space-y-1.5 max-w-xs">
        <p className="text-gray-300">对应影视源被删除</p>
        <p className="text-gray-400 break-all">
          影视源信息-ID:<span className="text-purple-400">{sourceId || '未知'}</span>
          {' '}名称:<span className="text-purple-400">{sourceName || '未知'}</span>
        </p>
        <p className="text-gray-500 text-xs pt-1">
          注：该影视内容将随影视源信息缓存数据在30分钟后被删除
        </p>
      </div>
    </div>
  );
}
