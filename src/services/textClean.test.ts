import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, cleanDescription } from './textClean';

describe('decodeHtmlEntities', () => {
  it('解码常见命名实体', () => {
    expect(decodeHtmlEntities('a&amp;b')).toBe('a&b');
    expect(decodeHtmlEntities('&lt;script&gt;')).toBe('<script>');
    expect(decodeHtmlEntities('&quot;引号&quot;')).toBe('"引号"');
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
    expect(decodeHtmlEntities('x&mdash;y&hellip;z')).toBe('x—y…z');
  });

  it('解码十进制与十六进制数字实体', () => {
    expect(decodeHtmlEntities('&#65;&#66;')).toBe('AB');
    expect(decodeHtmlEntities('&#x4e2d;&#x6587;')).toBe('中文');
  });

  it('未知实体与非法码点保持原样', () => {
    expect(decodeHtmlEntities('&unknownentity;')).toBe('&unknownentity;');
    expect(decodeHtmlEntities('&#0;')).toBe('&#0;');
    expect(decodeHtmlEntities('&#xD800;')).toBe('&#xD800;');
  });
});

describe('cleanDescription', () => {
  // 取自实际影视源：段落之间用一长串 &nbsp; 分隔，段首再用全角空格缩进
  const rawWithNbsp =
    '“这是认错人了…… 不对，是认错僵尸了。”' +
    '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;' +
    '　　' +
    '距离那场导致九成人类感染身亡的神秘传染病爆发的「猩红之日」，已经过去了十三年。' +
    '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;' +
    '　　' +
    '幸存的人们远离城市，在与世隔绝的村落里度日。';

  it('把成串 &nbsp; 还原成分行，不留字面实体与超长空白', () => {
    const out = cleanDescription(rawWithNbsp);
    const lines = out.split('\n');
    expect(lines).toEqual([
      '“这是认错人了…… 不对，是认错僵尸了。”',
      '距离那场导致九成人类感染身亡的神秘传染病爆发的「猩红之日」，已经过去了十三年。',
      '幸存的人们远离城市，在与世隔绝的村落里度日。',
    ]);
    expect(out).not.toContain('&nbsp;');
    expect(out).not.toContain('\u00a0');
    expect(out).not.toContain('\u3000');
  });

  it('<br> 与 </p> 视作换行，其余标签剥离', () => {
    expect(cleanDescription('第一段<br>第二段')).toBe('第一段\n第二段');
    expect(cleanDescription('<p>甲</p><p>乙</p>')).toBe('甲\n乙');
    expect(cleanDescription('<b>加粗</b>正文')).toBe('加粗正文');
  });

  it('英文句间双空格不被误拆行', () => {
    expect(cleanDescription('Hello  world.  Next sentence.')).toBe('Hello  world.  Next sentence.');
  });

  it('空值返回空串', () => {
    expect(cleanDescription('')).toBe('');
    expect(cleanDescription(null)).toBe('');
    expect(cleanDescription(undefined)).toBe('');
    expect(cleanDescription('   ')).toBe('');
  });

  it('合并连续换行并去掉首尾空行', () => {
    expect(cleanDescription('\n\n第一段\n\n\n第二段\n\n')).toBe('第一段\n第二段');
  });

  it('HTML 转义标签不会变成真标签', () => {
    // 先解码再剥标签，转义出来的标签文本同样被剥掉（不进 DOM）
    expect(cleanDescription('&lt;img src=x onerror=alert(1)&gt;简介')).toBe('简介');
  });
});
