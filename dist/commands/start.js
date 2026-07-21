export async function startCommand(ctx) {
    const text = `👋 **...どうかしら？**

I can help you with:

📥 **Torrent Downloads**
Send me a torrent file or magnet link, or use /bt to start.

🖼 **Image Tools**
Send an image → convert to GIF, Google reverse search, Yandere search.

🎬 **Video Tools**
Send a video → convert to GIF.

🎞 **GIF Tools**
Send a GIF → convert to video or extract frame.

🔗 **URL Fixer**
Send an x.com or twitter.com link → I'll fix it.

Type /help for detailed usage.`;
    await ctx.reply(text, { parse_mode: 'Markdown' });
}
//# sourceMappingURL=start.js.map