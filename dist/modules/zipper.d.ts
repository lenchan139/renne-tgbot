import { ProgressTracker } from '../utils/progress';
export interface ZipResult {
    zipPath: string;
    zipSize: number;
}
/**
 * Create a zip archive from a directory
 */
export declare function zipDirectory(dirPath: string, outputPath: string, progress?: ProgressTracker): Promise<ZipResult>;
//# sourceMappingURL=zipper.d.ts.map