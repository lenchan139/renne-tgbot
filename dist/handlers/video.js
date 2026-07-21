import { InputFile, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import { tempFilePath, cleanupFile } from '../utils/tg.js';
/**
 * Handle incoming video messages — ask user what to do via inline buttons
 */
export async function handleVideo(ctx) {
    const video = ctx.message?.video;
    if (!video)
        return;
    const keyboard = new InlineKeyboard()
        .text('1️⃣ Convert to GIF', 'vid_gif');
    await ctx.reply('🎬 **What would you like to do with this video?**', {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message.message_id },
    });
}
/**
 * Handle video action from inline button callback
 */
export async function handleVideoAction(ctx, action) {
    const repliedMsg = ctx.callbackQuery?.message?.reply_to_message;
    if (!repliedMsg?.video) {
        await ctx.answerCallbackQuery('⚠️ Original video not found');
        return;
    }
    await ctx.answerCallbackQuery();
    const video = repliedMsg.video;
    const fileId = video.file_id;
    const file = await ctx.api.getFile(fileId);
    const filePath = tempFilePath('input.mp4');
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    try {
        if (action === 'vid_gif') {
            const { videoToGif } = await import('../modules/media.js');
            const { createProgress } = await import('../utils/progress.js');
            const progress = await createProgress(ctx, '⏳ Converting video to GIF...');
            try {
                const gifPath = await videoToGif(filePath, (pct) => {
                    progress.update(`⏳ Converting video to GIF... ${pct}%`);
                });
                await progress.delete();
                await ctx.replyWithAnimation(new InputFile(gifPath), {
                    reply_parameters: { message_id: repliedMsg.message_id },
                });
                cleanupFile(gifPath);
            }
            catch (err) {
                await progress.update('❌ Failed to convert video to GIF.');
                console.error(err);
            }
        }
    }
    finally {
        cleanupFile(filePath);
    }
}
//# sourceMappingURL=video.js.map