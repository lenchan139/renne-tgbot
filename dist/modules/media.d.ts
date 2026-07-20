/**
 * Compress an image to ~50% quality, returning new file path
 */
export declare function compressImage(inputPath: string): Promise<string>;
/**
 * Convert image to PNG (uncompressed)
 */
export declare function uncompressedImage(inputPath: string): Promise<string>;
/**
 * Convert video to GIF using ffmpeg
 */
export declare function videoToGif(inputPath: string, onProgress?: (pct: number) => void): Promise<string>;
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