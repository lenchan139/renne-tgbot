"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTmpDir = ensureTmpDir;
exports.tempFilePath = tempFilePath;
exports.cleanupFile = cleanupFile;
exports.cleanupDir = cleanupDir;
exports.getChatId = getChatId;
exports.getUserId = getUserId;
exports.isAdmin = isAdmin;
exports.formatSize = formatSize;
exports.extractMagnet = extractMagnet;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const constants_1 = require("./constants");
/** Ensure tmp directory exists */
function ensureTmpDir() {
    if (!fs.existsSync(constants_1.TMP_DIR)) {
        fs.mkdirSync(constants_1.TMP_DIR, { recursive: true });
    }
    return constants_1.TMP_DIR;
}
/** Generate a unique temp file path */
function tempFilePath(originalName) {
    ensureTmpDir();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return path.join(constants_1.TMP_DIR, `${unique}-${originalName}`);
}
/** Clean up a file (no throw) */
function cleanupFile(filepath) {
    try {
        if (fs.existsSync(filepath))
            fs.unlinkSync(filepath);
    }
    catch { }
}
/** Clean up directory recursively */
function cleanupDir(dirpath) {
    try {
        if (fs.existsSync(dirpath))
            fs.rmSync(dirpath, { recursive: true, force: true });
    }
    catch { }
}
/** Get the chat ID from context (works in both PM and group) */
function getChatId(ctx) {
    return ctx.chat?.id;
}
/** Get the user ID */
function getUserId(ctx) {
    return ctx.from?.id;
}
/** Check if user is chat admin */
async function isAdmin(ctx) {
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
function formatSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
/** Detect if a message contains a magnet link */
function extractMagnet(text) {
    const match = text.match(/magnet:\?xt=[^\s]+/i);
    return match ? match[0] : null;
}
//# sourceMappingURL=tg.js.map