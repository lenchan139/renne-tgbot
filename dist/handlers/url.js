"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleXUrl = handleXUrl;
const constants_1 = require("../utils/constants");
const tg_1 = require("../utils/tg");
/**
 * Handle x.com / twitter.com URL messages
 * - In PM: reply with fixupx.com URL
 * - In group with admin: edit the original message
 */
async function handleXUrl(ctx) {
    const text = ctx.message?.text;
    if (!text)
        return;
    // Find x.com or twitter.com URLs in the message
    const urlRegex = new RegExp(`(https?://(?:www\\.)?(${constants_1.X_DOMAINS.join('|')})/[^\\s]+)`, 'gi');
    const matches = text.match(urlRegex);
    if (!matches || matches.length === 0)
        return;
    // Build the replacement URL
    let replacedText = text;
    for (const url of matches) {
        const fixupUrl = url.replace(/https?:\/\/(?:www\.)?(x\.com|twitter\.com)/i, `https://${constants_1.X_FIXUP_DOMAIN}`);
        replacedText = replacedText.replace(url, fixupUrl);
    }
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    if (isGroup) {
        const admin = await (0, tg_1.isAdmin)(ctx);
        if (admin && ctx.message?.message_id) {
            // Edit the original message instead of replying
            try {
                await ctx.api.editMessageText(ctx.chat.id, ctx.message.message_id, replacedText);
                return;
            }
            catch {
                // If edit fails (e.g. no text permissions), fall back to reply
            }
        }
    }
    // Reply (PM or non-admin group)
    if (replacedText !== text) {
        await ctx.reply(replacedText, {
            reply_parameters: { message_id: ctx.message.message_id },
        });
    }
}
//# sourceMappingURL=url.js.map