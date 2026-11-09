/**
 * Facebook media downloader.
 *
 * Facebook blocks anonymous scraping of post pages, so we use the
 * embed-fixer service facebed.com as the metadata backend: it crawls
 * the post and exposes `og:video` / `og:image` tags. We then download
 * the actual media and let the bot send it as a native Telegram
 * video/photo (which guarantees playback, unlike link previews).
 *
 * Falls back to the facebed link when no downloadable media is found.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { DownloadResult, MediaItem, DownloadOptions } from './downloader.js';
import { tempFilePath } from '../utils/tg.js';
import { FB_FIXUP_DOMAIN, TG_BOT_MAX_FILE_SIZE } from '../utils/constants.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** facebed serves the Telegram-specific metadata to this UA */
const CRAWLER_UA = 'TelegramBot (like TwitterBot)';

/** Rewrite a facebook.com URL to its facebed.com embed mirror. */
export function toFacebedUrl(url: string): string {
  return url.replace(
    /https?:\/\/(?:www\.|m\.|web\.|mbasic\.|mobile\.)?facebook\.com/i,
    `https://${FB_FIXUP_DOMAIN}`
  );
}

/** Build a caption from the post metadata (Telegram limit ≈ 1024 chars). */
function buildCaption(title: string, description: string, link: string): string {
  const parts: string[] = [];
  if (title) parts.push(title);
  if (description) parts.push(description);
  parts.push(`🔗 ${link}`);

  const text = parts.join('\n\n');
  return text.length > 1000 ? `${text.slice(0, 997)}…` : text;
}

/**
 * Resolve fb.watch / fb.com short links to their canonical facebook.com URL.
 */
async function resolveShortLink(url: string): Promise<string> {
  if (!/fb\.watch\/|fb\.com\//i.test(url)) return url;

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA },
    });
    // fetch exposes the final URL after redirects
    if (res.ok && res.url) return res.url;
  } catch {
    // fall through to the original URL
  }
  return url;
}

/**
 * Download media from a Facebook post/reel/video URL.
 *
 * Returns items with `filePath` already populated, so the shared URL
 * handler does not need to download them a second time.
 */
export async function downloadFacebook(
  url: string,
  options?: DownloadOptions
): Promise<DownloadResult> {
  try {
    const shortResolved = await resolveShortLink(url);

    // Accept facebed links too: normalise them back to facebook.com
    const resolved = shortResolved.replace(
      /^https?:\/\/(?:www\.)?facebed\.com/i,
      'https://www.facebook.com'
    );

    if (!/facebook\.com/i.test(resolved)) {
      return { success: false, error: 'Unsupported Facebook URL' };
    }

    // 1. Fetch metadata via the facebed embed mirror
    const embedUrl = toFacebedUrl(resolved);
    options?.onProgress?.(0, 'Fetching Facebook metadata...');

    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': CRAWLER_UA,
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://www.facebook.com/',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        error: `facebed returned HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Caption metadata: author/title + post text + the facebed link
    const authorTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
    const postText = ($('meta[property="og:description"]').attr('content') || '').trim();

    // 2. Collect media URLs (og:video:secure_url duplicates og:video)
    const videoUrls = new Set<string>();
    const imageUrls = new Set<string>();

    $('meta[property="og:video"], meta[property="og:video:secure_url"]').each(
      (_i, el) => {
        const content = $(el).attr('content');
        if (content) videoUrls.add(content);
      }
    );

    $('meta[property="og:image"]').each((_i, el) => {
      const content = $(el).attr('content');
      if (content) imageUrls.add(content);
    });

    // Prefer video; only fall back to photos for image-only posts
    const media: { type: 'video' | 'photo'; url: string }[] =
      videoUrls.size > 0
        ? [...videoUrls].map((u) => ({ type: 'video' as const, url: u }))
        : [...imageUrls].map((u) => ({ type: 'photo' as const, url: u }));

    if (media.length === 0) {
      // Signal the handler to fall back to the facebed link
      return { success: false, error: 'NO_MEDIA' };
    }

    // 3. Download each item with the proper Referer
    const items: MediaItem[] = [];

    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      try {
        const ext = m.type === 'video' ? '.mp4' : '.jpg';
        options?.onProgress?.(i, `Downloading ${m.type} ${i + 1}/${media.length}...`);

        const dl = await fetch(m.url, {
          headers: {
            'User-Agent': BROWSER_UA,
            Referer: 'https://www.facebook.com/',
          },
        });

        if (!dl.ok) continue;

        const buffer = Buffer.from(await dl.arrayBuffer());

        // Telegram bot upload limit (50 MB)
        if (buffer.length > TG_BOT_MAX_FILE_SIZE) continue;

        const filePath = tempFilePath(`facebook${ext}`);
        fs.writeFileSync(filePath, buffer);
        items.push({
          type: m.type,
          url: m.url,
          filePath,
          // Attach the caption to the first item only, so it isn't repeated
          caption:
            items.length === 0
              ? buildCaption(authorTitle, postText, embedUrl)
              : undefined,
        });
      } catch {
        // Skip this item and continue with the rest
      }
    }

    if (items.length === 0) {
      return {
        success: false,
        error: 'Failed to download Facebook media (too large or unavailable)',
      };
    }

    return { success: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Facebook download error: ${message}` };
  }
}
