import { describe, it, expect } from 'vitest';
import { isXmlFeed, parseXmlApiResponse } from './xmlFeed';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="5.1">
<list page="1" pagecount="5" pagesize="20" recordcount="100">
<video>
<last>2026-11-14 23:36:06</last>
<id>32095</id>
<tid>24</tid>
<name><![CDATA[斗破苍穹 年番]]></name>
<type>中国动漫</type>
<pic>https://image.example.com/cover/a.jpg</pic>
<lang>汉语普通话</lang>
<area>中国大陆</area>
<year>2022</year>
<state>0</state>
<note><![CDATA[第219集]]></note>
<actor>演员A,演员B</actor>
<director>导演B</director>
<dl>
<dd flag="lzm3u8"><![CDATA[第01集$https://v.example.com/2026/a/index.m3u8#第02集$https://v.example.com/2026/b/index.m3u8]]></dd>
<dd flag="liangzi"><![CDATA[第01集$https://v.example.com/share/aaa#第02集$https://v.example.com/share/bbb]]></dd>
</dl>
<des><![CDATA[三年之约后，萧炎来到迦南学院。]]></des>
</video>
</list>
<class><ty id="24">中国动漫</ty><ty id="3">欧美剧</ty></class>
</rss>`;

describe('isXmlFeed', () => {
  it('识别 XML 声明与 rss 根节点', () => {
    expect(isXmlFeed(SAMPLE_XML)).toBe(true);
    expect(isXmlFeed('<rss><list/></rss>')).toBe(true);
    expect(isXmlFeed('{"code":1,"list":[]}')).toBe(false);
    expect(isXmlFeed('')).toBe(false);
  });
});

describe('parseXmlApiResponse 列表/详情映射', () => {
  const res = parseXmlApiResponse(SAMPLE_XML);

  it('归一化分页字段', () => {
    expect(res.code).toBe(1);
    expect(res.page).toBe(1);
    expect(res.pagecount).toBe(5);
    expect(res.total).toBe(100);
  });

  it('映射视频基础字段', () => {
    expect(res.list).toHaveLength(1);
    const v = res.list[0];
    expect(v.vod_id).toBe(32095);
    expect(v.vod_name).toBe('斗破苍穹 年番');
    expect(v.vod_pic).toBe('https://image.example.com/cover/a.jpg');
    expect(v.vod_remarks).toBe('第219集');
    expect(v.type_name).toBe('中国动漫');
    expect(v.vod_year).toBe('2022');
    expect(v.vod_area).toBe('中国大陆');
    expect(v.vod_actor).toBe('演员A,演员B');
    expect(v.vod_director).toBe('导演B');
    expect(v.vod_content).toBe('三年之约后，萧炎来到迦南学院。');
  });

  it('多条线路编码为 $$$ 分隔的 play_from / play_url', () => {
    const v = res.list[0];
    expect(v.vod_play_from).toBe('lzm3u8$$$liangzi');
    expect(v.vod_play_url).toBe(
      '第01集$https://v.example.com/2026/a/index.m3u8#第02集$https://v.example.com/2026/b/index.m3u8$$$第01集$https://v.example.com/share/aaa#第02集$https://v.example.com/share/bbb',
    );
  });

  it('映射扁平分类 class', () => {
    expect(res.class).toEqual([
      { type_id: 24, type_pid: 0, type_name: '中国动漫' },
      { type_id: 3, type_pid: 0, type_name: '欧美剧' },
    ]);
  });
});

describe('parseXmlApiResponse 边界情况', () => {
  it('无视频时 code=0 且列表为空', () => {
    const res = parseXmlApiResponse('<rss><list page="1" pagecount="0" recordcount="0"></list></rss>');
    expect(res.code).toBe(0);
    expect(res.list).toEqual([]);
  });

  it('缺少播放列表时不写 play 字段', () => {
    const xml = `<rss><list><video><id>1</id><name><![CDATA[单片]]></name></video></list></rss>`;
    const v = parseXmlApiResponse(xml).list[0];
    expect(v.vod_play_url).toBeUndefined();
    expect(v.vod_play_from).toBeUndefined();
  });
});
