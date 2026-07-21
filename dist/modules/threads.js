import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { tempFilePath } from '../utils/tg.js';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
/**
 * Download media from a Threads (threads.net) post.
 */
export async function downloadThreads(url, options) {
    try {
        // 1. Fetch the threads.net post HTML
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
        });
        if (!response.ok) {
            return {
                success: false,
                error: `Failed to fetch Threads post: HTTP ${response.status}`,
            };
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const mediaItems = [];
        // 2. Extract og:image and og:video meta tags
        const ogImage = $('meta[property="og:image"]').attr('content');
        const ogVideo = $('meta[property="og:video"]').attr('content');
        // 3. Parse JSON-LD script tag for carousel items
        const jsonLdScripts = [];
        $('script[type="application/ld+json"]').each((_i, el) => {
            const content = $(el).html();
            if (content)
                jsonLdScripts.push(content);
        });
        // Determine media from JSON-LD first (for carousels)
        const jsonLdImages = new Set();
        const jsonLdVideos = new Set();
        for (const raw of jsonLdScripts) {
            try {
                const parsed = JSON.parse(raw);
                const items = parsed.itemListElement || [];
                for (const item of items) {
                    if (item?.type === 'VideoObject' && item?.contentUrl) {
                        jsonLdVideos.add(item.contentUrl);
                    }
                    if (item?.type === 'ImageObject' && item?.contentUrl) {
                        jsonLdImages.add(item.contentUrl);
                    }
                    // Some structures have image/video directly
                    if (item?.image)
                        jsonLdImages.add(item.image);
                    if (item?.video)
                        jsonLdVideos.add(item.video);
                }
                // Fallback: top-level image/video
                if (parsed.image && typeof parsed.image === 'string') {
                    jsonLdImages.add(parsed.image);
                }
                if (parsed.video && typeof parsed.video === 'string') {
                    jsonLdVideos.add(parsed.video);
                }
            }
            catch {
                // Skip invalid JSON-LD
            }
        }
        // 4. Look for <video> tags with src attribute
        const videoSrcs = [];
        $('video[src]').each((_i, el) => {
            const src = $(el).attr('src');
            if (src)
                videoSrcs.push(src);
        });
        // Build media items from all sources, deduplicating by URL
        // JSON-LD images
        for (const imgUrl of jsonLdImages) {
            if (imgUrl && !mediaItems.some((m) => m.url === imgUrl)) {
                mediaItems.push({ type: 'photo', url: imgUrl });
            }
        }
        // JSON-LD videos
        for (const vidUrl of jsonLdVideos) {
            if (vidUrl && !mediaItems.some((m) => m.url === vidUrl)) {
                mediaItems.push({ type: 'video', url: vidUrl });
            }
        }
        // <video> tags
        for (const src of videoSrcs) {
            if (!mediaItems.some((m) => m.url === src)) {
                mediaItems.push({ type: 'video', url: src });
            }
        }
        // og:image (avoid duplicates)
        if (ogImage && !mediaItems.some((m) => m.url === ogImage)) {
            mediaItems.push({ type: 'photo', url: ogImage });
        }
        // og:video (avoid duplicates)
        if (ogVideo && !mediaItems.some((m) => m.url === ogVideo)) {
            mediaItems.push({ type: 'video', url: ogVideo });
        }
        if (mediaItems.length === 0) {
            return {
                success: false,
                error: 'No downloadable media found in this Threads post',
            };
        }
        // 5. Download each media item to temp dir
        const downloadedItems = [];
        for (const item of mediaItems) {
            try {
                const ext = path.extname(new URL(item.url).pathname) || '.mp4';
                const filePath = tempFilePath(`threads${ext}`);
                const dlResponse = await fetch(item.url, {
                    headers: { 'User-Agent': USER_AGENT },
                });
                if (!dlResponse.ok) {
                    options?.onProgress?.(0, `Failed to download: HTTP ${dlResponse.status}`);
                    continue;
                }
                const buffer = Buffer.from(await dlResponse.arrayBuffer());
                fs.writeFileSync(filePath, buffer);
                downloadedItems.push({ ...item, filePath });
            }
            catch (dlErr) {
                options?.onProgress?.(0, `Download failed for ${item.url}`);
                // Continue with remaining items
            }
        }
        if (downloadedItems.length === 0) {
            return {
                success: false,
                error: 'Failed to download any media items',
            };
        }
        return { success: true, items: downloadedItems };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Threads download error: ${message}` };
    }
}
//# sourceMappingURL=threads.js.map