import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_THEMES, THEME_FORMAT, validateThemePack, encodeThemeCode, decodeThemeCode, contrastRatio,
} from './theme';

describe('主题包校验', () => {
  it('接受规范的 bismuth-theme 键', () => {
    const r = validateThemePack({ 'bismuth-theme': THEME_FORMAT, id: 'a1', name: '主题', dark: true });
    expect(r.error).toBeUndefined();
    expect(r.pack?.id).toBe('a1');
  });

  it('接受本应用导出使用的 format 键（回归：导出文件以前无法再导入）', () => {
    const r = validateThemePack({ format: THEME_FORMAT, id: 'custom-x', name: '我的主题', dark: true, vars: { bgBase: '#101010' } });
    expect(r.error).toBeUndefined();
  });

  it('拒绝未知版本并给出可读原因', () => {
    const r = validateThemePack({ format: '9.9', id: 'x', name: 'x' });
    expect(r.error).toContain('不支持的主题格式');
  });

  it('拒绝非法颜色与非法 id', () => {
    expect(validateThemePack({ format: THEME_FORMAT, id: 'bad id!', name: 'x' }).error).toContain('id');
    expect(validateThemePack({ format: THEME_FORMAT, id: 'ok', name: 'x', vars: { bgBase: 'red' } }).error).toContain('hex');
  });

  it('对比度不足只给 warning 不阻断', () => {
    const r = validateThemePack({ format: THEME_FORMAT, id: 'low', name: '低对比', vars: { bgBase: '#00ffff', white: '#ffff00' } });
    expect(r.error).toBeUndefined();
    expect(r.warning).toContain('对比度');
  });
});

describe('主题码往返', () => {
  it('内置主题编码后能再解码导入', () => {
    for (const pack of BUILT_IN_THEMES) {
      const code = encodeThemeCode(pack);
      const r = decodeThemeCode(code);
      expect(r.error).toBeUndefined();
      expect(r.pack?.id).toBe(pack.id);
    }
  });
});

describe('WCAG 对比度', () => {
  it('黑白比值接近 21:1，同色为 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
