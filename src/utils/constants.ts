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

/** Supported file extensions */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'];
export const TORRENT_EXTENSIONS = ['.torrent'];

/** Media identification */
export function isMediaFile(filename: string): boolean {
  const ext = getExtension(filename);
  return IMAGE_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext);
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getExtension(filename));
}

export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.includes(getExtension(filename));
}

export function isTorrentFile(filename: string): boolean {
  return TORRENT_EXTENSIONS.includes(getExtension(filename));
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}
