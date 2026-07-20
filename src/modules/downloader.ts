/**
 * Shared types for platform media downloaders.
 *
 * Each platform module exports a function that takes a URL and returns
 * a DownloadResult. The handler in url.ts routes URLs to the correct
 * module, downloads items, and sends them back to the chat.
 */

// ─── Media item types ─────────────────────────────────────────

export type MediaType = 'photo' | 'video' | 'animation' | 'telegraph';

export interface MediaItem {
  type: MediaType;
  /** Remote URL to download from */
  url: string;
  /** Local file path after download (filled by the handler) */
  filePath?: string;
  width?: number;
  height?: number;
  /** Video duration in seconds */
  duration?: number;
  /** Thumbnail remote URL */
  thumbnail?: string;
}

// ─── Download result ──────────────────────────────────────────

export type DownloadResult =
  | { success: true; items: MediaItem[] }
  | { success: false; error: string };

// ─── Telegraph result (for WeChat & long-form content) ────────

export interface TelegraphResult {
  success: true;
  title: string;
  url: string;       // telegra.ph/xxx
  author?: string;
}

// ─── Download options ─────────────────────────────────────────

export interface DownloadOptions {
  onProgress?: (pct: number, text: string) => void;
}

// ─── URL pattern helpers ─────────────────────────────────────

export interface PlatformMatcher {
  /** Human-readable name (for logs / error messages) */
  name: string;
  /** Regex to test if a URL belongs to this platform */
  pattern: RegExp;
  /** Extract the canonical URL from a matched string */
  extract(url: string): string;
}

export function createUrlMatcher(name: string, domains: string[]): PlatformMatcher {
  const escaped = domains.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return {
    name,
    pattern: new RegExp(
      `https?://(?:[\\w-]+\\.)*(${escaped.join('|')})/[^\\s)」』】]+`,
      'gi'
    ),
    extract: (u: string) => u.trim(),
  };
}

// ─── Platform registry ────────────────────────────────────────

export const PLATFORM_MATCHERS: PlatformMatcher[] = [
  createUrlMatcher('Threads', ['threads.net']),
  createUrlMatcher('小红书', ['xhslink.com', 'xiaohongshu.com']),
  createUrlMatcher('抖音', ['v.douyin.com', 'douyin.com']),
  createUrlMatcher('TikTok', ['vt.tiktok.com', 'tiktok.com', 'vm.tiktok.com']),
  createUrlMatcher('微博', ['weibo.com', 'm.weibo.cn', 'weibo.cn']),
  createUrlMatcher('Bilibili', ['bilibili.com', 'b23.tv']),
  createUrlMatcher('微信公众号', ['mp.weixin.qq.com']),
];

/** Convenience: get all domain strings for bot.ts routing */
export function getAllPlatformDomains(): string[] {
  const set = new Set<string>();
  for (const m of PLATFORM_MATCHERS) {
    // Extract domains from the pattern — crude but works
    const raw = m.pattern.source;
    const matches = raw.matchAll(/\(([^)]+)\)/g);
    for (const match of matches) {
      for (const part of match[1].split('|')) {
        const clean = part.replace(/\\/g, '');
        if (clean.includes('.')) set.add(clean);
      }
    }
  }
  return [...set];
}

// ─── Helpers for the handler ──────────────────────────────────

/** Find the first platform matcher that matches the URL */
export function matchPlatform(url: string): PlatformMatcher | null {
  for (const m of PLATFORM_MATCHERS) {
    if (m.pattern.test(url)) return m;
  }
  return null;
}
