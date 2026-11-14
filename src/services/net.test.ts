import { describe, it, expect } from 'vitest';
import { isLocalOrPrivateUrl, isDirectMediaUrl } from './net';

describe('isLocalOrPrivateUrl', () => {
  it('识别本机回环与本地域名', () => {
    expect(isLocalOrPrivateUrl('http://localhost/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://localhost:5173/path')).toBe(true);
    expect(isLocalOrPrivateUrl('http://127.0.0.1:8787/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://127.1.2.3/')).toBe(true);
    // IPv6 在 URL 中必须带方括号
    expect(isLocalOrPrivateUrl('http://[::1]:8080/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://[::1]/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://myserver.local/')).toBe(true);
  });

  it('识别内网 IPv4 段', () => {
    expect(isLocalOrPrivateUrl('http://10.0.0.1/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://10.255.255.254/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://192.168.1.1/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://172.16.0.1/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://172.31.255.254/')).toBe(true);
    expect(isLocalOrPrivateUrl('http://169.254.1.1/')).toBe(true);
  });

  it('内网段边界外的地址判定为公网', () => {
    expect(isLocalOrPrivateUrl('http://172.15.0.1/')).toBe(false);
    expect(isLocalOrPrivateUrl('http://172.32.0.1/')).toBe(false);
    expect(isLocalOrPrivateUrl('http://8.8.8.8/')).toBe(false);
    expect(isLocalOrPrivateUrl('http://11.0.0.1/')).toBe(false);
    expect(isLocalOrPrivateUrl('http://192.169.0.1/')).toBe(false);
  });

  it('公网域名与普通地址判定为公网', () => {
    expect(isLocalOrPrivateUrl('https://example.com/')).toBe(false);
    expect(isLocalOrPrivateUrl('https://api.github.com/repos')).toBe(false);
    expect(isLocalOrPrivateUrl('https://example.com/local')).toBe(false);
  });

  it('非法 URL 返回 false 而不是抛错', () => {
    expect(isLocalOrPrivateUrl('not-a-url')).toBe(false);
    expect(isLocalOrPrivateUrl('')).toBe(false);
    expect(isLocalOrPrivateUrl('//no-protocol')).toBe(false);
  });
});

describe('isDirectMediaUrl', () => {
  it('识别常见直连媒体扩展名', () => {
    expect(isDirectMediaUrl('https://v.example.com/2026/a/index.m3u8')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.mp4?token=x')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.webm')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.ts')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.flv')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.mov')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.ogv')).toBe(true);
    expect(isDirectMediaUrl('https://v.example.com/a/b.m4v')).toBe(true);
  });

  it('网页播放器页 / 分享页判为非直链', () => {
    expect(isDirectMediaUrl('https://hd.kuktxu.com/play/vbmwpOAe')).toBe(false);
    expect(isDirectMediaUrl('https://v.lzcdn27.com/share/9087fba46c')).toBe(false);
    expect(isDirectMediaUrl('https://example.com/play/abc/')).toBe(false);
  });

  it('忽略 query 与 hash，非法地址按网页页处理', () => {
    expect(isDirectMediaUrl('https://example.com/a/index.m3u8#fragment')).toBe(true);
    expect(isDirectMediaUrl('not-a-url')).toBe(false);
    expect(isDirectMediaUrl('')).toBe(false);
  });
});
