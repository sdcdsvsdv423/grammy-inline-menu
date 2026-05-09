import type {ConstOrPromise} from "../generic-types.ts";

export type ButtonStyle = 'primary' | 'success' | 'danger';

export type ButtonInfo = { text: string; style?: ButtonStyle; iconCustomEmojiId?: string }

export type ButtonIcon = {
	iconCustomEmojiId?: string | null
	fallbackEmoji?: string | null
}

export type ButtonIconValue = ButtonIcon | string | null

export type ChoiceIconFunc<Context> =
	| ((
	context: Context,
	key: string,
) => ConstOrPromise<ButtonIconValue>)
	| ButtonIconValue

/**
 * @deprecated Use ChoiceIconFunc instead.
 */
export type ChoiceIconCustomIdFunc<Context> = ChoiceIconFunc<Context>;
