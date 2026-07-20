import archiver from 'archiver';
import * as fs from 'fs';
/**
 * Create a zip archive from a directory
 */
export function zipDirectory(dirPath, outputPath, progress) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 1 } });
        let fileCount = 0;
        archive.on('progress', (p) => {
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
//# sourceMappingURL=zipper.js.map