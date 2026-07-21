import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import { tempFilePath } from '../utils/tg.js';
/**
 * Compress an image to ~60% quality
 */
export async function compressImage(inputPath) {
    const outputPath = tempFilePath('compressed.jpg');
    await sharp(inputPath)
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toFile(outputPath);
    return outputPath;
}
/**
 * Convert image to PNG (uncompressed)
 */
export async function uncompressedImage(inputPath) {
    const outputPath = tempFilePath('original.png');
    await sharp(inputPath)
        .png()
        .toFile(outputPath);
    return outputPath;
}
/**
 * Convert video to GIF using ffmpeg
 */
export async function videoToGif(inputPath, onProgress) {
    const outputPath = tempFilePath('output.gif');
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .fps(10)
            .size('480x?')
            .videoFilter('scale=480:-1')
            .outputOptions(['-loop', '0'])
            .output(outputPath)
            .on('progress', (p) => {
            if (onProgress && p.percent)
                onProgress(Math.round(p.percent));
        })
            .on('end', () => {
            // Verify output file exists and is non-empty
            try {
                const stat = fs.statSync(outputPath);
                if (stat.size === 0) {
                    reject(new Error('Output file is empty'));
                    return;
                }
            }
            catch { /* file doesn't exist, reject below */ }
            resolve(outputPath);
        })
            .on('error', reject)
            .run();
    });
}
/**
 * Convert GIF to video
 */
export async function gifToVideo(inputPath) {
    const outputPath = tempFilePath('output.mp4');
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions(['-movflags', '+faststart', '-pix_fmt', 'yuv420p'])
            .videoCodec('libx264')
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
    });
}
/**
 * Extract first frame of GIF/video as PNG
 */
export async function gifToImage(inputPath) {
    const outputPath = tempFilePath('frame.png');
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions(['-vframes', '1'])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .run();
    });
}
/**
 * Get media info (duration, dimensions, etc.)
 */
export function getMediaInfo(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err)
                return reject(err);
            const video = metadata.streams.find((s) => s.codec_type === 'video');
            resolve({
                duration: metadata.format.duration || 0,
                width: video?.width || 0,
                height: video?.height || 0,
            });
        });
    });
}
/**
 * Check if a video/image is small enough to send via Telegram bot API
 */
export function canSendViaBot(fileSize) {
    return fileSize <= 50 * 1024 * 1024; // 50 MB
}
//# sourceMappingURL=media.js.map