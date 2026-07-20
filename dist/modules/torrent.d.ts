import { ProgressTracker } from '../utils/progress.js';
export interface TorrentFile {
    name: string;
    path: string;
    size: number;
}
export interface TorrentInfo {
    name: string;
    totalSize: number;
    files: TorrentFile[];
}
/**
 * Crawl torrent info from a magnet link
 */
export declare function crawlMagnet(magnetUri: string): Promise<TorrentInfo>;
/**
 * Crawl torrent info from a .torrent buffer
 */
export declare function crawlTorrentBuffer(buf: Buffer): Promise<TorrentInfo>;
export interface DownloadResult {
    torrentName: string;
    dirPath: string;
    files: TorrentFile[];
}
/**
 * Download a torrent and return the download directory path.
 */
export declare function downloadTorrent(magnetOrTorrent: string | Buffer, progress?: ProgressTracker, onProgress?: (percent: number, speed: string) => void): Promise<DownloadResult>;
export interface FileCategory {
    images: TorrentFile[];
    videos: TorrentFile[];
    others: TorrentFile[];
    totalSize: number;
}
export declare function categorizeFiles(files: TorrentFile[]): FileCategory;
//# sourceMappingURL=torrent.d.ts.map