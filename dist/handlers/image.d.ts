import { Context } from 'grammy';
/**
 * Handle incoming image messages — ask user what to do
 */
export declare function handleImage(ctx: Context): Promise<void>;
/**
 * Handle image action selection (reply with 1, 2, or 3)
 */
export declare function handleImageAction(ctx: Context, action: '1' | '2' | '3'): Promise<void>;
//# sourceMappingURL=image.d.ts.map