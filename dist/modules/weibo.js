/**
 * Weibo media downloader module.
 *
 * Uses direct scraping of weibo.com and the m.weibo.cn public JSON API
 * to extract images and videos from weibo posts.
 */
import * as fs from 'fs';
import { tempFilePath } from '../utils/tg.js';
// ─── Helpers ─────────────────────────────────────────────────────
/** Extract the numeric status/post ID from a weibo URL */
function extractStatusId(url) {
    // https://m.weibo.cn/detail/{status_id}
    const mDetail = url.match(/m\.weibo\.cn\/detail\/(\d+)/);
    if (mDetail)
        return mDetail[1];
    // https://weibo.com/{userid}/{status_id}
    const weiboCom = url.match(/weibo\.com\/\d+\/(\d+)/);
    if (weiboCom)
        return weiboCom[1];
    // https://m.weibo.cn/status/{status_id}
    const mStatus = url.match(/m\.weibo\.cn\/status\/(\d+)/);
    if (mStatus)
        return mStatus[1];
    return null;
}
/** Construct a large image URL from a pic_id (pid) */
function picUrlFromPid(pid) {
    return `https://wx3.sinaimg.cn/large/${pid}`;
}
/** Download a file from a remote URL to a local temp path */
async function downloadFile(remoteUrl, ext) {
    const tmpPath = tempFilePath(`weibo${ext}`);
    const response = await fetch(remoteUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://weibo.com/',
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
export async function downloadWeibo(url, _options) {
    try {
        // 1. Parse status ID
        const statusId = extractStatusId(url);
        if (!statusId) {
            return {
                success: false,
                error: `Could not extract status ID from URL: ${url}`,
            };
        }
        // 2. Fetch post data from m.weibo.cn API
        const apiUrl = `https://m.weibo.cn/api/statuses/show?id=${statusId}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: 'https://m.weibo.cn/',
                Accept: 'application/json, text/plain, */*',
            },
        });
        if (!response.ok) {
            return {
                success: false,
                error: `Weibo API returned status ${response.status}`,
            };
        }
        const data = await response.json();
        if (!data || data.ok !== 1) {
            return {
                success: false,
                error: `Weibo API error: ${data?.msg || 'unknown error'}`,
            };
        }
        const post = data.data;
        const items = [];
        // 3. Extract images from data.pics
        const pics = post.pics;
        if (pics && Array.isArray(pics)) {
            for (const pic of pics) {
                // Try large.url first, then construct from pid, then pic.url
                let imgUrl;
                if (pic.large?.url) {
                    imgUrl = pic.large.url;
                }
                else if (pic.pid) {
                    imgUrl = picUrlFromPid(pic.pid);
                }
                else if (pic.url) {
                    imgUrl = pic.url;
                }
                if (imgUrl) {
                    try {
                        const localPath = await downloadFile(imgUrl, '.jpg');
                        items.push({
                            type: 'photo',
                            url: imgUrl,
                            filePath: localPath,
                        });
                    }
                    catch {
                        // Skip individual image download failures
                    }
                }
            }
        }
        // If no pics array but the post has a single image via page_info or other means
        if ((!pics || pics.length === 0) && post.url) {
            // Some posts have a url property pointing to a single image
            try {
                const localPath = await downloadFile(post.url, '.jpg');
                items.push({
                    type: 'photo',
                    url: post.url,
                    filePath: localPath,
                });
            }
            catch {
                // Skip
            }
        }
        // 4. Extract video from page_info.media_info
        const pageInfo = post.page_info;
        if (pageInfo?.media_info) {
            const mediaInfo = pageInfo.media_info;
            // Prefer mp4_hd_url, fall back to mp4_url
            const videoUrl = mediaInfo.mp4_hd_url || mediaInfo.mp4_url;
            if (videoUrl) {
                try {
                    const localPath = await downloadFile(videoUrl, '.mp4');
                    items.push({
                        type: 'video',
                        url: videoUrl,
                        filePath: localPath,
                        duration: mediaInfo.duration || undefined,
                        thumbnail: post.thumbnail || pageInfo.page_pic?.url || undefined,
                    });
                }
                catch {
                    // Skip video download failure
                }
            }
        }
        // 5. If nothing was downloaded, return error
        if (items.length === 0) {
            return {
                success: false,
                error: 'No downloadable media found in the weibo post',
            };
        }
        return { success: true, items };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Weibo download failed: ${message}` };
    }
}
//# sourceMappingURL=weibo.js.map