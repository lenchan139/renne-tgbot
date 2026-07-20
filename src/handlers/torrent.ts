import { Context, InputFile } from 'grammy';
import * as fs from 'fs';
import {
  downloadTorrent,
  crawlMagnet,
  crawlTorrentBuffer,
  categorizeFiles,
  TorrentInfo,
} from '../modules/torrent';
import { compressImage, uncompressedImage } from '../modules/media';
import { zipDirectory } from '../modules/zipper';
import { createProgress } from '../utils/progress';
import {
  tempFilePath,
  cleanupFile,
  formatSize,
} from '../utils/tg';
import {
  TG_MAX_FILE_SIZE,
  isImageFile,
  isVideoFile,
  isTorrentFile,
} from '../utils/constants';

/**
 * Handle a torrent file upload
 */
export async function handleTorrentFile(ctx: Context) {
  const doc = ctx.message?.document;
  if (!doc) return;

  if (!isTorrentFile(doc.file_name || '')) return;

  await ctx.reply('📥 Received torrent file, crawling info...');

  const file = await ctx.api.getFile(doc.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(fileUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const torrentPath = tempFilePath(doc.file_name || 'torrent.torrent');
  fs.writeFileSync(torrentPath, buffer);

  try {
    const info = await crawlTorrentBuffer(buffer);
    await processTorrent(ctx, info, buffer);
  } catch (err) {
    await ctx.reply(`❌ Failed to parse torrent: ${(err as Error).message}`);
  } finally {
    cleanupFile(torrentPath);
  }
}

/**
 * Handle a magnet link sent as text
 */
export async function handleMagnetLink(ctx: Context) {
  const text = ctx.message?.text || '';
  const match = text.match(/magnet:\?xt=[^\s]+/i);
  if (!match) return;

  const magnet = match[0];
  await ctx.reply('📥 Crawling magnet link info...');

  try {
    const info = await crawlMagnet(magnet);
    await processTorrent(ctx, info, magnet);
  } catch (err) {
    await ctx.reply(`❌ Failed to crawl magnet: ${(err as Error).message}`);
  }
}

/**
 * Process a torrent after info has been crawled
 */
async function processTorrent(
  ctx: Context,
  info: TorrentInfo,
  torrentSource: string | Buffer
) {
  const summary = info.files
    .slice(0, 20)
    .map((f) => `• ${f.name} (${formatSize(f.size)})`)
    .join('\n');
  const more = info.files.length > 20 ? `\n... and ${info.files.length - 20} more` : '';

  await ctx.reply(
    `📋 **Torrent: ${info.name}**\n` +
    `Total size: ${formatSize(info.totalSize)}\n` +
    `Files: ${info.files.length}\n\n` +
    summary + more,
    { parse_mode: 'Markdown' }
  );

  if (info.totalSize <= TG_MAX_FILE_SIZE && info.files.length <= 1) {
    await downloadAndUploadSingle(ctx, info, torrentSource);
  } else if (info.files.length === 1 && info.files[0].size > TG_MAX_FILE_SIZE) {
    const file = info.files[0];
    if (isVideoFile(file.name)) {
      await downloadAndUploadSingle(ctx, info, torrentSource);
    } else {
      await downloadAndZip(ctx, info, torrentSource);
    }
  } else if (info.totalSize > TG_MAX_FILE_SIZE) {
    const cats = categorizeFiles(info.files);

    if (cats.videos.length === 1 && cats.images.length === 0 && cats.others.length === 0) {
      await downloadAndUploadSingle(ctx, info, torrentSource);
    } else if (cats.images.length > 0 && cats.videos.length === 0 && cats.others.length === 0) {
      await downloadAndSendImages(ctx, info, torrentSource);
    } else {
      await downloadAndZip(ctx, info, torrentSource);
    }
  } else {
    await downloadAndUploadAll(ctx, info, torrentSource);
  }
}

async function downloadAndUploadSingle(
  ctx: Context,
  info: TorrentInfo,
  source: string | Buffer
) {
  const progress = await createProgress(ctx, '⬇️ Starting download...');

  try {
    const result = await downloadTorrent(source, progress);
    const file = result.files[0];
    if (!file) throw new Error('No files in torrent');

    await progress.update('📤 Uploading to Telegram...');

    if (isVideoFile(file.name)) {
      await ctx.replyWithVideo(new InputFile(file.path), {
        caption: '📥 Downloaded from torrent',
      });
    } else if (isImageFile(file.name)) {
      await ctx.replyWithPhoto(new InputFile(file.path), {
        caption: '📥 Downloaded from torrent',
      });
    } else {
      await ctx.replyWithDocument(new InputFile(file.path, file.name), {
        caption: '📥 Downloaded from torrent',
      });
    }

    await progress.delete();
    await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
  } catch (err) {
    await progress.update(`❌ Download failed: ${(err as Error).message}`);
  }
}

async function downloadAndSendImages(
  ctx: Context,
  info: TorrentInfo,
  source: string | Buffer
) {
  const progress = await createProgress(ctx, '⬇️ Starting download...');

  try {
    const result = await downloadTorrent(source, progress);
    await progress.update('📤 Uploading images...');

    for (const file of result.files) {
      if (!isImageFile(file.name)) continue;

      try {
        const compressed = await compressImage(file.path);
        await ctx.replyWithPhoto(new InputFile(compressed), {
          caption: `📦 Compressed: ${file.name}`,
        });
        cleanupFile(compressed);

        const uncompressed = await uncompressedImage(file.path);
        await ctx.replyWithPhoto(new InputFile(uncompressed), {
          caption: `📦 Original: ${file.name}`,
        });
        cleanupFile(uncompressed);
      } catch (err) {
        await ctx.reply(`❌ Failed to send ${file.name}`);
      }
    }

    await progress.delete();
    await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
  } catch (err) {
    await progress.update(`❌ Download failed: ${(err as Error).message}`);
  }
}

async function downloadAndZip(
  ctx: Context,
  info: TorrentInfo,
  source: string | Buffer
) {
  const progress = await createProgress(ctx, '⬇️ Starting download...');

  try {
    const result = await downloadTorrent(source, progress);
    await progress.update('📦 Compressing as ZIP...');

    const zipPath = tempFilePath(`${info.name}.zip`);
    const { zipPath: finalZip, zipSize } = await zipDirectory(
      result.dirPath,
      zipPath,
      progress
    );

    await progress.update('📤 Sending ZIP file...');
    await ctx.replyWithDocument(
      new InputFile(finalZip, `${info.name}.zip`),
      {
        caption: `📦 Downloaded from **${info.name}** (${formatSize(zipSize)})`,
        parse_mode: 'Markdown',
      }
    );

    await progress.delete();
    await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
    cleanupFile(finalZip);
  } catch (err) {
    await progress.update(`❌ Download/zip failed: ${(err as Error).message}`);
  }
}

async function downloadAndUploadAll(
  ctx: Context,
  info: TorrentInfo,
  source: string | Buffer
) {
  const progress = await createProgress(ctx, '⬇️ Starting download...');

  try {
    const result = await downloadTorrent(source, progress);
    await progress.update('📤 Uploading files...');

    for (const file of result.files) {
      try {
        if (isVideoFile(file.name)) {
          await ctx.replyWithVideo(new InputFile(file.path), {
            caption: `📥 ${file.name}`,
          });
        } else if (isImageFile(file.name)) {
          const compressed = await compressImage(file.path);
          await ctx.replyWithPhoto(new InputFile(compressed), {
            caption: `📦 Compressed: ${file.name}`,
          });
          cleanupFile(compressed);

          const uncompressed = await uncompressedImage(file.path);
          await ctx.replyWithPhoto(new InputFile(uncompressed), {
            caption: `📦 Original: ${file.name}`,
          });
          cleanupFile(uncompressed);
        } else {
          await ctx.replyWithDocument(new InputFile(file.path, file.name), {
            caption: `📥 ${file.name}`,
          });
        }
      } catch (err) {
        await ctx.reply(`❌ Failed to send ${file.name}`);
      }
    }

    await progress.delete();
    await ctx.reply(`✅ Done! Downloaded from **${info.name}**`, { parse_mode: 'Markdown' });
  } catch (err) {
    await progress.update(`❌ Download failed: ${(err as Error).message}`);
  }
}
