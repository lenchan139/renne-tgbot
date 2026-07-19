import * as archiver from 'archiver';
import * as fs from 'fs';
import { ProgressTracker } from '../utils/progress';

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
    const archive = archiver('zip', { zlib: { level: 1 } }); // Fast compression

    let fileCount = 0;
    let totalSize = 0;

    archive.on('progress', (p) => {
      fileCount = p.entries.processed;
      if (progress) {
        progress.update(`📦 Zipping: ${fileCount} files processed...`);
      }
    });

    archive.pipe(output);

    // Add all files in the directory
    archive.directory(dirPath, false);

    output.on('close', () => {
      const zipSize = archive.pointer();
      resolve({ zipPath: outputPath, zipSize });
    });

    archive.on('error', reject);
    archive.finalize();
  });
}
