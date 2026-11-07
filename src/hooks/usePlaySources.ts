// usePlaySources — 播放线路/剧集状态管理
// DetailPage 与 PlayerPage 此前各自维护 sources/activeSourceIndex/episodes 与切换逻辑，
// 抽到一处统一，减少重复与不一致。

import { useCallback, useState } from 'react';
import type { PlaySource } from '@/types';

type Episode = PlaySource['episodes'][number];

export interface PlaySourcesApi {
  sources: PlaySource[];
  activeSourceIndex: number;
  episodes: Episode[];
  /** 用解析出的线路初始化（startIndex 越界时自动夹取到合法范围） */
  initSources: (next: PlaySource[], startIndex?: number) => void;
  /** 切换线路并更新当前线路的剧集；非法索引直接忽略 */
  changeSource: (index: number) => void;
}

export function usePlaySources(startIndex = 0): PlaySourcesApi {
  const [sources, setSources] = useState<PlaySource[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(startIndex);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const initSources = useCallback((next: PlaySource[], initial = 0) => {
    const safeIndex = Math.min(Math.max(initial, 0), Math.max(next.length - 1, 0));
    setSources(next);
    setActiveSourceIndex(safeIndex);
    setEpisodes(next[safeIndex]?.episodes ?? []);
  }, []);

  const changeSource = useCallback((index: number) => {
    if (index < 0 || index >= sources.length) return;
    setActiveSourceIndex(index);
    setEpisodes(sources[index]?.episodes ?? []);
  }, [sources]);

  return { sources, activeSourceIndex, episodes, initSources, changeSource };
}
