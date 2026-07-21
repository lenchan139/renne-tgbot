/**
 * Xiaohongshu / 小红书 (xhslink.com) media downloader.
 *
 * Downloads images from Xiaohongshu share links using the `xhs-api`
 * npm package when available, with a JSON-LD fallback.
 */

import type { DownloadResult, MediaItem, DownloadOptions } from './downloader.js';

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Follow an xhslink.com short URL to its destination (xiaohongshu.com).
 */
async function resolveShortUrl(shortUrl: string): Promise<string> {
  const resp = await fetch(shortUrl, {
    method: 'HEAD',
    redirect: 'manual',
  });
  // The redirect location header holds the full URL.
  const location = resp.headers.get('location');
  if (!location) {
    // Some servers don't respond to HEAD; try GET with no-follow.
    const resp2 = await fetch(shortUrl, { redirect: 'manual' });
    const loc2 = resp2.headers.get('location');
    if (!loc2) throw new Error('无法解析小红书短链接：未找到跳转地址');
    return loc2;
  }
  return location;
}

/**
 * Extract the note ID from a xiaohongshu.com URL.
 */
function extractNoteId(url: string): string | null {
  // /explore/{note_id}  or  /discovery/item/{note_id}
  const patterns = [
    /xiaohongshu\.com\/explore\/([a-f0-9]+)/i,
    /xiaohongshu\.com\/discovery\/item\/([a-f0-9]+)/i,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

// ─── Downloaders ────────────────────────────────────────────────

/**
 * Attempt to download via the `xhs-api` npm package.
 */
async function downloadViaPackage(
  noteId: string,
  _options?: DownloadOptions,
): Promise<DownloadResult | null> {
  try {
    const xhs: any = await import('xhs-api');
    // Try to get a constructor — the package may export default, XhsClient, or itself
    const XhsCtor: any = xhs.default?.XhsClient ?? xhs.default ?? xhs.XhsClient ?? xhs;
    if (typeof XhsCtor !== 'function' && typeof XhsCtor !== 'object') return null;
    const client = typeof XhsCtor === 'function' ? new XhsCtor() : XhsCtor;
    const note: any = await client?.getNote?.(noteId);
    if (!note) return null;

    const items: MediaItem[] = [];
    // Images may be in note.imageList or similar.
    const imageList = note.imageList ?? note.images ?? [];
    for (const img of imageList) {
      // The URL can be a string or an object with a url key.
      const imgUrl = typeof img === 'string' ? img : img?.url ?? img?.infoList?.[0]?.url;
      if (imgUrl) {
        items.push({ type: 'photo', url: imgUrl });
      }
    }

    if (items.length > 0) {
      return { success: true, items };
    }
    return null;
  } catch {
    return null; // fall through
  }
}

/**
 * Fallback: fetch the note page and extract image URLs from JSON-LD data.
 */
async function downloadViaPageFallback(
  noteId: string,
  url: string,
  _options?: DownloadOptions,
): Promise<DownloadResult | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5',
      },
    });
    const html = await resp.text();

    // Try to extract JSON-LD data
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
    );
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        // JSON-LD may have image URLs in the "image" field.
        const rawImages = data.image ?? [];
        const images = Array.isArray(rawImages) ? rawImages : [rawImages];
        const items: MediaItem[] = images
          .filter((u: unknown) => typeof u === 'string' && u.startsWith('http'))
          .map((u: string) => ({ type: 'photo' as const, url: u }));
        if (items.length > 0) return { success: true, items };
      } catch {
        // ignore parse errors
      }
    }

    // Broader fallback: search for image URLs in the page.
    // Xiaohongshu stores images in __INITIAL_STATE__ or similar window data.
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        // Traverse common paths for image URLs.
        const note =
          state.note?.noteDetailMap?.[noteId]?.note ??
          state.noteDetailMap?.[noteId]?.note ??
          state.note?.noteMap?.[noteId];
        const imageList = note?.imageList ?? note?.images ?? [];
        const items: MediaItem[] = imageList
          .map((img: any) => {
            const imgUrl =
              typeof img === 'string' ? img : img?.url ?? img?.infoList?.[0]?.url;
            return imgUrl ? { type: 'photo' as const, url: imgUrl } : null;
          })
          .filter(Boolean);
        if (items.length > 0) return { success: true, items };
      } catch {
        // ignore
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Main entry ─────────────────────────────────────────────────

export async function downloadXiaohongshu(
  url: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  try {
    // 1. Resolve short links
    let fullUrl = url;
    if (/xhslink\.com/i.test(url)) {
      fullUrl = await resolveShortUrl(url);
    }

    // 2. Extract note ID
    const noteId = extractNoteId(fullUrl);
    if (!noteId) {
      return {
        success: false,
        error: '无法从链接中提取小红书笔记ID',
      };
    }

    // 3. Try package backend
    const pkgResult = await downloadViaPackage(noteId, options);
    if (pkgResult) return pkgResult;

    // 4. Fallback: page scraping
    const pageResult = await downloadViaPageFallback(noteId, fullUrl, options);
    if (pageResult) return pageResult;

    // 5. Nothing worked
    return {
      success: false,
      error: '小红书下载暂不可用，请手动保存（小红书的反爬机制较强）',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `小红书下载失败：${msg}`,
    };
  }
}
