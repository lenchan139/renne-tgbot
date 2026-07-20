import { Context } from 'grammy';
/** Ensure tmp directory exists */
export declare function ensureTmpDir(): string;
/** Generate a unique temp file path */
export declare function tempFilePath(originalName: string): string;
/** Clean up a file (no throw) */
export declare function cleanupFile(filepath: string): void;
/** Clean up directory recursively */
export declare function cleanupDir(dirpath: string): void;
/** Get the chat ID from context (works in both PM and group) */
export declare function getChatId(ctx: Context): number | undefined;
/** Get the user ID */
export declare function getUserId(ctx: Context): number | undefined;
/** Check if user is chat admin */
export declare function isAdmin(ctx: Context): Promise<boolean>;
/** Format file size nicely */
export declare function formatSize(bytes: number): string;
/** Detect if a message contains a magnet link */
export declare function extractMagnet(text: string): string | null;
//# sourceMappingURL=tg.d.ts.map