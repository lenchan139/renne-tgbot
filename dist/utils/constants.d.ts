/** Telegram's single file upload limit */
export declare const TG_MAX_FILE_SIZE: number;
/** Telegram bot API max file size for bots */
export declare const TG_BOT_MAX_FILE_SIZE: number;
export declare const TG_BOT_MAX_FILE_DOWNLOAD: number;
/** Temporary download directory */
export declare const TMP_DIR = "/tmp/renne-bot";
/** x.com domain replacement */
export declare const X_DOMAINS: string[];
export declare const X_FIXUP_DOMAIN = "fixupx.com";
/** Supported file extensions */
export declare const IMAGE_EXTENSIONS: string[];
export declare const VIDEO_EXTENSIONS: string[];
export declare const TORRENT_EXTENSIONS: string[];
/** Media identification */
export declare function isMediaFile(filename: string): boolean;
export declare function isImageFile(filename: string): boolean;
export declare function isVideoFile(filename: string): boolean;
export declare function isTorrentFile(filename: string): boolean;
export declare function getExtension(filename: string): string;
//# sourceMappingURL=constants.d.ts.map