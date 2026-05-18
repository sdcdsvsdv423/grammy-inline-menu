import {
	createChoiceTextFunction,
	generateChoicesPaginationButtons,
	type ManyChoicesOptions,
} from '../choices/index.ts';
import {ensureCorrectChoiceKeys, getChoiceKeysFromChoices,} from '../choices/understand-choices.ts';
import type {ConstOrPromise} from '../generic-types.ts';
import type {CallbackButtonTemplate} from '../keyboard.ts';
import {prefixEmoji} from '../prefix.ts';
import {getButtonsAsRows, getButtonsOfPage} from './align.ts';
import type {ButtonIcon, ButtonIconValue, ButtonInfo} from './types.js';

export type IsSetFunction<Context> = (
	context: Context,
	key: string,
) => ConstOrPromise<boolean>;

export type SetFunction<Context> = (
	context: Context,
	key: string,
	newState: boolean,
) => ConstOrPromise<string | boolean>;

export type FormatStateFunction<Context> = (
	context: Context,
	textResult: string,
	state: boolean,
	key: string,
) => ConstOrPromise<string | ButtonInfo>;

export type ChoiceButtonIconOption<Context> =
	| ButtonIconValue
	| ((
	context: Context,
	key: string,
) => ConstOrPromise<ButtonIconValue>);

export interface SelectOptions<Context> extends ManyChoicesOptions<Context> {
	/**
	 * Show an emoji for the choices currently false.
	 * This is helpful to show the user there can be selected multiple choices at the same time.
	 */
	readonly showFalseEmoji?: boolean;

	/** Function returning the current state of a given choice. */
	readonly isSet: IsSetFunction<Context>;

	/**
	 * Function which is called when a user selects a choice.
	 * Arguments include the choice (`key`) and the new `state` which is helpful for multiple toggles.
	 */
	readonly set: SetFunction<Context>;

	/** Format the button text which is visible to the user. */
	readonly formatState?: FormatStateFunction<Context>;

	/**
	 * Custom button icon for every choice.
	 * String value is treated as Telegram custom emoji id.
	 */
	readonly buttonIcon?: ChoiceButtonIconOption<Context>;
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
	key: string,
	buttonIcon: ChoiceButtonIconOption<Context> | undefined,
): Promise<ButtonIconValue | undefined> {
	return typeof buttonIcon === 'function'
		? await buttonIcon(context, key)
		: buttonIcon;
}

async function resolveSelectButtonIcon<Context>(
	context: Context,
	key: string,
	normalized: ButtonInfo,
	options: SelectOptions<Context>,
): Promise<ButtonIcon | null> {
	const buttonIconInput = normalized.buttonIcon !== undefined
		? normalized.buttonIcon
		: normalized.iconCustomEmojiId != null
			? normalized.iconCustomEmojiId
			: options.buttonIcon !== undefined
				? await resolveButtonIconOption(context, key, options.buttonIcon)
				: typeof options.iconCustomEmojiId === 'function'
					? await options.iconCustomEmojiId(context, key)
					: options.iconCustomEmojiId;

	return normalizeButtonIcon(buttonIconInput);
}

export function generateSelectButtons<Context>(
	uniqueIdentifierPrefix: string,
	options: SelectOptions<Context>,
): (context: Context, path: string) => Promise<CallbackButtonTemplate[][]> {
	return async (context, path) => {
		if (await options.hide?.(context, path)) {
			return [];
		}

		const choicesConstant = typeof options.choices === 'function'
			? await options.choices(context)
			: options.choices;
		const choiceKeys = getChoiceKeysFromChoices(choicesConstant);

		ensureCorrectChoiceKeys(uniqueIdentifierPrefix, path, choiceKeys);

		const textFunction = createChoiceTextFunction(
			choicesConstant,
			options.buttonText,
		);
		const formatFunction: FormatStateFunction<Context> = options.formatState
			?? ((_, textResult, state) =>
				prefixEmoji(textResult, state, {
					hideFalseEmoji: !options.showFalseEmoji,
				}));

		const currentPage = await options.getCurrentPage?.(context);
		const keysOfPage = getButtonsOfPage(
			choiceKeys,
			options.columns,
			options.maxRows,
			currentPage,
		);

		const buttonsOfPage = await Promise.all(keysOfPage.map(async key => {
			const textResult = await textFunction(context, key);
			const state = await options.isSet(context, key);

			const formatted = await formatFunction(context, textResult, state, key);
			const normalized = typeof formatted === 'string'
				? {text: formatted}
				: formatted;

			const buttonIcon = await resolveSelectButtonIcon(
				context,
				key,
				normalized,
				options,
			);

			const style = normalized.style != null
				? normalized.style
				: typeof options.style === 'function'
					? await options.style(context, key)
					: options.style;

			const dropinLetter = state ? 'F' : 'T';
			const relativePath = uniqueIdentifierPrefix + dropinLetter + ':' + key;

			return {
				text: buttonIcon?.fallbackEmoji
					? buttonIcon.fallbackEmoji + ' ' + normalized.text
					: normalized.text,
				relativePath,
				...(buttonIcon?.iconCustomEmojiId
					? {icon_custom_emoji_id: buttonIcon.iconCustomEmojiId}
					: {}),
				...(style ? {style} : {}),
			};
		}));

		const rows = getButtonsAsRows(buttonsOfPage, options.columns);

		if (options.setPage) {
			rows.push(generateChoicesPaginationButtons(
				uniqueIdentifierPrefix,
				choiceKeys.length,
				currentPage,
				options,
			));
		}

		return rows;
	};
}
