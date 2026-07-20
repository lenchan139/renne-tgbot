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
const grammy_1 = require("grammy");
const dotenv = __importStar(require("dotenv"));
const start_1 = require("./commands/start");
const help_1 = require("./commands/help");
const bt_1 = require("./commands/bt");
const image_1 = require("./handlers/image");
const video_1 = require("./handlers/video");
const gif_1 = require("./handlers/gif");
const url_1 = require("./handlers/url");
const torrent_1 = require("./handlers/torrent");
const tg_1 = require("./utils/tg");
dotenv.config();
const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
}
const bot = new grammy_1.Bot(token);
// ─── Command handlers ───────────────────────────────────────
bot.command('start', start_1.startCommand);
bot.command('help', help_1.helpCommand);
bot.command('bt', bt_1.btCommand);
// ─── Message handlers ───────────────────────────────────────
bot.on('message', async (ctx) => {
    const msg = ctx.message;
    const text = msg.text || '';
    const isDigitReply = /^\d$/.test(text);
    const repliedTo = msg.reply_to_message;
    // 1. Action replies (digit text replying to photo/video/gif)
    if (isDigitReply && repliedTo) {
        if (repliedTo.photo && /^(1|2|3)$/.test(text)) {
            return (0, image_1.handleImageAction)(ctx, text);
        }
        if (repliedTo.video && text === '1') {
            return (0, video_1.handleVideoAction)(ctx, '1');
        }
        if (repliedTo.animation && /^(1|2)$/.test(text)) {
            return (0, gif_1.handleGifAction)(ctx, text);
        }
    }
    // 2. Document (torrent file)
    if (msg.document) {
        const name = msg.document.file_name || '';
        if (name.endsWith('.torrent')) {
            return (0, torrent_1.handleTorrentFile)(ctx);
        }
    }
    // 3. Magnet link in text
    if (text && (0, tg_1.extractMagnet)(text)) {
        return (0, torrent_1.handleMagnetLink)(ctx);
    }
    // 4. x.com / twitter.com URL
    if (text && /(x\.com|twitter\.com)/i.test(text)) {
        return (0, url_1.handleXUrl)(ctx);
    }
    // 5. Photo — ask what to do
    if (msg.photo) {
        return (0, image_1.handleImage)(ctx);
    }
    // 6. Video — ask what to do
    if (msg.video) {
        return (0, video_1.handleVideo)(ctx);
    }
    // 7. GIF / Animation — ask what to do
    if (msg.animation) {
        return (0, gif_1.handleGif)(ctx);
    }
});
// ─── Error handling ─────────────────────────────────────────
bot.catch((err) => {
    console.error('Bot error:', err);
});
// ─── Start polling ──────────────────────────────────────────
console.log('🚀 Renne Bot starting...');
bot.start({
    onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} is running!`);
    },
});
//# sourceMappingURL=bot.js.map