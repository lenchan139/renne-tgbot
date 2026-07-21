/**
 * Bilibili video downloader module.
 *
 * Uses Bilibili's public web API endpoints to retrieve video info and
 * download URLs, then downloads the video to a temporary directory.
 *
 * Handles both bilibili.com and b23.tv short links.
 */
import { DownloadResult, DownloadOptions } from './downloader.js';
export declare function downloadBilibili(url: string, _options?: DownloadOptions): Promise<DownloadResult>;
//# sourceMappingURL=bilibili.d.ts.map