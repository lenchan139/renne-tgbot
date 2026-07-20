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
exports.handleGif = handleGif;
exports.handleGifAction = handleGifAction;
const grammy_1 = require("grammy");
const fs = __importStar(require("fs"));
const tg_1 = require("../utils/tg");
/**
 * Handle incoming GIF messages — ask user what to do
 */
async function handleGif(ctx) {
    const animation = ctx.message?.animation;
    if (!animation)
        return;
    const replyText = `🎞 **What would you like to do with this GIF?**

Reply with:
1️⃣ Convert to Video (MP4)
2️⃣ Extract Frame (PNG)`;
    await ctx.reply(replyText, {
        parse_mode: 'Markdown',
        reply_parameters: { message_id: ctx.message.message_id },
    });
}
/**
 * Handle GIF action selection
 */
async function handleGifAction(ctx, action) {
    const repliedMsg = ctx.message?.reply_to_message;
    if (!repliedMsg?.animation)
        return;
    const animation = repliedMsg.animation;
    const fileId = animation.file_id;
    const file = await ctx.api.getFile(fileId);
    const filePath = (0, tg_1.tempFilePath)('input.gif');
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    try {
        switch (action) {
            case '1': {
                const { gifToVideo } = await Promise.resolve().then(() => __importStar(require('../modules/media.js')));
                const { createProgress } = await Promise.resolve().then(() => __importStar(require('../utils/progress.js')));
                const progress = await createProgress(ctx, '⏳ Converting GIF to video...');
                try {
                    const videoPath = await gifToVideo(filePath);
                    await progress.delete();
                    await ctx.replyWithVideo(new grammy_1.InputFile(videoPath), {
                        reply_parameters: { message_id: repliedMsg.message_id },
                    });
                    (0, tg_1.cleanupFile)(videoPath);
                }
                catch (err) {
                    await progress.update('❌ Failed to convert GIF to video.');
                    console.error(err);
                }
                break;
            }
            case '2': {
                const { gifToImage } = await Promise.resolve().then(() => __importStar(require('../modules/media.js')));
                try {
                    const imgPath = await gifToImage(filePath);
                    await ctx.replyWithPhoto(new grammy_1.InputFile(imgPath), {
                        reply_parameters: { message_id: repliedMsg.message_id },
                    });
                    (0, tg_1.cleanupFile)(imgPath);
                }
                catch (err) {
                    await ctx.reply('❌ Failed to extract frame from GIF.');
                    console.error(err);
                }
                break;
            }
        }
    }
    finally {
        (0, tg_1.cleanupFile)(filePath);
    }
}
//# sourceMappingURL=gif.js.map