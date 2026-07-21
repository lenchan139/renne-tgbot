import { Context, InputFile, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import { tempFilePath, cleanupFile } from '../utils/tg.js';

/**
 * Handle incoming image messages — ask user what to do via inline buttons
 */
export async function handleImage(ctx: Context) {
  const photo = ctx.message?.photo;
  if (!photo) return;

  const keyboard = new InlineKeyboard()
    .text('1️⃣ Convert to GIF', 'img_gif')
    .text('2️⃣ Google Search', 'img_google')
    .text('3️⃣ SauceNAO', 'img_saucenao');

  await ctx.reply('🖼 **What would you like to do with this image?**', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
    reply_parameters: { message_id: ctx.message!.message_id },
  });
}

/**
 * Handle image action from inline button callback
 */
export async function handleImageAction(ctx: Context, action: string) {
  const repliedMsg = ctx.callbackQuery?.message?.reply_to_message;
  if (!repliedMsg?.photo) {
    await ctx.answerCallbackQuery('⚠️ Original image not found');
    return;
  }

  await ctx.answerCallbackQuery();

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
      case 'img_gif': {
        const { imageToAnimation } = await import('../modules/media.js');
        const { createProgress } = await import('../utils/progress.js');
        const progress = await createProgress(ctx, '⏳ Creating animation...');
        try {
          const animPath = await imageToAnimation(filePath);
          await progress.delete();
          await ctx.replyWithAnimation(new InputFile(animPath), {
            reply_parameters: { message_id: repliedMsg.message_id },
          });
          cleanupFile(animPath);
        } catch (err) {
          await progress.update('❌ Failed to create animation.');
          console.error(err);
        }
        break;
      }
      case 'img_google': {
        await ctx.reply(
          `🔍 **Google Lens Search**\n\nTo search, right-click the image and use "Search image with Google Lens", or:\n\n[Open Google Lens](https://lens.google.com)`,
          {
            parse_mode: 'Markdown',
            reply_parameters: { message_id: repliedMsg.message_id },
          }
        );
        break;
      }
      case 'img_saucenao': {
        await ctx.reply(
          `🔍 **SauceNAO Image Search**\n\nUpload the image to [SauceNAO](https://saucenao.com) for reverse image search (anime/artwork source lookup).`,
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
