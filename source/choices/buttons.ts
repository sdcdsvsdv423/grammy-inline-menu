import {getButtonsAsRows, getButtonsOfPage, maximumButtonsPerPage,} from '../buttons/align.ts';
import {createPaginationChoices} from '../buttons/pagination.ts';
import type {CallbackButtonTemplate} from '../keyboard.ts';
import type {Choices, ChoiceTextFunc, ManyChoicesOptions} from './types.ts';
import {ensureCorrectChoiceKeys, getChoiceKeysFromChoices, getChoiceTextByKey,} from './understand-choices.ts';
import type {ButtonIcon, ButtonIconValue, ChoiceIconFunc} from "../buttons/types.ts";

function normalizeButtonIcon(icon: ButtonIconValue | undefined): ButtonIcon | null {
	if (!icon) {
		return null;
	}

	if (typeof icon === 'string') {
		return {
			iconCustomEmojiId: icon,
		};
	}

	return icon;
}

async function resolveButtonIcon<Context>(
	context: Context,
	key: string,
	icon: ChoiceIconFunc<Context> | undefined,
): Promise<ButtonIcon | null> {
	const resolvedIcon = typeof icon === 'function'
		? await icon(context, key)
		: icon;

	return normalizeButtonIcon(resolvedIcon);
}

export function generateChoicesButtons<Context>(
	uniqueIdentifierPrefix: string,
	isSubmenu: boolean,
	options: ManyChoicesOptions<Context>,
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
		const currentPage = await options.getCurrentPage?.(context);
		const keysOfPage = getButtonsOfPage(
			choiceKeys,
			options.columns,
			options.maxRows,
			currentPage,
		);
		const buttonsOfPage = await Promise.all(keysOfPage.map(async key => {
			const text = await textFunction(context, key);
			const icon = await resolveButtonIcon(
				context,
				key,
				options.buttonIcon !== undefined ? options.buttonIcon : options.iconCustomEmojiId,
			);
			const style = typeof options.style === 'function' ? await options.style(context, key) : options.style;
			const relativePath = uniqueIdentifierPrefix + ':' + key
				+ (isSubmenu ? '/' : '');

			return {
				text,
				relativePath,
				...(icon?.iconCustomEmojiId ? {icon_custom_emoji_id: icon.iconCustomEmojiId} : {}),
				...(icon?.fallbackEmoji ? {fallback_emoji: icon.fallbackEmoji} : {}),
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

export function generateChoicesPaginationButtons<Context>(
	uniqueIdentifierPrefix: string,
	choiceKeys: number,
	currentPage: number | undefined,
	options: ManyChoicesOptions<Context>,
): CallbackButtonTemplate[] {
	const entriesPerPage = maximumButtonsPerPage(
		options.columns,
		options.maxRows,
	);
	const totalPages = choiceKeys / entriesPerPage;
	const pageRecord = createPaginationChoices(totalPages, currentPage);
	const pageKeys = Object.keys(pageRecord).map(Number);
	const pageButtons = pageKeys.map((page): CallbackButtonTemplate => ({
		relativePath: `${uniqueIdentifierPrefix}P:${page}`,
		text: pageRecord[page]!,
		icon_custom_emoji_id: undefined,
		style: undefined,
	}));

	return pageButtons;
}

export function createChoiceTextFunction<Context>(
	choices: Choices,
	buttonText: undefined | ChoiceTextFunc<Context>,
): ChoiceTextFunc<Context> {
	if (buttonText) {
		return buttonText;
	}

	return (_, key) => getChoiceTextByKey(choices, key);
}
