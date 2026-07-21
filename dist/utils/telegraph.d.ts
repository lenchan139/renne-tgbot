/**
 * Telegraph API client
 *
 * Handles:
 * - Creating anonymous accounts (or using a configured token)
 * - Creating Telegraph pages from HTML content
 * - Automatic image upload to Telegraph's image CDN
 */
interface TelegraphNodeElement {
    tag: string;
    attrs?: Record<string, string>;
    children?: TelegraphNode[];
}
type TelegraphNode = string | TelegraphNodeElement;
/**
 * Convert a subset of sanitized HTML to Telegraph's node tree format.
 *
 * Supports: p, br, b/strong, i/em, a[href], img[src],
 *           h1-h4, blockquote, pre, code, ul, ol, li
 */
export declare function htmlToTelegraphNodes(html: string): TelegraphNode[];
export interface CreatePageOptions {
    title: string;
    content: string;
    authorName?: string;
    authorUrl?: string;
}
/**
 * Create a Telegraph page from HTML content.
 * Returns the public URL of the created page.
 */
export declare function createTelegraphPage(options: CreatePageOptions): Promise<TelegraphResult>;
export interface TelegraphResult {
    success: true;
    title: string;
    url: string;
    author?: string;
}
/**
 * Wrap content in basic Telegraph-compatible HTML.
 */
export declare function wrapTelegraphHtml(title: string, paragraphs: string[], images?: {
    url: string;
    caption?: string;
}[]): string;
export {};
//# sourceMappingURL=telegraph.d.ts.map