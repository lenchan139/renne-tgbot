/**
 * WeChat Official Account (mp.weixin.qq.com) article → Telegraph converter.
 *
 * Fetches a WeChat article page, extracts the title/author/content,
 * converts images (data-src → src) to Telegraph-compatible HTML,
 * and publishes to Telegraph.
 */

import * as cheerio from 'cheerio';
import {
  createTelegraphPage,
  TelegraphResult,
} from '../utils/telegraph.js';

// ─── Types ────────────────────────────────────────────────────

export type WechatResult =
  | { success: true; telegraphUrl: string; title: string; author?: string }
  | { success: false; error: string };

// ─── Constants ────────────────────────────────────────────────

/**
 * Mobile User-Agent to avoid the QR-code scan wall.
 * 微信文章在 PC 上可能要求掃碼，使用移動端 UA 繞過。
 */
const WECHAT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36';

// ─── Main function ────────────────────────────────────────────

export async function processWechatArticle(url: string): Promise<WechatResult> {
  try {
    // 1. Fetch the article with a mobile User-Agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': WECHAT_USER_AGENT,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `请求失败 (HTTP ${response.status})`,
      };
    }

    const html = await response.text();

    // 2. Parse with cheerio
    const $ = cheerio.load(html);

    // 3. Check for login/scan requirement
    // 微信有時會返回登錄/掃碼頁面而非文章
    if (
      $('#js_share_username').length > 0 ||
      $('.qr_code_pc').length > 0 ||
      $('.qr_code').length > 0 ||
      html.includes('請長按二維碼') ||
      html.includes('请长按二维码')
    ) {
      return {
        success: false,
        error: '该文章需要登录或扫码查看，请手动打开链接',
      };
    }

    // 4. Extract article title
    let title =
      $('meta[property="og:title"]').attr('content') || '';
    if (!title) {
      title = $('h1.rich_media_title').text().trim();
    }
    if (!title) {
      return { success: false, error: '无法提取文章标题' };
    }

    // 5. Extract author
    let author =
      $('meta[property="og:article:author"]').attr('content') || '';
    if (!author) {
      author = $('#js_name').text().trim();
    }

    // 6. Extract the main content div
    const $content = $('#js_content');
    if (!$content.length) {
      return { success: false, error: '无法提取文章内容' };
    }
    if (!$content.text().trim()) {
      return { success: false, error: '文章内容为空' };
    }

    // 7. Process the content into Telegraph-compatible HTML
    const contentHtml = processContent($, $content);

    if (!contentHtml.trim()) {
      return { success: false, error: '文章内容为空' };
    }

    // 8. Build the full Telegraph HTML (title + body)
    const telegraphHtml = buildTelegraphHtml(title, contentHtml);

    // 9. Publish to Telegraph
    const result: TelegraphResult = await createTelegraphPage({
      title,
      content: telegraphHtml,
      authorName: author || undefined,
    });

    return {
      success: true,
      telegraphUrl: result.url,
      title: result.title,
      author: result.author,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `处理失败: ${message}` };
  }
}

// ─── Helper: process content DOM into Telegraph HTML ──────────

/**
 * Recursively walk the `#js_content` element and produce
 * Telegraph-compatible HTML.
 *
 * Handles:
 * - p, div, section → paragraph-level blocks
 * - img (data-src → src) 微信使用 data-src 延遲加載
 * - h1-h6, blockquote, ul, ol, li, pre, code
 * - script, iframe, style → removed
 */
function processContent(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): string {
  // Remove unwanted elements
  const $clone = $el.clone();
  $clone.find('script, iframe, style, link').remove();

  const parts: string[] = [];
  const children = $clone.contents().toArray();

  for (const node of children) {
    if (node.type === 'text') {
      const text = (node as cheerio.TextElement).data?.trim();
      if (text) {
        parts.push(`<p>${escapeHtml(text)}</p>`);
      }
    } else if (node.type === 'tag') {
      const $child = $(node);
      const tag = node.tagName.toLowerCase();

      if (tag === 'p' || tag === 'div') {
        const inner = processInlineContent($, $child);
        if (inner.trim()) {
          parts.push(`<p>${inner}</p>`);
        }
      } else if (tag === 'img') {
        // 微信使用 data-src 延遲加載圖片
        const src = $child.attr('data-src') || $child.attr('src') || '';
        if (src) {
          parts.push(`<img src="${escapeHtml(src)}"/>`);
        }
      } else if (tag === 'section') {
        // Recursively process nested sections
        const sectionHtml = processContent($, $child);
        if (sectionHtml.trim()) {
          parts.push(sectionHtml);
        }
      } else if (tag === 'br') {
        parts.push('<br/>');
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = $child.text().trim();
        if (text) {
          parts.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
        }
      } else if (tag === 'blockquote') {
        const text = $child.text().trim();
        if (text) {
          parts.push(`<blockquote>${escapeHtml(text)}</blockquote>`);
        }
      } else if (tag === 'ul' || tag === 'ol') {
        const items: string[] = [];
        $child.children('li').each((_, li) => {
          const liText = $(li).text().trim();
          if (liText) {
            items.push(`<li>${escapeHtml(liText)}</li>`);
          }
        });
        if (items.length) {
          parts.push(`<${tag}>${items.join('')}</${tag}>`);
        }
      } else if (tag === 'pre') {
        const text = $child.text().trim();
        if (text) {
          parts.push(`<pre>${escapeHtml(text)}</pre>`);
        }
      }
      // Other block-level / unknown tags are intentionally skipped
    }
  }

  return parts.join('\n');
}

// ─── Helper: inline content processing ────────────────────────

/**
 * Process inline-level elements within a paragraph.
 * Preserves basic formatting: b, strong, i, em, a, br, img, span.
 */
function processInlineContent(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
): string {
  let html = '';

  for (const node of $el.contents().toArray()) {
    if (node.type === 'text') {
      const data = (node as cheerio.TextElement).data ?? '';
      html += escapeHtml(data);
    } else if (node.type === 'tag') {
      const $child = $(node);
      const tag = node.tagName.toLowerCase();

      if (tag === 'br') {
        html += '<br/>';
      } else if (tag === 'strong' || tag === 'b') {
        html += `<b>${processInlineContent($, $child)}</b>`;
      } else if (tag === 'em' || tag === 'i') {
        html += `<i>${processInlineContent($, $child)}</i>`;
      } else if (tag === 'a') {
        const href = $child.attr('href') || '';
        if (href) {
          html += `<a href="${escapeHtml(href)}">${processInlineContent($, $child)}</a>`;
        } else {
          html += processInlineContent($, $child);
        }
      } else if (tag === 'img') {
        const src = $child.attr('data-src') || $child.attr('src') || '';
        if (src) {
          html += `<img src="${escapeHtml(src)}"/>`;
        }
      } else if (tag === 'span' || tag === 'code') {
        // Flatten span/code – preserve text content without the wrapper
        html += processInlineContent($, $child);
      }
      // Other inline tags (e.g. u, s) are skipped for simplicity
    }
  }

  return html;
}

// ─── Helper: build final Telegraph HTML ───────────────────────

/**
 * Wrap the title and body content into a single HTML string
 * suitable for createTelegraphPage.
 */
function buildTelegraphHtml(title: string, contentHtml: string): string {
  return `<h1>${escapeHtml(title)}</h1>\n${contentHtml}`;
}

// ─── Helper: escape HTML entities ─────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
