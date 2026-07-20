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
exports.handleImage = handleImage;
exports.handleImageAction = handleImageAction;
const grammy_1 = require("grammy");
const fs = __importStar(require("fs"));
const tg_1 = require("../utils/tg");
/**
 * Handle incoming image messages — ask user what to do
 */
async function handleImage(ctx) {
    const photo = ctx.message?.photo;
    if (!photo)
        return;
    const replyText = `🖼 **What would you like to do with this image?**

Reply with a number:
1️⃣ Convert to GIF
2️⃣ Google Image Search
3️⃣ Yandere Image Search`;
    await ctx.reply(replyText, {
        parse_mode: 'Markdown',
        reply_parameters: { message_id: ctx.message.message_id },
    });
}
/**
 * Handle image action selection (reply with 1, 2, or 3)
 */
async function handleImageAction(ctx, action) {
    const repliedMsg = ctx.message?.reply_to_message;
    if (!repliedMsg?.photo)
        return;
    const photo = repliedMsg.photo;
    const fileId = photo[photo.length - 1].file_id;
    const file = await ctx.api.getFile(fileId);
    const filePath = (0, tg_1.tempFilePath)('input.jpg');
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    try {
        switch (action) {
            case '1': {
                const { videoToGif } = await Promise.resolve().then(() => __importStar(require('../modules/media.js')));
                const { createProgress } = await Promise.resolve().then(() => __importStar(require('../utils/progress.js')));
                const progress = await createProgress(ctx, '⏳ Converting image to GIF...');
                try {
                    const gifPath = await videoToGif(filePath);
                    await progress.delete();
                    await ctx.replyWithAnimation(new grammy_1.InputFile(gifPath), {
                        reply_parameters: { message_id: repliedMsg.message_id },
                    });
                    (0, tg_1.cleanupFile)(gifPath);
                }
                catch (err) {
                    await progress.update('❌ Failed to convert to GIF.');
                    console.error(err);
                }
                break;
            }
            case '2': {
                await ctx.reply(`🔍 **Google Lens Search**\n\nTo search, right-click the image and use "Search image with Google Lens", or:\n\n[Open Google Lens](https://lens.google.com)`, {
                    parse_mode: 'Markdown',
                    reply_parameters: { message_id: repliedMsg.message_id },
                });
                break;
            }
            case '3': {
                await ctx.reply(`🔍 **Yandex Image Search**\n\n[Open Yandex Images](https://yandex.com/images)\n\nUpload the image there for reverse search.`, {
                    parse_mode: 'Markdown',
                    reply_parameters: { message_id: repliedMsg.message_id },
                });
                break;
            }
        }
    }
    finally {
        (0, tg_1.cleanupFile)(filePath);
    }
}
//# sourceMappingURL=image.js.map