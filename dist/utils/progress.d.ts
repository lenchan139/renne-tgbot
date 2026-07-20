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
export declare function createProgress(ctx: Context, initialText: string): Promise<ProgressTracker>;
//# sourceMappingURL=progress.d.ts.map