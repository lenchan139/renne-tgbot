/**
 * Shared types for platform media downloaders.
 *
 * Each platform module exports a function that takes a URL and returns
 * a DownloadResult. The handler in url.ts routes URLs to the correct
 * module, downloads items, and sends them back to the chat.
 */
export function createUrlMatcher(name, domains) {
    const escaped = domains.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return {
        name,
        pattern: new RegExp(`https?://(?:[\\w-]+\\.)*(${escaped.join('|')})/[^\\s)」』】]+`, 'gi'),
        extract: (u) => u.trim(),
    };
}
// ─── Platform registry ────────────────────────────────────────
export const PLATFORM_MATCHERS = [
    createUrlMatcher('Threads', ['threads.net']),
    createUrlMatcher('小红书', ['xhslink.com', 'xiaohongshu.com']),
    createUrlMatcher('抖音', ['v.douyin.com', 'douyin.com']),
    createUrlMatcher('TikTok', ['vt.tiktok.com', 'tiktok.com', 'vm.tiktok.com']),
    createUrlMatcher('微博', ['weibo.com', 'm.weibo.cn', 'weibo.cn']),
    createUrlMatcher('Bilibili', ['bilibili.com', 'b23.tv']),
    createUrlMatcher('微信公众号', ['mp.weixin.qq.com']),
];
/** Convenience: get all domain strings for bot.ts routing */
export function getAllPlatformDomains() {
    const set = new Set();
    for (const m of PLATFORM_MATCHERS) {
        // Extract domains from the pattern — crude but works
        const raw = m.pattern.source;
        const matches = raw.matchAll(/\(([^)]+)\)/g);
        for (const match of matches) {
            for (const part of match[1].split('|')) {
                const clean = part.replace(/\\/g, '');
                if (clean.includes('.'))
                    set.add(clean);
            }
        }
    }
    return [...set];
}
// ─── Helpers for the handler ──────────────────────────────────
/** Find the first platform matcher that matches the URL */
export function matchPlatform(url) {
    for (const m of PLATFORM_MATCHERS) {
        if (m.pattern.test(url))
            return m;
    }
    return null;
}
//# sourceMappingURL=downloader.js.map