import type { Api } from 'grammy';

/**
 * Telegram does not deliver message-deletion events to bots. To clean up
 * after the original post is removed (e.g. by a group anti-spam bot), we
 * poll its existence and delete the bot's own replies when it disappears.
 *
 * `setMessageReaction` with an empty list acts as a side-effect-free
 * existence probe. It requires the bot to be allowed to react in the chat
 * (usually a group admin); if it is not, we stop quietly.
 */

const CHECK_INTERVAL_MS = 60_000;
const MAX_CHECKS = 10; // keep watching for ~10 minutes

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isNotFound(err: unknown): boolean {
  return /message (?:to [a-z ]+ )?not found|message not found|message_id_invalid/i.test(
    errorMessage(err)
  );
}

function isPermissionError(err: unknown): boolean {
  return /not enough rights|chat_admin_required|have no rights|bot is not a member|not a participant/i.test(
    errorMessage(err)
  );
}

export function watchForOriginalDeletion(
  api: Api,
  chatId: number,
  originalMessageId: number,
  sentMessageIds: number[]
): void {
  if (sentMessageIds.length === 0) return;

  let checks = 0;

  const timer = setInterval(() => {
    checks++;
    if (checks > MAX_CHECKS) {
      clearInterval(timer);
      return;
    }

    void (async () => {
      try {
        // Empty reaction list = probe only (no visible change)
        await api.setMessageReaction(chatId, originalMessageId, []);
      } catch (err) {
        if (isNotFound(err)) {
          clearInterval(timer);
          for (const id of sentMessageIds) {
            await api.deleteMessage(chatId, id).catch(() => {});
          }
        } else if (isPermissionError(err)) {
          // Can't probe in this chat — stop quietly
          clearInterval(timer);
        }
      }
    })();
  }, CHECK_INTERVAL_MS);

  // Do not keep the process alive only for this timer
  if (typeof timer.unref === 'function') timer.unref();
}
