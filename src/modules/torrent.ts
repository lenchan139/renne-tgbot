import * as WebTorrent from 'webtorrent';
import * as parseTorrent from 'parse-torrent';
import * as fs from 'fs';
import * as path from 'path';
import { ProgressTracker } from '../utils/progress';
import {
  TG_MAX_FILE_SIZE,
  isImageFile,
  isVideoFile,
  getExtension,
} from '../utils/constants';
import { tempFilePath, ensureTmpDir, cleanupDir } from '../utils/tg';

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
 * Create a WebTorrent client (singleton per process)
 */
let client: WebTorrent.Instance | null = null;
function getClient(): WebTorrent.Instance {
  if (!client) {
    client = new WebTorrent();
  }
  return client;
}

/**
 * Crawl torrent info from a magnet link
 */
export function crawlMagnet(magnetUri: string): Promise<TorrentInfo> {
  return new Promise((resolve, reject) => {
    const wt = getClient();
    const torrent = wt.add(magnetUri, { destroyStoreOnDestroy: true });

    torrent.on('ready', () => {
      const info: TorrentInfo = {
        name: torrent.name,
        totalSize: torrent.length,
        files: torrent.files.map((f) => ({
          name: f.name,
          path: f.path,
          size: f.length,
        })),
      };
      torrent.destroy();
      resolve(info);
    });

    torrent.on('error', (err: Error) => {
      torrent.destroy();
      reject(err);
    });

    setTimeout(() => {
      torrent.destroy();
      reject(new Error('Torrent crawl timed out'));
    }, 30_000);
  });
}

/**
 * Crawl torrent info from a .torrent buffer
 */
export function crawlTorrentBuffer(buf: Buffer): Promise<TorrentInfo> {
  return new Promise((resolve, reject) => {
    const parsed = parseTorrent(buf);
    if (!parsed.info) {
      return reject(new Error('Invalid torrent file'));
    }
    // We can get basic info from parsed, but for file list we need webtorrent
    const wt = getClient();
    const torrent = wt.add(parsed, { destroyStoreOnDestroy: true });

    torrent.on('ready', () => {
      const info: TorrentInfo = {
        name: torrent.name,
        totalSize: torrent.length,
        files: torrent.files.map((f) => ({
          name: f.name,
          path: f.path,
          size: f.length,
        })),
      };
      torrent.destroy();
      resolve(info);
    });

    torrent.on('error', (err: Error) => {
      torrent.destroy();
      reject(err);
    });

    setTimeout(() => {
      torrent.destroy();
      reject(new Error('Torrent crawl timed out'));
    }, 30_000);
  });
}

export interface DownloadResult {
  torrentName: string;
  dirPath: string;
  files: TorrentFile[];
}

/**
 * Download a torrent and return the download directory path.
 * Returns after all files are downloaded.
 */
export function downloadTorrent(
  magnetOrTorrent: string | Buffer,
  progress?: ProgressTracker,
  onProgress?: (percent: number, speed: string) => void
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const wt = getClient();
    ensureTmpDir();

    const torrent = wt.add(magnetOrTorrent as any, {
      path: ensureTmpDir(),
      destroyStoreOnDestroy: true,
    });

    let updateInterval: NodeJS.Timeout | null = null;

    if (progress || onProgress) {
      updateInterval = setInterval(() => {
        const pct = Math.round((torrent.progress || 0) * 100);
        const speed = formatSpeed(torrent.downloadSpeed);
        const text = `⬇️ Downloading: ${pct}% | ${speed}`;
        if (onProgress) onProgress(pct, text);
        if (progress) progress.update(text);
      }, 2000);
    }

    torrent.on('done', () => {
      if (updateInterval) clearInterval(updateInterval);
      if (progress) progress.update('✅ Download complete, processing...');

      const dirPath = path.join(ensureTmpDir(), torrent.name);
      const files: TorrentFile[] = torrent.files.map((f) => ({
        name: f.name,
        path: path.join(ensureTmpDir(), f.path),
        size: f.length,
      }));

      resolve({
        torrentName: torrent.name,
        dirPath,
        files,
      });
    });

    torrent.on('error', (err: Error) => {
      if (updateInterval) clearInterval(updateInterval);
      torrent.destroy();
      reject(err);
    });
  });
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return `${(bytesPerSec / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export interface FileCategory {
  images: TorrentFile[];
  videos: TorrentFile[];
  others: TorrentFile[];
  totalSize: number;
}

export function categorizeFiles(files: TorrentFile[]): FileCategory {
  const images: TorrentFile[] = [];
  const videos: TorrentFile[] = [];
  const others: TorrentFile[] = [];

  for (const f of files) {
    if (isImageFile(f.name)) images.push(f);
    else if (isVideoFile(f.name)) videos.push(f);
    else others.push(f);
  }

  return {
    images,
    videos,
    others,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  };
}
