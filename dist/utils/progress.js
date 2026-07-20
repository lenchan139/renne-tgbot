"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgress = createProgress;
/**
 * Creates a progress message and returns a tracker.
 * The tracker's update() method edits the message in-place.
 */
async function createProgress(ctx, initialText) {
    const chatId = ctx.chat.id;
    const msg = await ctx.reply(initialText);
    const messageId = msg.message_id;
    let lastText = initialText;
    return {
        messageId,
        chatId,
        async update(text) {
            if (text === lastText)
                return;
            lastText = text;
            try {
                await ctx.api.editMessageText(chatId, messageId, text);
            }
            catch { }
        },
        async delete() {
            try {
                await ctx.api.deleteMessage(chatId, messageId);
            }
            catch { }
        },
    };
}
//# sourceMappingURL=progress.js.map