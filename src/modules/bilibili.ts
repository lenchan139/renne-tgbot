/**
 * Bilibili video downloader module.
 *
 * Uses Bilibili's public web API endpoints to retrieve video info and
 * download URLs, then downloads the video to a temporary directory.
 *
 * Handles both bilibili.com and b23.tv short links.
 */

import * as fs from 'fs';
import crypto from 'crypto';
import { DownloadResult, MediaItem, DownloadOptions } from './downloader.js';
import { tempFilePath } from '../utils/tg.js';

const BILIBILI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function makeBuvid3(): string {
  const hex = crypto.randomBytes(16).toString('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `${uuid}infoc`;
}

const BASE_COOKIE = `buvid3=${makeBuvid3()}; b_nut=${Math.floor(Date.now() / 1000)}; _uuid=${makeBuvid3()}`;

// ─── Helpers ─────────────────────────────────────────────────────

/** Extract BV id from a bilibili.com URL */
function extractBvid(url: string): string | null {
  const match = url.match(/\/video\/(BV[a-zA-Z0-9]{10,})/i);
  return match ? match[1] : null;
}

/**
 * Resolve a b23.tv short link by following the HTTP redirect.
 * Returns the final full URL (or the original URL if not a b23.tv link).
 */
async function resolveShortLink(url: string): Promise<string> {
  if (!url.includes('b23.tv')) return url;

  const response = await fetch(url, { method: 'GET', redirect: 'manual' });

  // b23.tv returns a 302 / 301 redirect
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) return location;
  }

  // If no redirect header, try reading response body for a meta-redirect
  // or just return the URL as-is — it might still be usable
  return url;
}

/**
 * Download a file from a remote URL to a local temp path.
 * Returns the local file path.
 */
async function downloadFile(
  remoteUrl: string,
  ext: string,
): Promise<string> {
  const tmpPath = tempFilePath(`bilibili${ext}`);
  const response = await fetch(remoteUrl, {
    headers: {
      'User-Agent': BILIBILI_UA,
      Referer: 'https://www.bilibili.com/',
      Cookie: BASE_COOKIE,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

// ─── Main export ─────────────────────────────────────────────────

export async function downloadBilibili(
  url: string,
  _options?: DownloadOptions,
): Promise<DownloadResult> {
  try {
    // 1. Resolve b23.tv short links
    const resolvedUrl = await resolveShortLink(url);

    // 2. Extract BV id
    const bvid = extractBvid(resolvedUrl);
    if (!bvid) {
      return {
        success: false,
        error: `Could not extract video ID from URL: ${url}`,
      };
    }

    // 3. Fetch video info from Bilibili API
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoResponse = await fetch(infoUrl, {
      headers: {
        'User-Agent': BILIBILI_UA,
        Referer: 'https://www.bilibili.com/',
        Cookie: BASE_COOKIE,
      },
    });

    if (!infoResponse.ok) {
      return {
        success: false,
        error: `Bilibili API returned status ${infoResponse.status}`,
      };
    }

    const infoData = await infoResponse.json() as any;

    if (infoData.code !== 0) {
      return {
        success: false,
        error: `Bilibili API error: ${infoData.message || infoData.code}`,
      };
    }

    const videoData = infoData.data;
    const cid = videoData.cid;
    const title = videoData.title || `bilibili_${bvid}`;
    const duration = videoData.duration; // seconds

    // 4. Get video download URL
    const playUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&platform=web&otype=json&high_quality=1`;
    const playResponse = await fetch(playUrl, {
      headers: {
        'User-Agent': BILIBILI_UA,
        Referer: 'https://www.bilibili.com/',
        Cookie: BASE_COOKIE,
      },
    });

    if (!playResponse.ok) {
      return {
        success: false,
        error: `Bilibili playurl API returned status ${playResponse.status}`,
      };
    }

    const playData = await playResponse.json() as any;

    if (playData.code !== 0) {
      return {
        success: false,
        error: `Bilibili playurl error: ${playData.message || playData.code}`,
      };
    }

    // Extract the first video segment URL
    const durl = playData.data?.durl;
    if (!durl || durl.length === 0) {
      return {
        success: false,
        error: 'No video download URL returned from Bilibili',
      };
    }

    const downloadUrl = durl[0].url;
    if (!downloadUrl) {
      return {
        success: false,
        error: 'Download URL is empty in Bilibili response',
      };
    }

    // 5. Download the video
    const ext = '.mp4'; // Bilibili uses MP4 or FLV, MP4 is standard now
    const localPath = await downloadFile(downloadUrl, ext);

    // 6. Return success
    const item: MediaItem = {
      type: 'video',
      url: downloadUrl,
      filePath: localPath,
      duration,
      thumbnail: videoData.pic || undefined,
    };

    if (videoData.dimension) {
      item.width = videoData.dimension.width;
      item.height = videoData.dimension.height;
    }

    return { success: true, items: [item] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Bilibili download failed: ${message}` };
  }
}
