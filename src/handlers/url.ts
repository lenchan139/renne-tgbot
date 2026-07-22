import { Context } from 'grammy';
import { InputFile } from 'grammy';
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

// ─── X/Twitter handler (existing, unchanged) ──────────────────

/**
 * Handle x.com / twitter.com URL messages
 * - In PM: reply with fixupx.com URL
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

  let replacedText = text;
  for (const url of matches) {
    const fixupUrl = url.replace(
      /https?:\/\/(?:www\.)?(x\.com|twitter\.com)/i,
      `https://${X_FIXUP_DOMAIN}`
    );
    replacedText = replacedText.replace(url, fixupUrl);
  }

  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (isGroup) {
    const admin = await isAdmin(ctx);
    if (admin && ctx.message?.message_id) {
      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          ctx.message.message_id,
          replacedText
        );
        return;
      } catch {
        // If edit fails, fall back to reply
      }
    }
  }

  if (replacedText !== text) {
    await ctx.reply(replacedText, {
      reply_parameters: { message_id: ctx.message!.message_id },
    });
  }
}

// ─── Platform URL handler (new) ───────────────────────────────

interface PlatformModule {
  downloadBilibili?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadWeibo?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadThreads?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadDouyin?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadXiaohongshu?: (url: string, opts?: any) => Promise<DownloadResult>;
  downloadTiktok?: (url: string, opts?: any) => Promise<DownloadResult>;
  processWechatArticle?: (url: string) => Promise<any>;
}

const platformModules: Record<string, () => Promise<PlatformModule>> = {
  threads: () => import('../modules/threads.js'),
  xiaohongshu: () => import('../modules/xiaohongshu.js'),
  douyin: () => import('../modules/douyin.js'),
  tiktok: () => import('../modules/tiktok.js'),
  weibo: () => import('../modules/weibo.js'),
  bilibili: () => import('../modules/bilibili.js'),
  wechat: () => import('../modules/wechat.js'),
};

const moduleDownloadFn: Record<string, string> = {
  threads: 'downloadThreads',
  xiaohongshu: 'downloadXiaohongshu',
  douyin: 'downloadDouyin',
  tiktok: 'downloadTiktok',
  weibo: 'downloadWeibo',
  bilibili: 'downloadBilibili',
};

const platformNameMap: Record<string, string> = {
  threads: 'Threads',
  xiaohongshu: '小红书',
  douyin: '抖音',
  tiktok: 'TikTok',
  weibo: '微博',
  bilibili: 'Bilibili',
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

  // Send a "processing" message
  const statusMsg = await ctx.reply(`⏳ 正在处理 ${platformNameMap[key] || key} 链接...`, {
    reply_parameters: { message_id: ctx.message!.message_id },
  });

  try {
    if (key === 'wechat') {
      await handleWechatUrl(ctx, url, statusMsg.message_id);
    } else {
      await handleMediaUrl(ctx, url, key, statusMsg.message_id);
    }
  } catch (err) {
    const errorText = err instanceof Error ? err.message : '未知错误';
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ 处理失败：${errorText}`
    );
  }
}

/**
 * Handle WeChat article URL → Telegraph
 */
async function handleWechatUrl(
  ctx: Context,
  url: string,
  statusMsgId: number
): Promise<void> {
  await ctx.api.editMessageText(
    ctx.chat!.id,
    statusMsgId,
    '⏳ 正在抓取微信文章并上传到 Telegraph...'
  );

  const mod = await import('../modules/wechat.js');
  const result = await mod.processWechatArticle(url);

  if (result.success) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsgId,
      `📄 <b>${escapeHtml(result.title)}</b>\n\n🔗 <a href="${result.telegraphUrl}">在 Telegraph 上阅读</a>`,
      { parse_mode: 'HTML' }
    );
  } else {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsgId,
      `❌ ${result.error}`
    );
  }
}

/**
 * Handle media platform URL → download → send to chat
 */
async function handleMediaUrl(
  ctx: Context,
  url: string,
  key: string,
  statusMsgId: number
): Promise<void> {
  await ctx.api.editMessageText(
    ctx.chat!.id,
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
  await ctx.api.editMessageText(
    ctx.chat!.id,
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
        await ctx.api.editMessageText(
          ctx.chat!.id,
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
  await ctx.api.deleteMessage(ctx.chat!.id, statusMsgId).catch(() => {});

  // Send each file
  for (const { item, localPath } of downloadedItems) {
    try {
      const file = new InputFile(localPath);

      if (item.type === 'video') {
        await ctx.replyWithVideo(file, {
          reply_parameters: { message_id: ctx.message!.message_id },
          width: item.width,
          height: item.height,
          duration: item.duration,
        });
      } else {
        await ctx.replyWithPhoto(file, {
          reply_parameters: { message_id: ctx.message!.message_id },
        });
      }
    } catch (err) {
      console.error(`Failed to send ${localPath}:`, err);
    } finally {
      // Clean up each file after sending
      try { fs.unlinkSync(localPath); } catch {}
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
  wechat: ['mp.weixin.qq.com'],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
