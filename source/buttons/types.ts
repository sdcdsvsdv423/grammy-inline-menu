import type {ConstOrPromise} from "../generic-types.ts";

export type ButtonStyle = 'primary' | 'success' | 'danger';

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

export interface ButtonInfo {
	text: string;

	/** Icon shown before the text of the button */
	buttonIcon?: ButtonIconValue;

	/**
	 * Custom Emoji shown before the text of the button
	 *
	 * @deprecated Use `buttonIcon` instead.
	 */
	iconCustomEmojiId?: string | null;

	/** Visual button style */
	style?: ButtonStyle | null;
}
