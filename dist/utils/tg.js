import * as path from 'path';
import * as fs from 'fs';
import { TMP_DIR } from './constants.js';
/** Ensure tmp directory exists */
export function ensureTmpDir() {
    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    return TMP_DIR;
}
/** Generate a unique temp file path */
export function tempFilePath(originalName) {
    ensureTmpDir();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return path.join(TMP_DIR, `${unique}-${originalName}`);
}
/** Clean up a file (no throw) */
export function cleanupFile(filepath) {
    try {
        if (fs.existsSync(filepath))
            fs.unlinkSync(filepath);
    }
    catch { }
}
/** Clean up directory recursively */
export function cleanupDir(dirpath) {
    try {
        if (fs.existsSync(dirpath))
            fs.rmSync(dirpath, { recursive: true, force: true });
    }
    catch { }
}
/** Get the chat ID from context (works in both PM and group) */
export function getChatId(ctx) {
    return ctx.chat?.id;
}
/** Get the user ID */
export function getUserId(ctx) {
    return ctx.from?.id;
}
/** Check if user is chat admin */
export async function isAdmin(ctx) {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    if (!chatId || !userId)
        return false;
    try {
        const member = await ctx.api.getChatMember(chatId, userId);
        return ['administrator', 'creator'].includes(member.status);
    }
    catch {
        return false;
    }
}
/** Format file size nicely */
export function formatSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
/** Detect if a message contains a magnet link */
export function extractMagnet(text) {
    const match = text.match(/magnet:\?xt=[^\s]+/i);
    return match ? match[0] : null;
}
//# sourceMappingURL=tg.js.map