import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { btCommand } from './commands/bt.js';
import { handleImage, handleImageAction } from './handlers/image.js';
import { handleVideo, handleVideoAction } from './handlers/video.js';
import { handleGif, handleGifAction } from './handlers/gif.js';
import { handleXUrl } from './handlers/url.js';
import {
  handleTorrentFile,
  handleMagnetLink,
} from './handlers/torrent.js';
import { extractMagnet } from './utils/tg.js';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Bot(token);

// ─── Command handlers ───────────────────────────────────────

bot.command('start', startCommand);
bot.command('help', helpCommand);
bot.command('bt', btCommand);

// ─── Message handlers ───────────────────────────────────────

bot.on('message', async (ctx) => {
  const msg = ctx.message;
  const text = msg.text || '';
  const isDigitReply = /^\d$/.test(text);
  const repliedTo = msg.reply_to_message;

  // 1. Action replies (digit text replying to photo/video/gif)
  if (isDigitReply && repliedTo) {
    if (repliedTo.photo && /^(1|2|3)$/.test(text)) {
      return handleImageAction(ctx, text as '1' | '2' | '3');
    }
    if (repliedTo.video && text === '1') {
      return handleVideoAction(ctx, '1');
    }
    if (repliedTo.animation && /^(1|2)$/.test(text)) {
      return handleGifAction(ctx, text as '1' | '2');
    }
  }

  // 2. Document (torrent file)
  if (msg.document) {
    const name = msg.document.file_name || '';
    if (name.endsWith('.torrent')) {
      return handleTorrentFile(ctx);
    }
  }

  // 3. Magnet link in text
  if (text && extractMagnet(text)) {
    return handleMagnetLink(ctx);
  }

  // 4. x.com / twitter.com URL
  if (text && /(x\.com|twitter\.com)/i.test(text)) {
    return handleXUrl(ctx);
  }

  // 5. Photo — ask what to do
  if (msg.photo) {
    return handleImage(ctx);
  }

  // 6. Video — ask what to do
  if (msg.video) {
    return handleVideo(ctx);
  }

  // 7. GIF / Animation — ask what to do
  if (msg.animation) {
    return handleGif(ctx);
  }
});

// ─── Error handling ─────────────────────────────────────────

bot.catch((err) => {
  console.error('Bot error:', err);
});

// ─── Start polling ──────────────────────────────────────────

console.log('🚀 Renne Bot starting...');
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ Bot @${botInfo.username} is running!`);
  },
});
