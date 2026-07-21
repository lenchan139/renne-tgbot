import { InputFile, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import { tempFilePath, cleanupFile } from '../utils/tg.js';
/**
 * Handle incoming GIF messages — ask user what to do via inline buttons
 */
export async function handleGif(ctx) {
    const animation = ctx.message?.animation;
    if (!animation)
        return;
    const keyboard = new InlineKeyboard()
        .text('1️⃣ Convert to Video (MP4)', 'gif_video')
        .text('2️⃣ Extract Frame (PNG)', 'gif_frame');
    await ctx.reply('🎞 **What would you like to do with this GIF?**', {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message.message_id },
    });
}
/**
 * Handle GIF action from inline button callback
 */
export async function handleGifAction(ctx, action) {
    const repliedMsg = ctx.callbackQuery?.message?.reply_to_message;
    if (!repliedMsg?.animation) {
        await ctx.answerCallbackQuery('⚠️ Original GIF not found');
        return;
    }
    await ctx.answerCallbackQuery();
    const animation = repliedMsg.animation;
    const fileId = animation.file_id;
    const file = await ctx.api.getFile(fileId);
    const filePath = tempFilePath('input.gif');
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    try {
        switch (action) {
            case 'gif_video': {
                const { gifToVideo } = await import('../modules/media.js');
                const { createProgress } = await import('../utils/progress.js');
                const progress = await createProgress(ctx, '⏳ Converting GIF to video...');
                try {
                    const videoPath = await gifToVideo(filePath);
                    await progress.delete();
                    await ctx.replyWithVideo(new InputFile(videoPath), {
                        reply_parameters: { message_id: repliedMsg.message_id },
                    });
                    cleanupFile(videoPath);
                }
                catch (err) {
                    await progress.update('❌ Failed to convert GIF to video.');
                    console.error(err);
                }
                break;
            }
            case 'gif_frame': {
                const { gifToImage } = await import('../modules/media.js');
                try {
                    const imgPath = await gifToImage(filePath);
                    await ctx.replyWithPhoto(new InputFile(imgPath), {
                        reply_parameters: { message_id: repliedMsg.message_id },
                    });
                    cleanupFile(imgPath);
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
        cleanupFile(filePath);
    }
}
//# sourceMappingURL=gif.js.map