import { Context, InputFile, InputMediaBuilder } from 'grammy';
import { isAdmin } from '../utils/tg.js';
import {
  X_DOMAINS,
  X_FIXUP_DOMAIN,
  TMP_DIR,
  TG_BOT_MAX_FILE_SIZE,
} from '../utils/constants.js';
import {
  matchPlatform,
  type DownloadResult,
  type MediaItem,
} from '../modules/downloader.js';
import fs from 'fs';
import path from 'path';

// ─── Shared helpers ──────────────────────────────────────────

function isGroupChat(ctx: Context): boolean {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

/** True when Telegram reports that the replied/edited message no longer exists. */
function isMessageGone(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /message to (?:be replied|reply|edit) not found|message to edit not found|message_id_invalid|reply message not found/i.test(
    message
  );
}

/** Edit the progress message if we have one (groups run without one). */
async function editStatus(
  ctx: Context,
  statusMsgId: number | undefined,
  text: string,
  extra?: any
): Promise<void> {
  if (statusMsgId === undefined) return;
  await ctx.api
    .editMessageText(ctx.chat!.id, statusMsgId, text, extra)
    .catch(() => {});
}

async function deleteStatus(
  ctx: Context,
  statusMsgId: number | undefined
): Promise<void> {
  if (statusMsgId === undefined) return;
  await ctx.api.deleteMessage(ctx.chat!.id, statusMsgId).catch(() => {});
}

// ─── URL fixup handler (X/Twitter) ───────────────────────────

/**
 * Reply with the fixed text, or (in a group, when the sender is an
 * admin) edit the original message in place.
 * If the original message was deleted, do nothing.
 */
async function sendFixedUrl(
  ctx: Context,
  originalText: string,
  fixedText: string
): Promise<void> {
  if (fixedText === originalText) return;

  if (isGroupChat(ctx)) {
    const admin = await isAdmin(ctx);
    if (admin && ctx.message?.message_id) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          ctx.message.message_id,
          fixedText
        );
        return;
      } catch (err) {
        // Original message already deleted → stay silent
        if (isMessageGone(err)) return;
        // Other edit failures fall back to a reply
      }
    }
  }

  try {
    await ctx.reply(fixedText, {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
  } catch (err) {
    if (!isMessageGone(err)) throw err;
  }
}

/**
 * Handle x.com / twitter.com URL messages → fixupx.com
 * - In PM: reply with the fixed URL
 * - In group with admin: edit the original message
 */
export async function handleXUrl(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  const urlRegex = new RegExp(
    `(https?://(?:www\\.)?(${X_DOMAINS.join('|')})/[^\\s]+)`,
    'gi'
  );
  const matches = text.match(urlRegex);
  if (!matches || matches.length === 0) return;

  let fixedText = text;
  for (const url of matches) {
    const fixupUrl = url.replace(
      /https?:\/\/(?:www\.)?(x\.com|twitter\.com)/i,
      `https://${X_FIXUP_DOMAIN}`
    );
    fixedText = fixedText.replace(url, fixupUrl);
  }

  await sendFixedUrl(ctx, text, fixedText);
}

// ─── Platform URL handler (new) ───────────────────────────────

interface PlatformModule {
  downloadBilibili?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadWeibo?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadThreads?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadDouyin?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadXiaohongshu?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadTiktok?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadFacebook?: (url: string, opts?: any) => Promise<DownloadResult>;
  processWechatArticle?: (url: string) => Promise<any>;
}

const platformModules: Record<string, () => Promise<PlatformModule>> = {
  threads: () => import('../modules/threads.js'),
  xiaohongshu: () => import('../modules/xiaohongshu.js'),
  douyin: () => import('../modules/douyin.js'),
  tiktok: () => import('../modules/tiktok.js'),
  weibo: () => import('../modules/weibo.js'),
  bilibili: () => import('../modules/bilibili.js'),
  facebook: () => import('../modules/facebook.js'),
  wechat: () => import('../modules/wechat.js'),
};

const moduleDownloadFn: Record<string, string> = {
  threads: 'downloadThreads',
  xiaohongshu: 'downloadXiaohongshu',
  douyin: 'downloadDouyin',
  tiktok: 'downloadTiktok',
  weibo: 'downloadWeibo',
  bilibili: 'downloadBilibili',
  facebook: 'downloadFacebook',
};

const platformNameMap: Record<string, string> = {
  threads: 'Threads',
  xiaohongshu: '小红书',
  douyin: '抖音',
  tiktok: 'TikTok',
  weibo: '微博',
  bilibili: 'Bilibili',
  facebook: 'Facebook',
  wechat: '微信公众号',
};

/**
 * Handle platform URL messages (Threads, 小红书, 抖音, TikTok, 微博, Bilibili)
 * For 微信公众号, create a Telegraph page instead.
 */
export async function handlePlatformUrl(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  // Find all matching platform URLs in the message
  const matchedUrls: { url: string; key: string }[] = [];

  for (const [key, domains] of Object.entries(platformDomainMap)) {
    for (const domain of domains) {
      const regex = new RegExp(
        `https?://(?:[\\w-]+\\.)*${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^\\s)」』】】]+`,
        'gi'
      );
      const matches = text.match(regex);
      if (matches) {
        for (const url of matches) {
          matchedUrls.push({ url: url.trim(), key });
        }
      }
    }
  }

  if (matchedUrls.length === 0) return;

  // Use the first matched URL
  const { url, key } = matchedUrls[0];

  // Groups get no progress message (less noise / anti-spam impact)
  let statusMsgId: number | undefined;
  if (!isGroupChat(ctx)) {
    const statusMsg = await ctx.reply(
      `⏳ 正在处理 ${platformNameMap[key] || key} 链接...`,
      { reply_parameters: { message_id: ctx.message!.message_id } }
    );
    statusMsgId = statusMsg.message_id;
  }

  try {
    if (key === 'wechat') {
      // WeChat articles are not SNS previews; skip in groups
      if (isGroupChat(ctx)) return;
      await handleWechatUrl(ctx, url, statusMsgId);
    } else if (key === 'facebook') {
      await handleFacebookMediaUrl(ctx, url, statusMsgId);
    } else {
      await handleMediaUrl(ctx, url, key, statusMsgId);
    }
  } catch (err) {
    // Don't post error messages in groups
    if (statusMsgId === undefined) {
      console.error('URL handling failed:', err);
      return;
    }
    const errorText = err instanceof Error ? err.message : '未知错误';
    await editStatus(ctx, statusMsgId, `❌ 处理失败：${errorText}`);
  }
}

/**
 * Facebook: try to download media and send it natively. When the post has
 * no downloadable media (or Facebook blocks it), fall back to the
 * facebed.com embed link.
 */
async function handleFacebookMediaUrl(
  ctx: Context,
  url: string,
  statusMsgId: number | undefined
): Promise<void> {
  try {
    await handleMediaUrl(ctx, url, 'facebook', statusMsgId);
  } catch (err) {
    const { toFacebedUrl } = await import('../modules/facebook.js');
    const fixed = toFacebedUrl(url);

    if (!fixed || fixed === url) throw err;

    // Remove the status message and reply with the embed link instead
    await deleteStatus(ctx, statusMsgId);
    try {
      await ctx.reply(fixed, {
        reply_parameters: { message_id: ctx.message!.message_id },
      });
    } catch (e) {
      if (!isMessageGone(e)) throw e;
    }
  }
}

/**
 * Handle WeChat article URL → Telegraph
 */
async function handleWechatUrl(
  ctx: Context,
  url: string,
  statusMsgId: number | undefined
): Promise<void> {
  await editStatus(
    ctx,
    statusMsgId,
    '⏳ 正在抓取微信文章并上传到 Telegraph...'
  );

  const mod = await import('../modules/wechat.js');
  const result = await mod.processWechatArticle(url);

  if (statusMsgId !== undefined) {
    if (result.success) {
      await editStatus(
        ctx,
        statusMsgId,
        `📄 <b>${escapeHtml(result.title)}</b>\n\n🔗 <a href="${result.telegraphUrl}">在 Telegraph 上阅读</a>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await editStatus(ctx, statusMsgId, `❌ ${result.error}`);
    }
    return;
  }

  // No status message (groups): only post on success
  if (result.success) {
    try {
      await ctx.reply(
        `📄 <b>${escapeHtml(result.title)}</b>\n\n🔗 <a href="${result.telegraphUrl}">在 Telegraph 上阅读</a>`,
        {
          reply_parameters: { message_id: ctx.message!.message_id },
          parse_mode: 'HTML',
        }
      );
    } catch (e) {
      if (!isMessageGone(e)) throw e;
    }
  }
}

/**
 * Handle media platform URL → download → send to chat
 */
async function handleMediaUrl(
  ctx: Context,
  url: string,
  key: string,
  statusMsgId: number | undefined
): Promise<void> {
  await editStatus(
    ctx,
    statusMsgId,
    `⏳ 正在下载 ${platformNameMap[key] || key} 内容...`
  );

  // Dynamic import the platform module
  const mod = await platformModules[key]();
  const fnName = moduleDownloadFn[key];
  const downloadFn = (mod as any)[fnName];

  if (!downloadFn) {
    throw new Error(`${platformNameMap[key] || key} 下载功能暂未实现`);
  }

  const result: DownloadResult = await downloadFn(url);

  if (!result.success) {
    throw new Error(result.error);
  }

  if (result.items.length === 0) {
    throw new Error('未找到可下载的内容');
  }

  // Check file sizes before downloading
  await editStatus(
    ctx,
    statusMsgId,
    `⏳ 正在下载 ${result.items.length} 个文件并发送...`
  );

  // Download all items first, then send
  const downloadedItems: { item: MediaItem; localPath: string }[] = [];

  for (let i = 0; i < result.items.length; i++) {
    const item = result.items[i];

    let localPath: string;

    // If the module already downloaded the file, use it directly
    if (item.filePath && fs.existsSync(item.filePath)) {
      localPath = item.filePath;
    } else {
      const ext = path.extname(new URL(item.url).pathname) || '.mp4';
      localPath = path.join(TMP_DIR, `platform_${Date.now()}_${i}${ext}`);

      const resp = await fetch(item.url);
      if (!resp.ok) {
        throw new Error(`下载文件 ${i + 1} 失败 (HTTP ${resp.status})`);
      }

      const buffer = Buffer.from(await resp.arrayBuffer());

      // Check size limit (50MB for bot)
      if (buffer.length > TG_BOT_MAX_FILE_SIZE) {
        // Still download others, but skip this one
        await editStatus(
          ctx,
          statusMsgId,
          `⚠️ 文件 ${i + 1} 超过 50MB 限制，已跳过`
        );
        continue;
      }

      if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
      }
      fs.writeFileSync(localPath, buffer);
    }

    downloadedItems.push({ item, localPath });
  }

  // Delete the status message before sending media
  await deleteStatus(ctx, statusMsgId);

  try {
    await sendDownloadedMedia(ctx, downloadedItems);
  } finally {
    // Clean up all files after sending
    for (const { localPath } of downloadedItems) {
      try { fs.unlinkSync(localPath); } catch {}
    }
  }
}

// ─── Media sending ───────────────────────────────────────────

/** Telegram albums allow at most 10 items. */
const MAX_MEDIA_PER_GROUP = 10;

function isVideoLike(item: MediaItem): boolean {
  return item.type === 'video' || item.type === 'animation';
}

/** Send a single photo/video with its caption. */
async function sendSingleMedia(
  ctx: Context,
  item: MediaItem,
  localPath: string,
  replyTo: number
): Promise<void> {
  const file = new InputFile(localPath);

  if (isVideoLike(item)) {
    await ctx.replyWithVideo(file, {
      reply_parameters: { message_id: replyTo },
      width: item.width,
      height: item.height,
      duration: item.duration,
      caption: item.caption,
    });
  } else {
    await ctx.replyWithPhoto(file, {
      reply_parameters: { message_id: replyTo },
      caption: item.caption,
    });
  }
}

/**
 * Send downloaded media, batching multiple items into Telegram albums
 * (media groups, up to 10 per message). Falls back to individual sends
 * if an album fails.
 */
async function sendDownloadedMedia(
  ctx: Context,
  items: { item: MediaItem; localPath: string }[]
): Promise<void> {
  const replyTo = ctx.message!.message_id;

  for (let start = 0; start < items.length; start += MAX_MEDIA_PER_GROUP) {
    const chunk = items.slice(start, start + MAX_MEDIA_PER_GROUP);

    // A single item cannot be a media group
    if (chunk.length === 1) {
      const { item, localPath } = chunk[0];
      try {
        await sendSingleMedia(ctx, item, localPath, replyTo);
      } catch (err) {
        // Original message deleted → stay silent
        if (isMessageGone(err)) return;
        console.error(`Failed to send ${localPath}:`, err);
      }
      continue;
    }

    try {
      const media = chunk.map(({ item, localPath }, idx) => {
        // Keep the caption on the first item only
        const caption = idx === 0 ? item.caption : undefined;

        if (isVideoLike(item)) {
          return InputMediaBuilder.video(new InputFile(localPath), {
            width: item.width,
            height: item.height,
            duration: item.duration,
            supports_streaming: true,
            caption,
          });
        }

        return InputMediaBuilder.photo(new InputFile(localPath), { caption });
      });

      await ctx.replyWithMediaGroup(media, {
        reply_parameters: { message_id: replyTo },
      });
    } catch (err) {
      // Original message deleted → stay silent
      if (isMessageGone(err)) return;

      console.error('Failed to send media group, falling back:', err);
      for (const { item, localPath } of chunk) {
        try {
          await sendSingleMedia(ctx, item, localPath, replyTo);
        } catch (e) {
          if (isMessageGone(e)) return;
          console.error(`Failed to send ${localPath}:`, e);
        }
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────

const platformDomainMap: Record<string, string[]> = {
  threads: ['threads.net'],
  xiaohongshu: ['xhslink.com', 'xiaohongshu.com'],
  douyin: ['v.douyin.com', 'douyin.com'],
  tiktok: ['vt.tiktok.com', 'tiktok.com', 'vm.tiktok.com'],
  weibo: ['weibo.com', 'm.weibo.cn', 'weibo.cn'],
  bilibili: ['bilibili.com', 'b23.tv'],
  facebook: ['facebook.com', 'fb.watch', 'fb.com', 'facebed.com'],
  wechat: ['mp.weixin.qq.com'],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
