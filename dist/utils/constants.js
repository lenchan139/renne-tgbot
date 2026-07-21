/** Telegram's single file upload limit */
export const TG_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
/** Telegram bot API max file size for bots */
export const TG_BOT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (bot → server)
export const TG_BOT_MAX_FILE_DOWNLOAD = 20 * 1024 * 1024; // 20 MB (server → bot)
/** Temporary download directory */
export const TMP_DIR = '/tmp/renne-bot';
/** x.com domain replacement */
export const X_DOMAINS = ['x.com', 'twitter.com'];
export const X_FIXUP_DOMAIN = 'fixupx.com';
/**
 * Platform download domains — used in url.ts routing.
 * Each entry maps the display name to the URL pattern prefix.
 */
export const PLATFORM_CONFIGS = {
    threads: { domains: ['threads.net'], name: 'Threads' },
    xiaohongshu: { domains: ['xhslink.com', 'xiaohongshu.com'], name: '小红书' },
    douyin: { domains: ['v.douyin.com', 'douyin.com'], name: '抖音' },
    tiktok: { domains: ['vt.tiktok.com', 'tiktok.com', 'vm.tiktok.com'], name: 'TikTok' },
    weibo: { domains: ['weibo.com', 'm.weibo.cn', 'weibo.cn'], name: '微博' },
    bilibili: { domains: ['bilibili.com', 'b23.tv'], name: 'Bilibili' },
    wechat: { domains: ['mp.weixin.qq.com'], name: '微信公众号' },
};
/** Supported file extensions */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
export const TORRENT_EXTENSIONS = ['.torrent'];
/** Media identification */
export function isMediaFile(filename) {
    const ext = getExtension(filename);
    return IMAGE_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext);
}
export function isImageFile(filename) {
    return IMAGE_EXTENSIONS.includes(getExtension(filename));
}
export function isVideoFile(filename) {
    return VIDEO_EXTENSIONS.includes(getExtension(filename));
}
export function isTorrentFile(filename) {
    return TORRENT_EXTENSIONS.includes(getExtension(filename));
}
export function getExtension(filename) {
    const idx = filename.lastIndexOf('.');
    return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}
//# sourceMappingURL=constants.js.map