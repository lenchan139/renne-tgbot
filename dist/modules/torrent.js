const WebTorrent = require('webtorrent');
const parseTorrent = require('parse-torrent');
import * as path from 'path';
import { isImageFile, isVideoFile, } from '../utils/constants.js';
import { ensureTmpDir } from '../utils/tg.js';
/**
 * Create a WebTorrent client (singleton per process)
 */
let client = null;
function getClient() {
    if (!client) {
        client = new WebTorrent();
    }
    return client;
}
/**
 * Crawl torrent info from a magnet link
 */
export function crawlMagnet(magnetUri) {
    return new Promise((resolve, reject) => {
        const wt = getClient();
        const torrent = wt.add(magnetUri, { destroyStoreOnDestroy: true });
        torrent.on('ready', () => {
            const info = {
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
        torrent.on('error', (err) => {
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
export function crawlTorrentBuffer(buf) {
    return new Promise((resolve, reject) => {
        const parsed = parseTorrent(buf);
        if (!parsed.info) {
            return reject(new Error('Invalid torrent file'));
        }
        const wt = getClient();
        const torrent = wt.add(parsed, { destroyStoreOnDestroy: true });
        torrent.on('ready', () => {
            const info = {
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
        torrent.on('error', (err) => {
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
 * Download a torrent and return the download directory path.
 */
export function downloadTorrent(magnetOrTorrent, progress, onProgress) {
    return new Promise((resolve, reject) => {
        const wt = getClient();
        ensureTmpDir();
        const torrent = wt.add(magnetOrTorrent, {
            path: ensureTmpDir(),
            destroyStoreOnDestroy: true,
        });
        let updateInterval = null;
        if (progress || onProgress) {
            updateInterval = setInterval(() => {
                const pct = Math.round((torrent.progress || 0) * 100);
                const speed = formatSpeed(torrent.downloadSpeed);
                const text = `⬇️ Downloading: ${pct}% | ${speed}`;
                if (onProgress)
                    onProgress(pct, text);
                if (progress)
                    progress.update(text);
            }, 2000);
        }
        torrent.on('done', () => {
            if (updateInterval)
                clearInterval(updateInterval);
            if (progress)
                progress.update('✅ Download complete, processing...');
            const dirPath = path.join(ensureTmpDir(), torrent.name);
            const files = torrent.files.map((f) => ({
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
        torrent.on('error', (err) => {
            if (updateInterval)
                clearInterval(updateInterval);
            torrent.destroy();
            reject(err);
        });
    });
}
function formatSpeed(bytesPerSec) {
    if (bytesPerSec === 0)
        return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
    return `${(bytesPerSec / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
export function categorizeFiles(files) {
    const images = [];
    const videos = [];
    const others = [];
    for (const f of files) {
        if (isImageFile(f.name))
            images.push(f);
        else if (isVideoFile(f.name))
            videos.push(f);
        else
            others.push(f);
    }
    return {
        images,
        videos,
        others,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
    };
}
//# sourceMappingURL=torrent.js.map