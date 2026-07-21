import * as fs from 'fs';
import { DownloadResult, MediaItem, DownloadOptions } from './downloader.js';
import { tempFilePath } from '../utils/tg.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Download a video from Douyin (v.douyin.com / douyin.com).
 */
export async function downloadDouyin(
  url: string,
  options?: DownloadOptions
): Promise<DownloadResult> {
  try {
    // 1. Parse v.douyin.com URL to extract video ID
    let videoId: string | null = null;

    // Match v.douyin.com/{id}
    const shareMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9_-]+)/);
    if (shareMatch) {
      videoId = shareMatch[1];
    }

    // Match douyin.com/video/{id}
    const videoMatch = url.match(/douyin\.com\/video\/(\d+)/);
    if (videoMatch) {
      videoId = videoMatch[1];
    }

    if (!videoId) {
      return {
        success: false,
        error: 'Could not extract video ID from Douyin URL',
      };
    }

    // 2. If it's a v.douyin.com short URL, follow the redirect
    let finalUrl = url;
    if (shareMatch) {
      try {
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'manual',
        });

        const location = redirectResponse.headers.get('location');
        if (location) {
          finalUrl = location.startsWith('http') ? location : `https:${location}`;
        } else {
          // Try normal fetch with redirect to get the final URL
          const fullResponse = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
          });
          finalUrl = fullResponse.url;
        }
      } catch {
        // If redirect fails, try a normal fetch to get the final URL
        const fallbackResponse = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT },
        });
        finalUrl = fallbackResponse.url;
      }

      // Re-extract video ID from the redirected URL
      const redirectedMatch = finalUrl.match(/douyin\.com\/video\/(\d+)/);
      if (redirectedMatch) {
        videoId = redirectedMatch[1];
      }
    }

    // 3. Fetch the www.douyin.com page with proper headers
    const pageResponse = await fetch(`https://www.douyin.com/video/${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.douyin.com/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!pageResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch Douyin page: HTTP ${pageResponse.status}`,
      };
    }

    const html = await pageResponse.text();

    // 4. Extract JSON data from window.__INITIAL_STATE__
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});\s*<\/script>/s);
    if (!stateMatch) {
      // Try alternative matching — sometimes the JSON is spread across lines
      const altMatch = html.match(/__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
      if (!altMatch) {
        return {
          success: false,
          error: 'Could not find video data on Douyin page',
        };
      }
    }

    const stateJson = stateMatch ? stateMatch[1] : altMatch![1];
    let state: any;
    try {
      state = JSON.parse(stateJson);
    } catch {
      return {
        success: false,
        error: 'Failed to parse Douyin page state data',
      };
    }

    // 5. Get video URL from state
    const itemList = state?.videoInfoRes?.item_list;
    if (!itemList || !Array.isArray(itemList) || itemList.length === 0) {
      return {
        success: false,
        error: 'No video data found in Douyin response',
      };
    }

    const videoInfo = itemList[0];
    const playAddr = videoInfo?.video?.play_addr;
    const urlList = playAddr?.url_list;

    if (!urlList || !Array.isArray(urlList) || urlList.length === 0) {
      return {
        success: false,
        error: 'No video URL found in Douyin data',
      };
    }

    // The first URL may be a protocol-relative URL — ensure it has https:
    let videoUrl = urlList[0];
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    }

    // Get cover image
    let coverUrl: string | undefined = videoInfo?.video?.cover?.url_list?.[0] || videoInfo?.video?.dynamic_cover?.url_list?.[0];
    if (coverUrl && coverUrl.startsWith('//')) {
      coverUrl = `https:${coverUrl}`;
    }

    // 6. Download the video
    const filePath = tempFilePath(`douyin-${videoId}.mp4`);

    const dlResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.douyin.com/',
      },
    });

    if (!dlResponse.ok) {
      return {
        success: false,
        error: `Failed to download video: HTTP ${dlResponse.status}`,
      };
    }

    const buffer = Buffer.from(await dlResponse.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const mediaItem: MediaItem = {
      type: 'video',
      url: videoUrl,
      filePath,
      thumbnail: coverUrl,
    };

    return { success: true, items: [mediaItem] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Douyin download error: ${message}` };
  }
}
