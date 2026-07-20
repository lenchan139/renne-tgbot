"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressImage = compressImage;
exports.uncompressedImage = uncompressedImage;
exports.videoToGif = videoToGif;
exports.gifToVideo = gifToVideo;
exports.gifToImage = gifToImage;
exports.getMediaInfo = getMediaInfo;
exports.canSendViaBot = canSendViaBot;
const sharp_1 = __importDefault(require("sharp"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const tg_1 = require("../utils/tg");
/**
 * Compress an image to ~50% quality, returning new file path
 */
async function compressImage(inputPath) {
    const outputPath = (0, tg_1.tempFilePath)('compressed.jpg');
    await (0, sharp_1.default)(inputPath)
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toFile(outputPath);
    return outputPath;
}
/**
 * Convert image to PNG (uncompressed)
 */
async function uncompressedImage(inputPath) {
    const outputPath = (0, tg_1.tempFilePath)(`original.png`);
    await (0, sharp_1.default)(inputPath)
        .png()
        .toFile(outputPath);
    return outputPath;
}
/**
 * Convert video to GIF using ffmpeg
 */
async function videoToGif(inputPath, onProgress) {
    const outputPath = (0, tg_1.tempFilePath)('output.gif');
    return new Promise((resolve, reject) => {
        const cmd = (0, fluent_ffmpeg_1.default)(inputPath)
            .outputOptions([
            '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
            '-loop', '0',
        ])
            .output(outputPath)
            .on('progress', (p) => {
            if (onProgress && p.percent)
                onProgress(Math.round(p.percent));
        })
            .on('end', () => resolve(outputPath))
            .on('error', reject);
        cmd.run();
    });
}
/**
 * Convert GIF to video
 */
async function gifToVideo(inputPath) {
    const outputPath = (0, tg_1.tempFilePath)('output.mp4');
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
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
async function gifToImage(inputPath) {
    const outputPath = (0, tg_1.tempFilePath)('frame.png');
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(inputPath)
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
function getMediaInfo(inputPath) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(inputPath, (err, metadata) => {
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
function canSendViaBot(fileSize) {
    return fileSize <= 50 * 1024 * 1024; // 50 MB
}
//# sourceMappingURL=media.js.map