/**
 * Compress an image to ~60% quality
 */
export declare function compressImage(inputPath: string): Promise<string>;
/**
 * Convert image to PNG (uncompressed)
 */
export declare function uncompressedImage(inputPath: string): Promise<string>;
/**
 * Convert video to MP4 animation (Telegram native GIF).
 *
 * Telegram's sendAnimation accepts MP4 — it plays as a looping
 * video without controls, same UX as a GIF but far better quality
 * and smaller file size.
 */
export declare function videoToAnimation(inputPath: string, onProgress?: (pct: number) => void): Promise<string>;
/**
 * Convert a still image to a short looping MP4 animation.
 * Uses ffmpeg's image looping to create a seamless Telegram-ready animation.
 */
export declare function imageToAnimation(inputPath: string): Promise<string>;
/**
 * Convert GIF to video
 */
export declare function gifToVideo(inputPath: string): Promise<string>;
/**
 * Extract first frame of GIF/video as PNG
 */
export declare function gifToImage(inputPath: string): Promise<string>;
/**
 * Get media info (duration, dimensions, etc.)
 */
export declare function getMediaInfo(inputPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
}>;
/**
 * Check if a video/image is small enough to send via Telegram bot API
 */
export declare function canSendViaBot(fileSize: number): boolean;
//# sourceMappingURL=media.d.ts.map