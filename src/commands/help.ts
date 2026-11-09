import { Context } from 'grammy';

export async function helpCommand(ctx: Context) {
  const text = `📖 **Command List**

**Torrent**
• \`/bt <magnet link>\` — Start downloading
• Send a \`.torrent\` file directly
• Send a magnet link directly

**Image** (reply to an image)
• **Convert to GIF** — Animates image
• **Google Image Search** — Reverse search via Google Lens
• **Yandere Search** — Reverse search via Yandex

**Video** (reply to a video)
• **Convert to GIF** — Trims and converts

**GIF** (reply to a GIF)
• **Convert to Video** — GIF → MP4
• **Extract Frame** — GIF → PNG

**URL Fixer**
• Send any \`x.com\` / \`twitter.com\` link → \`fixupx.com\`
• In groups (admin): I edit the original message

**Facebook**
• Send a \`facebook.com\` / \`fb.watch\` post or video link
• I'll download the video/photo and send it directly
• If unavailable, I reply with the \`facebed.com\` embed link

**Notes**
• Torrent downloads show live progress
• Files > 2 GB are compressed as ZIP
• Images sent as 2 copies: compressed + uncompressed
• Works in PM and groups`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}
