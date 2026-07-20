import { Context, InputFile } from 'grammy';
import * as fs from 'fs';
import { tempFilePath, cleanupFile } from '../utils/tg';

/**
 * Handle incoming image messages — ask user what to do
 */
export async function handleImage(ctx: Context) {
  const photo = ctx.message?.photo;
  if (!photo) return;

  const replyText = `🖼 **What would you like to do with this image?**

Reply with a number:
1️⃣ Convert to GIF
2️⃣ Google Image Search
3️⃣ Yandere Image Search`;

  await ctx.reply(replyText, {
    parse_mode: 'Markdown',
    reply_parameters: { message_id: ctx.message!.message_id },
  });
}

/**
 * Handle image action selection (reply with 1, 2, or 3)
 */
export async function handleImageAction(ctx: Context, action: '1' | '2' | '3') {
  const repliedMsg = ctx.message?.reply_to_message;
  if (!repliedMsg?.photo) return;

  const photo = repliedMsg.photo;
  const fileId = photo[photo.length - 1].file_id;

  const file = await ctx.api.getFile(fileId);
  const filePath = tempFilePath('input.jpg');
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(fileUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  try {
    switch (action) {
      case '1': {
        const { videoToGif } = await import('../modules/media.js');
        const { createProgress } = await import('../utils/progress.js');
        const progress = await createProgress(ctx, '⏳ Converting image to GIF...');
        try {
          const gifPath = await videoToGif(filePath);
          await progress.delete();
          await ctx.replyWithAnimation(new InputFile(gifPath), {
            reply_parameters: { message_id: repliedMsg.message_id },
          });
          cleanupFile(gifPath);
        } catch (err) {
          await progress.update('❌ Failed to convert to GIF.');
          console.error(err);
        }
        break;
      }
      case '2': {
        await ctx.reply(
          `🔍 **Google Lens Search**\n\nTo search, right-click the image and use "Search image with Google Lens", or:\n\n[Open Google Lens](https://lens.google.com)`,
          {
            parse_mode: 'Markdown',
            reply_parameters: { message_id: repliedMsg.message_id },
          }
        );
        break;
      }
      case '3': {
        await ctx.reply(
          `🔍 **Yandex Image Search**\n\n[Open Yandex Images](https://yandex.com/images)\n\nUpload the image there for reverse search.`,
          {
            parse_mode: 'Markdown',
            reply_parameters: { message_id: repliedMsg.message_id },
          }
        );
        break;
      }
    }
  } finally {
    cleanupFile(filePath);
  }
}
