import type {ConstOrContextPathFunc, ConstOrPromise, ContextPathFunc} from '../generic-types.ts';
import type {CallbackButtonTemplate} from '../keyboard.ts';
import {prefixEmoji} from '../prefix.ts';
import type {SingleButtonOptions} from './basic.ts';
import type {ButtonIcon, ButtonIconValue, ButtonInfo} from "./types.js";

export type FormatStateFunction<Context> = (
	context: Context,
	text: string,
	state: boolean,
	path: string,
) => ConstOrPromise<string | ButtonInfo>;

export interface ToggleOptions<Context> extends SingleButtonOptions<Context> {
	/** Function returning the current state. */
	readonly isSet: ContextPathFunc<Context, boolean>;

	/** Function which is called when a user presses the button. */
	readonly set: (
		context: Context,
		newState: boolean,
		path: string,
	) => ConstOrPromise<string | boolean>;

	/** Format the button text which is visible to the user. */
	readonly formatState?: FormatStateFunction<Context>;
}

function normalizeButtonIcon(icon: ButtonIconValue | undefined): ButtonIcon | null {
	if (icon == null || icon === '') {
		return null;
	}

	if (typeof icon === 'string') {
		return {
			iconCustomEmojiId: icon,
		};
	}

	return icon;
}

async function resolveButtonIconOption<Context>(
	context: Context,
	path: string,
	buttonIcon: ConstOrContextPathFunc<Context, ButtonIconValue> | undefined,
): Promise<ButtonIconValue | undefined> {
	return typeof buttonIcon === 'function'
		? await buttonIcon(context, path)
		: buttonIcon;
}

async function resolveToggleButtonIcon<Context>(
	context: Context,
	path: string,
	normalized: ButtonInfo,
	options: ToggleOptions<Context>,
): Promise<ButtonIcon | null> {
	const buttonIconInput = normalized.buttonIcon !== undefined
		? normalized.buttonIcon
		: normalized.iconCustomEmojiId != null
			? normalized.iconCustomEmojiId
			: options.buttonIcon !== undefined
				? await resolveButtonIconOption(context, path, options.buttonIcon)
				: await resolveButtonIconOption(context, path, options.iconCustomEmojiId);

	return normalizeButtonIcon(buttonIconInput);
}

export function generateToggleButton<Context>(
	uniqueIdentifierPrefix: string,
	options: ToggleOptions<Context>,
): ContextPathFunc<Context, CallbackButtonTemplate | undefined> {
	const formatFunction: FormatStateFunction<Context> = options.formatState
		?? ((_, text, state) => prefixEmoji(text, state));

	return async (context, path) => {
		if (await options.hide?.(context, path)) {
			return undefined;
		}

		const textResult = typeof options.text === 'function'
			? await options.text(context, path)
			: options.text;
		const state = await options.isSet(context, path);

		const formatted = await formatFunction(context, textResult, state, path);
		const normalized = typeof formatted === 'string' ? {text: formatted} : formatted;

		const buttonIcon = await resolveToggleButtonIcon(
			context,
			path,
			normalized,
			options,
		);

		const style = normalized.style != null ? normalized.style :
			typeof options.style === 'function'
				? await options.style(context, path)
				: options.style;

		return {
			text: buttonIcon?.fallbackEmoji
				? buttonIcon.fallbackEmoji + ' ' + normalized.text
				: normalized.text,
			relativePath: uniqueIdentifierPrefix + ':' + (state ? 'false' : 'true'),
			...(buttonIcon?.iconCustomEmojiId ? {icon_custom_emoji_id: buttonIcon.iconCustomEmojiId} : {}),
			...(style ? {style} : {}),
		};
	};
}
