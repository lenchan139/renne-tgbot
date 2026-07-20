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
exports.handleTorrentFile = handleTorrentFile;
exports.handleMagnetLink = handleMagnetLink;
const grammy_1 = require("grammy");
const fs = __importStar(require("fs"));
const torrent_1 = require("../modules/torrent");
const media_1 = require("../modules/media");
const zipper_1 = require("../modules/zipper");
const progress_1 = require("../utils/progress");
const tg_1 = require("../utils/tg");
const constants_1 = require("../utils/constants");
/**
 * Handle a torrent file upload
 */
async function handleTorrentFile(ctx) {
    const doc = ctx.message?.document;
    if (!doc)
        return;
    if (!(0, constants_1.isTorrentFile)(doc.file_name || ''))
        return;
    await ctx.reply('📥 Received torrent file, crawling info...');
    const file = await ctx.api.getFile(doc.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const torrentPath = (0, tg_1.tempFilePath)(doc.file_name || 'torrent.torrent');
    fs.writeFileSync(torrentPath, buffer);
    try {
        const info = await (0, torrent_1.crawlTorrentBuffer)(buffer);
        await processTorrent(ctx, info, buffer);
    }
    catch (err) {
        await ctx.reply(`❌ Failed to parse torrent: ${err.message}`);
    }
    finally {
        (0, tg_1.cleanupFile)(torrentPath);
    }
}
/**
 * Handle a magnet link sent as text
 */
async function handleMagnetLink(ctx) {
    const text = ctx.message?.text || '';
    const match = text.match(/magnet:\?xt=[^\s]+/i);
    if (!match)
        return;
    const magnet = match[0];
    await ctx.reply('📥 Crawling magnet link info...');
    try {
        const info = await (0, torrent_1.crawlMagnet)(magnet);
        await processTorrent(ctx, info, magnet);
    }
    catch (err) {
        await ctx.reply(`❌ Failed to crawl magnet: ${err.message}`);
    }
}
/**
 * Process a torrent after info has been crawled
 */
async function processTorrent(ctx, info, torrentSource) {
    const summary = info.files
        .slice(0, 20)
        .map((f) => `• ${f.name} (${(0, tg_1.formatSize)(f.size)})`)
        .join('\n');
    const more = info.files.length > 20 ? `\n... and ${info.files.length - 20} more` : '';
    await ctx.reply(`📋 **Torrent: ${info.name}**\n` +
        `Total size: ${(0, tg_1.formatSize)(info.totalSize)}\n` +
        `Files: ${info.files.length}\n\n` +
        summary + more, { parse_mode: 'Markdown' });
    if (info.totalSize <= constants_1.TG_MAX_FILE_SIZE && info.files.length <= 1) {
        await downloadAndUploadSingle(ctx, info, torrentSource);
    }
    else if (info.files.length === 1 && info.files[0].size > constants_1.TG_MAX_FILE_SIZE) {
        const file = info.files[0];
        if ((0, constants_1.isVideoFile)(file.name)) {
            await downloadAndUploadSingle(ctx, info, torrentSource);
        }
        else {
            await downloadAndZip(ctx, info, torrentSource);
        }
    }
    else if (info.totalSize > constants_1.TG_MAX_FILE_SIZE) {
        const cats = (0, torrent_1.categorizeFiles)(info.files);
        if (cats.videos.length === 1 && cats.images.length === 0 && cats.others.length === 0) {
            await downloadAndUploadSingle(ctx, info, torrentSource);
        }
        else if (cats.images.length > 0 && cats.videos.length === 0 && cats.others.length === 0) {
            await downloadAndSendImages(ctx, info, torrentSource);
        }
        else {
            await downloadAndZip(ctx, info, torrentSource);
        }
    }
    else {
        await downloadAndUploadAll(ctx, info, torrentSource);
    }
}
async function downloadAndUploadSingle(ctx, info, source) {
    const progress = await (0, progress_1.createProgress)(ctx, '⬇️ Starting download...');
    try {
        const result = await (0, torrent_1.downloadTorrent)(source, progress);
        const file = result.files[0];
        if (!file)
            throw new Error('No files in torrent');
        await progress.update('📤 Uploading to Telegram...');
        if ((0, constants_1.isVideoFile)(file.name)) {
            await ctx.replyWithVideo(new grammy_1.InputFile(file.path), {
                caption: '📥 Downloaded from torrent',
            });
        }
        else if ((0, constants_1.isImageFile)(file.name)) {
            await ctx.replyWithPhoto(new grammy_1.InputFile(file.path), {
                caption: '📥 Downloaded from torrent',
            });
        }
        else {
            await ctx.replyWithDocument(new grammy_1.InputFile(file.path, file.name), {
                caption: '📥 Downloaded from torrent',
            });
        }
        await progress.delete();
        await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
    }
    catch (err) {
        await progress.update(`❌ Download failed: ${err.message}`);
    }
}
async function downloadAndSendImages(ctx, info, source) {
    const progress = await (0, progress_1.createProgress)(ctx, '⬇️ Starting download...');
    try {
        const result = await (0, torrent_1.downloadTorrent)(source, progress);
        await progress.update('📤 Uploading images...');
        for (const file of result.files) {
            if (!(0, constants_1.isImageFile)(file.name))
                continue;
            try {
                const compressed = await (0, media_1.compressImage)(file.path);
                await ctx.replyWithPhoto(new grammy_1.InputFile(compressed), {
                    caption: `📦 Compressed: ${file.name}`,
                });
                (0, tg_1.cleanupFile)(compressed);
                const uncompressed = await (0, media_1.uncompressedImage)(file.path);
                await ctx.replyWithPhoto(new grammy_1.InputFile(uncompressed), {
                    caption: `📦 Original: ${file.name}`,
                });
                (0, tg_1.cleanupFile)(uncompressed);
            }
            catch (err) {
                await ctx.reply(`❌ Failed to send ${file.name}`);
            }
        }
        await progress.delete();
        await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
    }
    catch (err) {
        await progress.update(`❌ Download failed: ${err.message}`);
    }
}
async function downloadAndZip(ctx, info, source) {
    const progress = await (0, progress_1.createProgress)(ctx, '⬇️ Starting download...');
    try {
        const result = await (0, torrent_1.downloadTorrent)(source, progress);
        await progress.update('📦 Compressing as ZIP...');
        const zipPath = (0, tg_1.tempFilePath)(`${info.name}.zip`);
        const { zipPath: finalZip, zipSize } = await (0, zipper_1.zipDirectory)(result.dirPath, zipPath, progress);
        await progress.update('📤 Sending ZIP file...');
        await ctx.replyWithDocument(new grammy_1.InputFile(finalZip, `${info.name}.zip`), {
            caption: `📦 Downloaded from **${info.name}** (${(0, tg_1.formatSize)(zipSize)})`,
            parse_mode: 'Markdown',
        });
        await progress.delete();
        await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
        (0, tg_1.cleanupFile)(finalZip);
    }
    catch (err) {
        await progress.update(`❌ Download/zip failed: ${err.message}`);
    }
}
async function downloadAndUploadAll(ctx, info, source) {
    const progress = await (0, progress_1.createProgress)(ctx, '⬇️ Starting download...');
    try {
        const result = await (0, torrent_1.downloadTorrent)(source, progress);
        await progress.update('📤 Uploading files...');
        for (const file of result.files) {
            try {
                if ((0, constants_1.isVideoFile)(file.name)) {
                    await ctx.replyWithVideo(new grammy_1.InputFile(file.path), {
                        caption: `📥 ${file.name}`,
                    });
                }
                else if ((0, constants_1.isImageFile)(file.name)) {
                    const compressed = await (0, media_1.compressImage)(file.path);
                    await ctx.replyWithPhoto(new grammy_1.InputFile(compressed), {
                        caption: `📦 Compressed: ${file.name}`,
                    });
                    (0, tg_1.cleanupFile)(compressed);
                    const uncompressed = await (0, media_1.uncompressedImage)(file.path);
                    await ctx.replyWithPhoto(new grammy_1.InputFile(uncompressed), {
                        caption: `📦 Original: ${file.name}`,
                    });
                    (0, tg_1.cleanupFile)(uncompressed);
                }
                else {
                    await ctx.replyWithDocument(new grammy_1.InputFile(file.path, file.name), {
                        caption: `📥 ${file.name}`,
                    });
                }
            }
            catch (err) {
                await ctx.reply(`❌ Failed to send ${file.name}`);
            }
        }
        await progress.delete();
        await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
    }
    catch (err) {
        await progress.update(`❌ Download failed: ${err.message}`);
    }
}
//# sourceMappingURL=torrent.js.map