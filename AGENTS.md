# Renne TGBot — Agent Guide

## Overview

Renne is a Telegram bot built with [grammy](https://grammy.dev) (TypeScript, ESM).  
It runs under pm2 on a Synology NAS (`_pm2_prod_run` branch).

**Key capabilities:**
- Torrent download (magnet / .torrent file)
- Media tools: image→animation, video→animation, GIF→MP4/PNG
- Reverse image search (Google Lens, SauceNAO)
- X/Twitter URL fixup (→ fixupx.com)
- **Platform media download:** Threads, 小红书, 抖音, TikTok, 微博, Bilibili
- **WeChat → Telegraph** auto-migration

---

## Project Structure

```
src/
├── bot.ts                  # Entry point — message + callback routing
├── commands/
│   ├── start.ts            # /start
│   ├── help.ts             # /help
│   └── bt.ts               # /bt (torrent)
├── handlers/
│   ├── image.ts            # Photo → inline keyboard actions
│   ├── video.ts            # Video → inline keyboard actions
│   ├── gif.ts              # GIF → inline keyboard actions
│   ├── torrent.ts          # Torrent file / magnet handlers
│   └── url.ts              # X fixup + platform URL router
├── modules/
│   ├── downloader.ts       # Shared types (DownloadResult, MediaItem, PlatformMatcher)
│   ├── media.ts            # FFmpeg conversions (animation, video, gif, frame extract)
│   ├── search.ts           # Image search (Google, Yandex)
│   ├── torrent.ts          # WebTorrent client
│   ├── zipper.ts           # ZIP compression
│   ├── threads.ts          # Threads downloader
│   ├── xiaohongshu.ts      # 小红书 downloader
│   ├── douyin.ts           # 抖音 downloader
│   ├── tiktok.ts           # TikTok downloader
│   ├── weibo.ts            # 微博 downloader
│   ├── bilibili.ts         # Bilibili downloader
│   └── wechat.ts           # WeChat article → Telegraph converter
└── utils/
    ├── tg.ts               # Temp file, admin check, magnet extract
    ├── constants.ts        # Limits, domain lists, file extensions
    ├── progress.ts         # ProgressTracker (edit-able status msg)
    └── telegraph.ts        # Telegraph API client (account, page creation)
```

---

## Architecture Rules

### 1. Module Pattern

Each platform downloader module follows this pattern:

```typescript
import { DownloadResult, MediaItem, DownloadOptions } from './downloader.js';

export async function downloadPlatform(
  url: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  try {
    // 1. parse URL, extract ID
    // 2. fetch / scrape data
    // 3. download media to temp dir
    // 4. return { success: true, items: [...] }
  } catch (err) {
    return { success: false, error: message };
  }
}
```

- `DownloadResult` = `{ success: true; items: MediaItem[] } | { success: false; error: string }`
- `MediaItem` = `{ type: 'photo' | 'video' | 'animation' | 'telegraph'; url: string; filePath?: string; ... }`
- All imports use `.js` extension (ESM).
- Dynamic imports for optional deps (`try { await import('xhs-api') } catch { /* fallback */ }`).

### 2. Handler Pattern

Handlers receive `ctx: Context` from grammy.  
User interactions use **inline keyboards** (`InlineKeyboard`), not text replies.

```typescript
const keyboard = new InlineKeyboard()
  .text('Label', 'callback_data');

await ctx.reply('Prompt', {
  reply_markup: keyboard,
  reply_parameters: { message_id: ctx.message!.message_id },
});
```

Callback queries are routed in `bot.ts` via `bot.callbackQuery(/^(img|vid|gif)_/, ...)`.

### 3. Media Sending

- **Animations** (looping, no controls): use `ctx.replyWithAnimation(new InputFile(path))`
- **Photos**: `ctx.replyWithPhoto(new InputFile(path))`
- **Videos**: `ctx.replyWithVideo(new InputFile(path))`
- Never convert to `.gif` format — Telegram's `sendAnimation` natively supports MP4 with better quality/size.

### 4. Temp Files

- `tempFilePath(name)` → `/tmp/renne-bot/{ts}-{rand}-{name}`
- Always clean up in `finally` blocks using `cleanupFile()` / `cleanupDir()`.
- Check `TG_BOT_MAX_FILE_SIZE` (50 MB) before sending.

### 5. Progress

Use `createProgress(ctx, 'initial text')` which returns a tracker with `.update(text)` and `.delete()`.

### 6. Error Handling

- Every module function returns a typed result (never throws to caller).
- The URL handler in `url.ts` catches errors and edits the status message with ❌.
- Bot-level catch-all: `bot.catch()` in `bot.ts`.

---

## Dependencies

**Hard (always installed):**
- `grammy`, `cheerio`, `dotenv`, `fluent-ffmpeg`, `sharp`, `archiver`, `webtorrent`, `parse-torrent`

**Optional (dynamic import with fallback):**
- `xhs-api` — 小红书 backend
- `tiktok-dl` — TikTok backend

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `TELEGRAPH_TOKEN` | ❌ | Optional; auto-creates anonymous account if missing |

---

## Building & Deploying

```sh
npm run build       # tsc → dist/
npm run dev         # tsx src/bot.ts (hot reload)
pm2 start ecosystem/ecosystem.config.cjs
pm2 restart all
```

---

## Adding a New Platform Downloader

1. Create `src/modules/{platform}.ts` following the module pattern above.
2. Register URL patterns in `src/modules/downloader.ts` (`PLATFORM_MATCHERS` array).
3. The URL router in `src/handlers/url.ts` auto-detects and routes to the new module.
4. Update `src/utils/constants.ts` `PLATFORM_CONFIGS` if needed.
5. No changes needed in `bot.ts` — routing is pattern-based.
