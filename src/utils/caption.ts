/**
 * Build a caption from optional parts (author, body, link...).
 * Telegram captions are limited to 1024 characters, so trim with headroom.
 */
export function buildCaption(
  parts: (string | undefined | null)[],
  max = 1000
): string {
  const text = parts
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join('\n\n');

  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
