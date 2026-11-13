import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';
import { startCommand } from './commands/start.js';
import { helpCommand } from './commands/help.js';
import { btCommand } from './commands/bt.js';
import { handleImage, handleImageAction } from './handlers/image.js';
import { handleVideo, handleVideoAction } from './handlers/video.js';
import { handleGif, handleGifAction } from './handlers/gif.js';
import { handleXUrl, handlePlatformUrl } from './handlers/url.js';
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

/** SNS / platform URLs that the bot turns into fixed links or media previews. */
const X_URL_RE = /\b(x\.com|twitter\.com)\b/i;
const PLATFORM_URL_RE =
  /(threads\.net|xhslink\.com|xiaohongshu\.com|v\.douyin\.com|douyin\.com|vt\.tiktok\.com|tiktok\.com|vm\.tiktok\.com|weibo\.com|m\.weibo\.cn|weibo\.cn|bilibili\.com|b23\.tv|facebook\.com|fb\.watch|fb\.com|facebed\.com|mp\.weixin\.qq\.com)/i;

/**
 * Whether a group message is explicitly directed at this bot:
 * either it @mentions the bot, or it replies to a bot message.
 */
function isDirectedAtBot(ctx: Context): boolean {
  const msg = ctx.message;
  if (!msg) return false;

  // Reply to one of this bot's messages
  const replied = msg.reply_to_message;
  if (replied?.from?.id === ctx.me.id) return true;

  // @mention of the bot's username
  const username = ctx.me.username;
  if (!username) return false;

  const mention = `@${username}`.toLowerCase();
  const entities = msg.entities ?? msg.caption_entities ?? [];
  const source = msg.text ?? msg.caption ?? '';

  for (const ent of entities) {
    if (ent.type === 'mention') {
      const raw = source.slice(ent.offset, ent.offset + ent.length);
      if (raw.toLowerCase() === mention) return true;
    }
    if (ent.type === 'text_mention' && ent.user?.id === ctx.me.id) {
      return true;
    }
  }

  // Fallback for clients that don't expose entities
  return source.toLowerCase().includes(mention);
}

// ─── Command handlers ───────────────────────────────────────

bot.command('start', startCommand);
bot.command('help', helpCommand);
bot.command('bt', btCommand);

// ─── Message handlers ───────────────────────────────────────

bot.on('message', async (ctx) => {
  const msg = ctx.message;
  const text = msg.text || '';
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // ─── Groups: only react when @mentioned or replied to ────────
  // Otherwise ignore (no torrents, images, videos, GIFs or bare links).
  // (Commands such as /bt still work via the handlers above.)
  if (isGroup) {
    if (!isDirectedAtBot(ctx)) return;

    if (text && X_URL_RE.test(text)) {
      return handleXUrl(ctx);
    }
    if (text && PLATFORM_URL_RE.test(text)) {
      return handlePlatformUrl(ctx);
    }
    return;
  }

  // ─── Private chats: full feature set ─────────────────────────

  // 1. Document (torrent file)
  if (msg.document) {
    const name = msg.document.file_name || '';
    if (name.endsWith('.torrent')) {
      return handleTorrentFile(ctx);
    }
  }

  // 2. Magnet link in text
  if (text && extractMagnet(text)) {
    return handleMagnetLink(ctx);
  }

  // 3. x.com / twitter.com URL
  if (text && X_URL_RE.test(text)) {
    return handleXUrl(ctx);
  }

  // 4. Platform media URLs (Threads, 小红书, 抖音, TikTok, 微博, Bilibili, Facebook, 微信)
  if (text && PLATFORM_URL_RE.test(text)) {
    return handlePlatformUrl(ctx);
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

// ─── Callback query handlers (inline buttons) ─────────────────

bot.callbackQuery(/^(img|vid|gif)_/, async (ctx) => {
  // Media conversions are private-chat only
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data.startsWith('img_')) {
    return handleImageAction(ctx, data);
  }
  if (data.startsWith('vid_')) {
    return handleVideoAction(ctx, data);
  }
  if (data.startsWith('gif_')) {
    return handleGifAction(ctx, data);
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
