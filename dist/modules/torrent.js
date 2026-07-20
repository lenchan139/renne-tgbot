"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlMagnet = crawlMagnet;
exports.crawlTorrentBuffer = crawlTorrentBuffer;
exports.downloadTorrent = downloadTorrent;
exports.categorizeFiles = categorizeFiles;
const WebTorrent = require('webtorrent');
const parseTorrent = require('parse-torrent');
const path = __importStar(require("path"));
const constants_1 = require("../utils/constants");
const tg_1 = require("../utils/tg");
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
function crawlMagnet(magnetUri) {
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
function crawlTorrentBuffer(buf) {
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
function downloadTorrent(magnetOrTorrent, progress, onProgress) {
    return new Promise((resolve, reject) => {
        const wt = getClient();
        (0, tg_1.ensureTmpDir)();
        const torrent = wt.add(magnetOrTorrent, {
            path: (0, tg_1.ensureTmpDir)(),
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
            const dirPath = path.join((0, tg_1.ensureTmpDir)(), torrent.name);
            const files = torrent.files.map((f) => ({
                name: f.name,
                path: path.join((0, tg_1.ensureTmpDir)(), f.path),
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
function categorizeFiles(files) {
    const images = [];
    const videos = [];
    const others = [];
    for (const f of files) {
        if ((0, constants_1.isImageFile)(f.name))
            images.push(f);
        else if ((0, constants_1.isVideoFile)(f.name))
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