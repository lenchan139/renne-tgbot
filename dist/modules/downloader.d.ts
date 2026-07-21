/**
 * Shared types for platform media downloaders.
 *
 * Each platform module exports a function that takes a URL and returns
 * a DownloadResult. The handler in url.ts routes URLs to the correct
 * module, downloads items, and sends them back to the chat.
 */
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
export type DownloadResult = {
    success: true;
    items: MediaItem[];
} | {
    success: false;
    error: string;
};
export interface TelegraphResult {
    success: true;
    title: string;
    url: string;
    author?: string;
}
export interface DownloadOptions {
    onProgress?: (pct: number, text: string) => void;
}
export interface PlatformMatcher {
    /** Human-readable name (for logs / error messages) */
    name: string;
    /** Regex to test if a URL belongs to this platform */
    pattern: RegExp;
    /** Extract the canonical URL from a matched string */
    extract(url: string): string;
}
export declare function createUrlMatcher(name: string, domains: string[]): PlatformMatcher;
export declare const PLATFORM_MATCHERS: PlatformMatcher[];
/** Convenience: get all domain strings for bot.ts routing */
export declare function getAllPlatformDomains(): string[];
/** Find the first platform matcher that matches the URL */
export declare function matchPlatform(url: string): PlatformMatcher | null;
//# sourceMappingURL=downloader.d.ts.map