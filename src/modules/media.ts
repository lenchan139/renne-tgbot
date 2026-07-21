import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { tempFilePath } from '../utils/tg.js';

/**
 * Compress an image to ~60% quality
 */
export async function compressImage(inputPath: string): Promise<string> {
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
export async function uncompressedImage(inputPath: string): Promise<string> {
  const outputPath = tempFilePath('original.png');

  await sharp(inputPath)
    .png()
    .toFile(outputPath);

  return outputPath;
}

/**
 * Convert video to MP4 animation (Telegram native GIF).
 *
 * Telegram's sendAnimation accepts MP4 — it plays as a looping
 * video without controls, same UX as a GIF but far better quality
 * and smaller file size.
 */
export async function videoToAnimation(
  inputPath: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const outputPath = tempFilePath('output.mp4');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .fps(15)
      .size('480x?')
      .videoFilter('scale=480:-1')
      .duration(10)                        // max 10 seconds for GIF-like clips
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .videoCodec('libx264')
      .output(outputPath)
      .on('progress', (p: { percent?: number }) => {
        if (onProgress && p.percent) onProgress(Math.round(p.percent));
      })
      .on('end', () => {
        try {
          const stat = fs.statSync(outputPath);
          if (stat.size === 0) {
            reject(new Error('Output file is empty'));
            return;
          }
        } catch { /* file doesn't exist, reject below */ }
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Convert a still image to a short looping MP4 animation.
 * Uses ffmpeg's image looping to create a seamless Telegram-ready animation.
 */
export async function imageToAnimation(
  inputPath: string
): Promise<string> {
  const outputPath = tempFilePath('anim.mp4');

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .loop(2)                             // loop the image for 2 seconds
      .fps(10)
      .size('480x?')
      .videoFilter('scale=480:-1')
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .videoCodec('libx264')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Convert GIF to video
 */
export async function gifToVideo(inputPath: string): Promise<string> {
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
export async function gifToImage(inputPath: string): Promise<string> {
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
export function getMediaInfo(
  inputPath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
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
export function canSendViaBot(fileSize: number): boolean {
  return fileSize <= 50 * 1024 * 1024; // 50 MB
}
