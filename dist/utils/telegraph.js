/**
 * Telegraph API client
 *
 * Handles:
 * - Creating anonymous accounts (or using a configured token)
 * - Creating Telegraph pages from HTML content
 * - Automatic image upload to Telegraph's image CDN
 */
import fs from 'fs';
import path from 'path';
import { TMP_DIR } from './constants.js';
// ─── Token management ─────────────────────────────────────────
const TOKEN_FILE = path.join(TMP_DIR, '.telegraph_token');
const API_BASE = 'https://api.telegra.ph';
let cachedToken = null;
function getStoredToken() {
    if (cachedToken)
        return cachedToken;
    const envToken = process.env.TELEGRAPH_TOKEN;
    if (envToken) {
        cachedToken = envToken;
        return cachedToken;
    }
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            cachedToken = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
            return cachedToken;
        }
    }
    catch {
        // ignore
    }
    return null;
}
function storeToken(token) {
    cachedToken = token;
    try {
        if (!fs.existsSync(TMP_DIR)) {
            fs.mkdirSync(TMP_DIR, { recursive: true });
        }
        fs.writeFileSync(TOKEN_FILE, token, 'utf-8');
    }
    catch {
        // non-fatal; next run will create a new account
    }
}
/**
 * Get or create a Telegraph access token.
 */
async function ensureToken() {
    const existing = getStoredToken();
    if (existing)
        return existing;
    const res = await fetch(`${API_BASE}/createAccount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            short_name: 'Renne Bot',
            author_name: 'Renne Bot',
            author_url: 'https://t.me/renne_tgbot',
        }),
    });
    const data = await res.json();
    if (!data.ok || !data.result) {
        throw new Error(`Telegraph createAccount failed: ${data.error}`);
    }
    storeToken(data.result.access_token);
    return data.result.access_token;
}
// ─── HTML → Telegraph Node conversion ─────────────────────────
/**
 * Convert a subset of sanitized HTML to Telegraph's node tree format.
 *
 * Supports: p, br, b/strong, i/em, a[href], img[src],
 *           h1-h4, blockquote, pre, code, ul, ol, li
 */
export function htmlToTelegraphNodes(html) {
    // Normalize line breaks
    let h = html
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
    const nodes = [];
    const tagStack = [];
    let i = 0;
    while (i < h.length) {
        if (h[i] === '<') {
            const closeTag = h.indexOf('>', i);
            if (closeTag === -1)
                break;
            const rawTag = h.slice(i + 1, closeTag);
            const isClosing = rawTag.startsWith('/');
            if (isClosing) {
                const tagName = rawTag.slice(1).split(/\s/)[0].toLowerCase();
                // Pop the matching tag from stack
                if (tagStack.length > 0 && tagStack[tagStack.length - 1].tag === tagName) {
                    const el = tagStack.pop();
                    if (tagStack.length > 0) {
                        tagStack[tagStack.length - 1].children.push({
                            tag: el.tag,
                            attrs: el.attrs,
                            children: el.children,
                        });
                    }
                    else {
                        nodes.push({ tag: el.tag, attrs: el.attrs, children: el.children });
                    }
                }
            }
            else {
                const spaceIdx = rawTag.indexOf(' ');
                const tagName = (spaceIdx === -1 ? rawTag : rawTag.slice(0, spaceIdx)).toLowerCase();
                const selfClosing = rawTag.endsWith('/') || tagName === 'br' || tagName === 'img';
                if (selfClosing) {
                    // Extract attrs for img
                    const attrs = {};
                    if (tagName === 'img') {
                        const srcMatch = rawTag.match(/src\s*=\s*"([^"]+)"/);
                        if (srcMatch)
                            attrs.src = srcMatch[1];
                    }
                    // Add to parent
                    const node = { tag: tagName, attrs: Object.keys(attrs).length > 0 ? attrs : undefined };
                    if (tagStack.length > 0) {
                        tagStack[tagStack.length - 1].children.push(node);
                    }
                    else {
                        nodes.push(node);
                    }
                }
                else {
                    // Extract attrs
                    const attrs = {};
                    const attrRegex = /(\w+)\s*=\s*"([^"]*)"/g;
                    let match;
                    while ((match = attrRegex.exec(rawTag)) !== null) {
                        attrs[match[1]] = match[2];
                    }
                    tagStack.push({
                        tag: tagName,
                        attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
                        children: [],
                    });
                }
            }
            i = closeTag + 1;
        }
        else {
            // Text content
            const nextTag = h.indexOf('<', i);
            const text = nextTag === -1 ? h.slice(i) : h.slice(i, nextTag);
            i = nextTag === -1 ? h.length : nextTag;
            if (text.trim()) {
                const node = text;
                if (tagStack.length > 0) {
                    tagStack[tagStack.length - 1].children.push(node);
                }
                else if (text.trim()) {
                    nodes.push(text);
                }
            }
        }
    }
    // Close any remaining open tags
    while (tagStack.length > 0) {
        const el = tagStack.pop();
        if (tagStack.length > 0) {
            tagStack[tagStack.length - 1].children.push({
                tag: el.tag,
                attrs: el.attrs,
                children: el.children,
            });
        }
        else {
            nodes.push({ tag: el.tag, attrs: el.attrs, children: el.children });
        }
    }
    return nodes;
}
/**
 * Create a Telegraph page from HTML content.
 * Returns the public URL of the created page.
 */
export async function createTelegraphPage(options) {
    const token = await ensureToken();
    const contentNodes = htmlToTelegraphNodes(options.content);
    const res = await fetch(`${API_BASE}/createPage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            access_token: token,
            title: options.title.slice(0, 256),
            author_name: options.authorName || 'Renne Bot',
            author_url: options.authorUrl || 'https://t.me/renne_tgbot',
            content: contentNodes,
            return_content: false,
        }),
    });
    const data = await res.json();
    if (!data.ok || !data.result) {
        throw new Error(`Telegraph createPage failed: ${data.error}`);
    }
    return {
        success: true,
        title: data.result.title,
        url: data.result.url,
        author: options.authorName,
    };
}
// ─── Convenience: create from styled text ─────────────────────
/**
 * Wrap content in basic Telegraph-compatible HTML.
 */
export function wrapTelegraphHtml(title, paragraphs, images) {
    const parts = [];
    parts.push(`<h1>${escapeHtml(title)}</h1>`);
    if (images) {
        for (const img of images) {
            parts.push(`<img src="${escapeHtml(img.url)}"/>`);
            if (img.caption) {
                parts.push(`<p>${escapeHtml(img.caption)}</p>`);
            }
        }
    }
    for (const p of paragraphs) {
        parts.push(`<p>${p}</p>`);
    }
    return parts.join('\n');
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
//# sourceMappingURL=telegraph.js.map