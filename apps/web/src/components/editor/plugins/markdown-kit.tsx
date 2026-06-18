import {
  BaseFootnoteDefinitionPlugin,
  BaseFootnoteReferencePlugin,
} from '@platejs/footnote';
import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

export const MarkdownKit = [
  BaseFootnoteReferencePlugin,
  BaseFootnoteDefinitionPlugin,
  MarkdownPlugin.configure({
    options: {
      plainMarks: [KEYS.suggestion, KEYS.comment],
      remarkPlugins: [
        remarkMath,
        remarkGfm,
        // remark-emoji's plugin type lags the unified version used here; cast
        // to a sibling remark plugin's type rather than `any`.
        remarkEmoji as unknown as typeof remarkGfm,
        remarkMdx,
        remarkMention,
      ],
    },
  }),
];
