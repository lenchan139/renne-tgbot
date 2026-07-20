import archiver from 'archiver';
import * as fs from 'fs';
import { ProgressTracker } from '../utils/progress.js';

export interface ZipResult {
  zipPath: string;
  zipSize: number;
}

/**
 * Create a zip archive from a directory
 */
export function zipDirectory(
  dirPath: string,
  outputPath: string,
  progress?: ProgressTracker
): Promise<ZipResult> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 1 } });

    let fileCount = 0;

    archive.on('progress', (p: { entries: { processed: number } }) => {
      fileCount = p.entries.processed;
      if (progress) {
        progress.update(`📦 Zipping: ${fileCount} files processed...`);
      }
    });

    archive.pipe(output);

    archive.directory(dirPath, false);

    output.on('close', () => {
      const zipSize = archive.pointer();
      resolve({ zipPath: outputPath, zipSize });
    });

    archive.on('error', reject);
    archive.finalize();
  });
}
