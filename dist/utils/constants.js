"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TORRENT_EXTENSIONS = exports.VIDEO_EXTENSIONS = exports.IMAGE_EXTENSIONS = exports.X_FIXUP_DOMAIN = exports.X_DOMAINS = exports.TMP_DIR = exports.TG_BOT_MAX_FILE_DOWNLOAD = exports.TG_BOT_MAX_FILE_SIZE = exports.TG_MAX_FILE_SIZE = void 0;
exports.isMediaFile = isMediaFile;
exports.isImageFile = isImageFile;
exports.isVideoFile = isVideoFile;
exports.isTorrentFile = isTorrentFile;
exports.getExtension = getExtension;
/** Telegram's single file upload limit */
exports.TG_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
/** Telegram bot API max file size for bots */
exports.TG_BOT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (bot → server)
exports.TG_BOT_MAX_FILE_DOWNLOAD = 20 * 1024 * 1024; // 20 MB (server → bot)
/** Temporary download directory */
exports.TMP_DIR = '/tmp/renne-bot';
/** x.com domain replacement */
exports.X_DOMAINS = ['x.com', 'twitter.com'];
exports.X_FIXUP_DOMAIN = 'fixupx.com';
/** Supported file extensions */
exports.IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
exports.VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
exports.TORRENT_EXTENSIONS = ['.torrent'];
/** Media identification */
function isMediaFile(filename) {
    const ext = getExtension(filename);
    return exports.IMAGE_EXTENSIONS.includes(ext) || exports.VIDEO_EXTENSIONS.includes(ext);
}
function isImageFile(filename) {
    return exports.IMAGE_EXTENSIONS.includes(getExtension(filename));
}
function isVideoFile(filename) {
    return exports.VIDEO_EXTENSIONS.includes(getExtension(filename));
}
function isTorrentFile(filename) {
    return exports.TORRENT_EXTENSIONS.includes(getExtension(filename));
}
function getExtension(filename) {
    const idx = filename.lastIndexOf('.');
    return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}
//# sourceMappingURL=constants.js.map