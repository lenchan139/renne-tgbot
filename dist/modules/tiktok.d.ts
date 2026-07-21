/**
 * TikTok (vt.tiktok.com / tiktok.com) video downloader.
 *
 * Uses multiple third-party download services (snaptik.app, ssstik.io)
 * and falls back to the `tiktok-dl` npm package, to maximise the
 * chance of successfully retrieving a video.
 */
import type { DownloadResult, DownloadOptions } from './downloader.js';
export declare function downloadTiktok(url: string, options?: DownloadOptions): Promise<DownloadResult>;
//# sourceMappingURL=tiktok.d.ts.map