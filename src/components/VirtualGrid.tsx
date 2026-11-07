// VirtualGrid — 响应式网格虚拟化
// 只渲染可视窗口附近的行，避免无限滚动累积大量卡片 DOM 节点导致卡顿。
// 滚动容器由外部持有（保留下拉刷新/无限加载等逻辑），本组件只负责在其内做虚拟化。

import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualGridProps<T> {
  items: T[];
  /** 外部滚动容器（虚拟化的 getScrollElement） */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 渲染单个卡片 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 上下额外预渲染的行数 */
  overscan?: number;
}

// 列数断点对齐 tailwind 响应式类（grid-cols-3 sm:4 md:5 lg:6 xl:8 2xl:10）
function getColumnCount(width: number): number {
  if (width >= 1536) return 10;
  if (width >= 1280) return 8;
  if (width >= 1024) return 6;
  if (width >= 768) return 5;
  if (width >= 640) return 4;
  return 3;
}

// 间距对齐 gap-3 / md:gap-4 / lg:gap-5
function getGap(width: number): number {
  if (width >= 1024) return 20;
  if (width >= 768) return 16;
  return 12;
}

export function VirtualGrid<T>({ items, scrollRef, renderItem, overscan = 4 }: VirtualGridProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);

  // 测量容器宽度以计算列数；旋转/缩放窗口时 ResizeObserver 触发更新
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRef]);

  const columns = containerWidth === 0 ? 3 : getColumnCount(containerWidth);
  const gap = containerWidth === 0 ? 12 : getGap(containerWidth);
  const rowCount = Math.ceil(items.length / columns);

  // TanStack Virtual 的 useVirtualizer 返回含函数的对象，无法被 React Compiler 安全 memoize，
  // 属该库已知限制（会自动跳过 memoize），组件功能正常，关闭此规则的误报
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    // 行高初值：封面 3/4 + 文字区（约 56px），实际由 measureElement 精确测量
    estimateSize: () => {
      if (containerWidth === 0) return 240;
      const itemWidth = (containerWidth - gap * (columns - 1)) / columns;
      return itemWidth * 4 / 3 + 56;
    },
    overscan,
    gap,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
      {virtualRows.map((virtualRow) => {
        const start = virtualRow.index * columns;
        const rowItems = items.slice(start, start + columns);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 grid w-full"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rowItems.map((item, i) => renderItem(item, start + i))}
          </div>
        );
      })}
    </div>
  );
}
