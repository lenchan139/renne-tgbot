import { Context } from 'grammy';
/**
 * Handle x.com / twitter.com URL messages
 * - In PM: reply with fixupx.com URL
 * - In group with admin: edit the original message
 */
export declare function handleXUrl(ctx: Context): Promise<void>;
/**
 * Handle platform URL messages (Threads, 小红书, 抖音, TikTok, 微博, Bilibili)
 * For 微信公众号, create a Telegraph page instead.
 */
export declare function handlePlatformUrl(ctx: Context): Promise<void>;
//# sourceMappingURL=url.d.ts.map