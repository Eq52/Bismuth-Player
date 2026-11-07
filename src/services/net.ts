// 网络地址工具
// 判断 URL 是否指向本机或内网地址：这类地址经公网 CORS 代理转发会失败
// （公网代理服务器无法访问用户的本机/内网），应直接连接、绕过代理。

export function isLocalOrPrivateUrl(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return false; // 非法 URL 不做假设，交给正常流程处理
  }
  if (!host) return false;

  const lower = host.toLowerCase();

  // 本机回环、本地域名（URL.hostname 对 IPv6 会保留方括号，两种形式都判断）
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local')
  ) {
    return true;
  }

  // IPv4 地址段判断
  const match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 127.0.0.0/8 回环
    if (a === 127) return true;
    // 169.254.0.0/16 链路本地
    if (a === 169 && b === 254) return true;
    return false;
  }

  return false;
}
