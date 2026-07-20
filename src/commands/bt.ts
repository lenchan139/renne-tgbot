import { Context } from 'grammy';
import { extractMagnet } from '../utils/tg.js';

/**
 * /bt command — ask user to send torrent file or magnet link
 */
export async function btCommand(ctx: Context) {
  await ctx.reply(
    `📥 **Send me a torrent file or magnet link**

• Send a \`.torrent\` file
• Paste a magnet link
• Or reply to a torrent file you already sent`,
    { parse_mode: 'Markdown' }
  );
}
