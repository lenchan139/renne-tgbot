import { Context } from 'grammy';

export interface ProgressTracker {
  messageId: number;
  chatId: number;
  update: (text: string) => Promise<void>;
  delete: () => Promise<void>;
}

/**
 * Creates a progress message and returns a tracker.
 * The tracker's update() method edits the message in-place.
 */
export async function createProgress(
  ctx: Context,
  initialText: string
): Promise<ProgressTracker> {
  const chatId = ctx.chat!.id;
  const msg = await ctx.reply(initialText);
  const messageId = msg.message_id;

  let lastText = initialText;

  return {
    messageId,
    chatId,
    async update(text: string) {
      if (text === lastText) return;
      lastText = text;
      try {
        await ctx.api.editMessageText(chatId, messageId, text);
      } catch {}
    },
    async delete() {
      try {
        await ctx.api.deleteMessage(chatId, messageId);
      } catch {}
    },
  };
}
