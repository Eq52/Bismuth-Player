import { describe, it, expect } from 'vitest';
import {
  isValidHttpUrl,
  stripManagedParams,
  normalizeSourceUrl,
  isSameUrl,
  deriveNameFromUrl,
  generateSourceId,
  parseSourceConfigText,
  annotateDuplicates,
} from './sourceParse';

describe('isValidHttpUrl', () => {
  it('接受 http/https', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('http://example.com/api')).toBe(true);
  });
  it('拒绝非 http 协议与非法字符串', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('example.com')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});

describe('stripManagedParams', () => {
  it('剥离应用受管参数并保留第三方参数', () => {
    const result = stripManagedParams('https://a.com/x?ac=list&token=secret&pg=2');
    const u = new URL(result);
    expect(u.searchParams.get('ac')).toBeNull();
    expect(u.searchParams.get('pg')).toBeNull();
    expect(u.searchParams.get('token')).toBe('secret');
  });
  it('非法 URL 原样返回', () => {
    expect(stripManagedParams('not-url')).toBe('not-url');
  });
});

describe('normalizeSourceUrl', () => {
  it('去除空白引号并剥离受管参数', () => {
    expect(normalizeSourceUrl('  "https://a.com?ac=v"  ')).toBe('https://a.com/');
  });
  it('非字符串或非法链接返回 null', () => {
    expect(normalizeSourceUrl(123)).toBeNull();
    expect(normalizeSourceUrl('ftp://a.com')).toBeNull();
  });
});

describe('isSameUrl', () => {
  it('忽略尾部斜杠与大小写', () => {
    expect(isSameUrl('https://A.com/', 'https://a.com')).toBe(true);
    expect(isSameUrl('https://a.com/x///', 'https://a.com/x')).toBe(true);
  });
  it('不同路径不相等', () => {
    expect(isSameUrl('https://a.com/x', 'https://a.com/y')).toBe(false);
  });
});

describe('deriveNameFromUrl', () => {
  it('去除常见前缀', () => {
    expect(deriveNameFromUrl('https://www.example.com/')).toBe('example.com');
    expect(deriveNameFromUrl('https://api.test.net/')).toBe('test.net');
  });
});

describe('generateSourceId', () => {
  it('同一 URL 生成确定性 ID，冲突时追加序号', () => {
    const taken = new Set<string>();
    const first = generateSourceId('https://example.com', taken);
    // 主机名中的点会被替换为连字符
    expect(first).toContain('example-com-');
    const second = generateSourceId('https://example.com', new Set([first]));
    expect(second).not.toBe(first);
    expect(second).toMatch(/-\d+$/);
  });
});

describe('parseSourceConfigText', () => {
  it('空文本返回空结果', () => {
    const r = parseSourceConfigText('   ');
    expect(r.sources).toHaveLength(0);
    expect(r.invalidCount).toBe(0);
  });

  it('解析 Bismuth 导出 JSON', () => {
    const text = JSON.stringify({
      app: 'Bismuth',
      sources: [
        { id: 's1', name: '源一', url: 'https://a.com/api?ac=list' },
        { id: 's2', name: '源二', url: 'https://b.com/api' },
      ],
    });
    const r = parseSourceConfigText(text);
    expect(r.format).toBe('Bismuth 导出');
    expect(r.sources).toHaveLength(2);
    expect(r.sources[0].name).toBe('源一');
  });

  it('聚合配置中爬虫源标记为不兼容', () => {
    const text = JSON.stringify({
      sites: [
        { key: 'jar', name: '爬虫', type: 3, api: 'csp_X' },
        { key: 'ok', name: '正常', type: 0, api: 'https://a.com/api' },
      ],
    });
    const r = parseSourceConfigText(text);
    expect(r.format).toContain('聚合站点配置');
    expect(r.sources).toHaveLength(1);
    expect(r.invalidCount).toBe(1);
  });

  it('解析纯文本链接列表', () => {
    const text = 'https://a.com/api\nhttps://b.com/api';
    const r = parseSourceConfigText(text);
    expect(r.format).toBe('文本链接');
    expect(r.sources).toHaveLength(2);
  });

  it('解析名称+链接混排并取名称', () => {
    const text = '我的资源,https://a.com/api';
    const r = parseSourceConfigText(text);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].name).toBe('我的资源');
  });

  it('重复 URL 去重并计入 invalidCount', () => {
    const text = 'https://a.com/api\nhttps://a.com/api/';
    const r = parseSourceConfigText(text);
    expect(r.sources).toHaveLength(1);
    expect(r.invalidCount).toBe(1);
  });
});

describe('annotateDuplicates', () => {
  it('按 ID 或 URL 标注重复', () => {
    const parsed = [
      { id: 'new', name: '新', url: 'https://new.com' },
      { id: 'dup', name: '重复', url: 'https://dup.com' },
    ];
    const existing = [
      { id: 'dup', name: '已有', url: 'https://other.com' },
    ] as never;
    const r = annotateDuplicates(parsed, existing);
    expect(r[0].duplicate).toBe(false);
    expect(r[1].duplicate).toBe(true);
  });
});
