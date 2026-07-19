import { Context } from 'grammy';
import * as fs from 'fs';
import { tempFilePath, cleanupFile } from '../utils/tg';

/**
 * Handle incoming video messages — ask user what to do
 */
export async function handleVideo(ctx: Context) {
  const video = ctx.message?.video;
  if (!video) return;

  const replyText = `🎬 **What would you like to do with this video?**

Reply with:
1️⃣ Convert to GIF`;

  await ctx.reply(replyText, {
    parse_mode: 'Markdown',
    reply_parameters: { message_id: ctx.message!.message_id },
  });
}

/**
 * Handle video action selection
 */
export async function handleVideoAction(ctx: Context, action: '1') {
  const repliedMsg = ctx.message?.reply_to_message;
  if (!repliedMsg?.video) return;

  const video = repliedMsg.video;
  const fileId = video.file_id;

  const file = await ctx.api.getFile(fileId);
  const filePath = tempFilePath('input.mp4');
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(fileUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  try {
    if (action === '1') {
      // Convert to GIF
      const { videoToGif } = await import('../modules/media.js');
      const { createProgress } = await import('../utils/progress.js');
      const progress = await createProgress(ctx, '⏳ Converting video to GIF...');
      try {
        const gifPath = await videoToGif(filePath, (pct) => {
          progress.update(`⏳ Converting video to GIF... ${pct}%`);
        });
        await progress.delete();
        await ctx.replyWithAnimation(
          { source: fs.createReadStream(gifPath) as any },
          { reply_parameters: { message_id: repliedMsg.message_id } }
        );
        cleanupFile(gifPath);
      } catch (err) {
        await progress.update('❌ Failed to convert video to GIF.');
        console.error(err);
      }
    }
  } finally {
    cleanupFile(filePath);
  }
}
