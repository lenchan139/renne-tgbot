/**
 * WeChat Official Account (mp.weixin.qq.com) article → Telegraph converter.
 *
 * Fetches a WeChat article page, extracts the title/author/content,
 * converts images (data-src → src) to Telegraph-compatible HTML,
 * and publishes to Telegraph.
 */
export type WechatResult = {
    success: true;
    telegraphUrl: string;
    title: string;
    author?: string;
} | {
    success: false;
    error: string;
};
export declare function processWechatArticle(url: string): Promise<WechatResult>;
//# sourceMappingURL=wechat.d.ts.map