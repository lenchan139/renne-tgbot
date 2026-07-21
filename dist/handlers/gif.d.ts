import { Context } from 'grammy';
/**
 * Handle incoming GIF messages — ask user what to do via inline buttons
 */
export declare function handleGif(ctx: Context): Promise<void>;
/**
 * Handle GIF action from inline button callback
 */
export declare function handleGifAction(ctx: Context, action: string): Promise<void>;
//# sourceMappingURL=gif.d.ts.map