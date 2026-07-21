/**
 * TikTok (vt.tiktok.com / tiktok.com) video downloader.
 *
 * Uses multiple third-party download services (snaptik.app, ssstik.io)
 * and falls back to the `tiktok-dl` npm package, to maximise the
 * chance of successfully retrieving a video.
 */
// ─── Helpers ────────────────────────────────────────────────────
/**
 * Minimal HTML-entities decoder (enough for the scraped pages).
 */
function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}
/**
 * Extract the first video download link from snaptik.app's result page.
 */
function extractSnaptikLink(html) {
    // Look for download buttons / links in the result page.
    // snaptik.app renders links inside <a> tags with download attributes.
    const patterns = [
        /<a[^>]+href\s*=\s*"([^"]+)"[^>]*>\s*<[^>]*>[^<]*download[^<]*</i,
        /<a[^>]+href\s*=\s*"([^"]+)"[^>]*>\s*Download\s*</i,
        /<a[^>]+href\s*=\s*"([^"]*vid[^"]*)"[^>]*>/i,
        /<a[^>]+href\s*=\s*"([^"]*\.mp4[^"]*)"[^>]*>/i,
    ];
    for (const pat of patterns) {
        const m = html.match(pat);
        if (m) {
            let link = decodeHtmlEntities(m[1]);
            if (link.startsWith('//'))
                link = 'https:' + link;
            if (link.startsWith('/'))
                link = 'https://snaptik.app' + link;
            return link;
        }
    }
    return null;
}
/**
 * Extract the first video download link from ssstik.io's result page.
 */
function extractSsstikLink(html) {
    // ssstik.io often stores the download link in a data attribute or inside a <a>.
    const patterns = [
        /<a[^>]+href\s*=\s*"([^"]+)"[^>]*>\s*<[^>]*>[^<]*video[^<]*</i,
        /<a[^>]+href\s*=\s*"([^"]+)"[^>]*>\s*Download\s*</i,
        /<a[^>]+href\s*=\s*"([^"]*\.mp4[^"]*)"[^>]*>/i,
        /<a[^>]+href\s*=\s*"([^"]*vid[^"]*)"[^>]*>/i,
        /<a[^>]+href\s*=\s*"([^"]*dl[^"]*)"[^>]*>/i,
        /<a[^>]+href\s*=\s*"([^"]+)"[^>]+class\s*=\s*"[^"]*download[^"]*"/i,
    ];
    for (const pat of patterns) {
        const m = html.match(pat);
        if (m) {
            let link = decodeHtmlEntities(m[1]);
            if (link.startsWith('//'))
                link = 'https:' + link;
            if (link.startsWith('/'))
                link = 'https://ssstik.io' + link;
            return link;
        }
    }
    return null;
}
// ─── Backend 1: snaptik.app ─────────────────────────────────────
async function trySnaptik(tiktokUrl, _options) {
    try {
        const encodedUrl = encodeURIComponent(tiktokUrl);
        const postUrl = `https://snaptik.app/abc?url=${encodedUrl}`;
        const resp = await fetch(postUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: 'https://snaptik.app/',
                Origin: 'https://snaptik.app',
            },
            body: new URLSearchParams({ url: tiktokUrl }).toString(),
        });
        const html = await resp.text();
        const link = extractSnaptikLink(html);
        return link;
    }
    catch {
        return null;
    }
}
// ─── Backend 2: ssstik.io ───────────────────────────────────────
async function trySsstik(tiktokUrl, _options) {
    try {
        const encodedUrl = encodeURIComponent(tiktokUrl);
        const resp = await fetch('https://ssstik.io/abc?url=' + encodedUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: 'https://ssstik.io/',
                Origin: 'https://ssstik.io',
            },
            body: new URLSearchParams({ url: tiktokUrl, lang: 'en' }).toString(),
        });
        const html = await resp.text();
        const link = extractSsstikLink(html);
        return link;
    }
    catch {
        return null;
    }
}
// ─── Backend 3: tiktok-dl npm package ──────────────────────────
async function tryPackage(tiktokUrl, _options) {
    try {
        const tiktokDl = await import('tiktok-dl');
        // The package API varies; attempt common patterns.
        const result = (await tiktokDl.default?.(tiktokUrl)) ?? (await tiktokDl.default?.download?.(tiktokUrl));
        // Result may be a URL string or an object with a videoUrl / url / downloadUrl field.
        if (typeof result === 'string' && result.startsWith('http'))
            return result;
        const url = result?.videoUrl ?? result?.url ?? result?.downloadUrl ?? result?.video?.url;
        if (typeof url === 'string' && url.startsWith('http'))
            return url;
        return null;
    }
    catch {
        return null;
    }
}
// ─── Main entry ─────────────────────────────────────────────────
export async function downloadTiktok(url, options) {
    try {
        let downloadUrl = null;
        // Try backends in sequence
        downloadUrl = await trySnaptik(url, options);
        if (!downloadUrl)
            downloadUrl = await trySsstik(url, options);
        if (!downloadUrl)
            downloadUrl = await tryPackage(url, options);
        if (!downloadUrl) {
            return {
                success: false,
                error: 'TikTok 下载暂时不可用（反爬机制较强），请稍后再试',
            };
        }
        const items = [
            {
                type: 'video',
                url: downloadUrl,
            },
        ];
        return { success: true, items };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            error: `TikTok 下载失败：${msg}`,
        };
    }
}
//# sourceMappingURL=tiktok.js.map