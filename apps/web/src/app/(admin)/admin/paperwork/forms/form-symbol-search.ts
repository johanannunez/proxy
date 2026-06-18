import type { FormField } from "@/lib/admin/forms-types";
import {
  FORM_SYMBOLS,
  type FormSymbol,
  type FormSymbolCategory,
} from "./form-symbols";

export type SuggestionInput = {
  name: string;
  description: string | null;
  fields: Array<Pick<FormField, "id" | "type" | "label" | "placeholder">>;
};

export type SuggestionContext = {
  tokens: string[];
  primaryTokens: string[];
  fieldTokens: string[];
  phrases: string[];
  primaryPhrases: string[];
  fieldPhrases: string[];
  fieldTypes: FormField["type"][];
};

export type SuggestedFormSymbol = {
  symbol: FormSymbol;
  score: number;
  reason: string | null;
};

const WORD_RE = /[a-z0-9]+/g;
const MAX_SUGGESTIONS = 4;
// Scoring ladder (highest to lowest signal): an exact label match beats a
// label-token match, which beats a prefix match, which beats a keyword/alias
// hit, which beats a substring hit. Primary text (form name/description) is
// weighted roughly 2x field text. Emojis take a -1 tie-break penalty so an
// equally-relevant icon wins. MIN_SUGGESTION_SCORE sits just above a single
// field-token match (12) so one weak field hit never surfaces a suggestion.
const MIN_SUGGESTION_SCORE = 13;
const STOP_WORDS = new Set([
  "and",
  "are",
  "at",
  "for",
  "from",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const FIELD_TYPE_CATEGORY: Partial<Record<FormField["type"], FormSymbolCategory[]>> = {
  date: ["Documents"],
  email: ["Surveys"],
  file_upload: ["Documents"],
  phone: ["Surveys"],
  rating: ["Surveys", "Hospitality"],
  signature: ["Documents", "Compliance"],
};

export function buildSuggestionContext(input: SuggestionInput): SuggestionContext {
  const primaryPhrases = [input.name, input.description ?? ""].filter(Boolean);
  const fieldPhrases = input.fields
    .flatMap((field) => [field.label, field.placeholder ?? ""])
    .filter(Boolean);
  const phrases = [...primaryPhrases, ...fieldPhrases];
  return {
    phrases: phrases.map(normalizeText),
    primaryPhrases: primaryPhrases.map(normalizeText),
    fieldPhrases: fieldPhrases.map(normalizeText),
    tokens: unique(phrases.flatMap(tokenize)),
    primaryTokens: unique(primaryPhrases.flatMap(tokenize)),
    fieldTokens: unique(fieldPhrases.flatMap(tokenize)),
    fieldTypes: unique(input.fields.map((field) => field.type)),
  };
}

export function searchFormSymbols(query: string): FormSymbol[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return FORM_SYMBOLS;

  return FORM_SYMBOLS
    .map((symbol) => ({
      symbol,
      score: scoreSymbolForTokens(symbol, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort(compareScoredSymbols)
    .map((entry) => entry.symbol);
}

export function suggestFormSymbols(
  context: SuggestionContext,
  limit = MAX_SUGGESTIONS,
): SuggestedFormSymbol[] {
  const boundedLimit = Math.min(limit, MAX_SUGGESTIONS);
  return FORM_SYMBOLS
    .map((symbol) => {
      const { score, reason } = scoreSuggestion(symbol, context);
      return { symbol, score, reason };
    })
    .filter((entry) => entry.score >= MIN_SUGGESTION_SCORE)
    .sort(compareScoredSymbols)
    .slice(0, boundedLimit);
}

function compareScoredSymbols(
  a: { symbol: FormSymbol; score: number },
  b: { symbol: FormSymbol; score: number },
): number {
  return (
    b.score - a.score ||
    symbolKindRank(a.symbol) - symbolKindRank(b.symbol) ||
    a.symbol.label.localeCompare(b.symbol.label)
  );
}

function symbolKindRank(symbol: FormSymbol): number {
  return symbol.kind === "icon" ? 0 : 1;
}

function scoreSymbolForTokens(symbol: FormSymbol, queryTokens: string[]): number {
  const searchable = searchableTokens(symbol);
  const labelTokens = tokenize(symbol.label);
  const normalizedLabel = normalizeText(symbol.label);
  const searchableTokensList = [...searchable.exact];
  const queryPhrase = queryTokens.join(" ");

  let score = normalizedLabel === queryPhrase ? 12 : 0;
  if (queryPhrase.length > 2 && normalizedLabel.includes(queryPhrase)) score += 5;

  return queryTokens.reduce((sum, token) => {
    if (normalizedLabel === token) return sum + 18;
    if (labelTokens.includes(token)) return sum + 14;
    if (labelTokens.some((candidate) => candidate.startsWith(token))) return sum + 9;
    if (searchable.exact.has(token)) return sum + 6;
    if (searchableTokensList.some((candidate) => candidate.startsWith(token))) {
      return sum + 3;
    }
    if (searchableTokensList.some((candidate) => candidate.includes(token))) return sum + 1;
    return sum;
  }, score);
}

function scoreSuggestion(
  symbol: FormSymbol,
  context: SuggestionContext,
): { score: number; reason: string | null } {
  const searchable = searchableTokens(symbol);
  const labelTokens = tokenize(symbol.label);
  const normalizedLabel = normalizeText(symbol.label);
  let score = 0;
  let reason: string | null = null;

  for (const token of context.primaryTokens) {
    if (labelTokens.includes(token) || normalizedLabel === token) {
      score += 22;
      reason = reason ?? `Matched ${token}`;
    } else if (searchable.exact.has(token)) {
      score += 12;
      reason = reason ?? `Matched ${token}`;
    } else if ([...searchable.exact].some((candidate) => candidate.includes(token))) {
      score += 3;
      reason = reason ?? `Related to ${token}`;
    }
  }

  for (const phrase of context.primaryPhrases) {
    if (phrase === normalizedLabel) {
      score += 16;
      reason = reason ?? `Matched ${normalizedLabel}`;
    } else {
      for (const alias of searchable.aliasPhrases) {
        if (alias.length > 2 && phraseContainsAlias(phrase, alias)) {
          score += 8;
          reason = reason ?? `Matched ${alias}`;
        }
      }
    }
  }

  for (const token of context.fieldTokens) {
    if (labelTokens.includes(token) || normalizedLabel === token) {
      score += 12;
      reason = reason ?? `Matched ${token}`;
    } else if (searchable.exact.has(token)) {
      score += 5;
      reason = reason ?? `Matched ${token}`;
    } else if ([...searchable.exact].some((candidate) => candidate.includes(token))) {
      score += 1;
      reason = reason ?? `Related to ${token}`;
    }
  }

  for (const phrase of context.fieldPhrases) {
    if (phrase === normalizedLabel) {
      score += 12;
      reason = reason ?? `Matched ${normalizedLabel}`;
    } else {
      for (const alias of searchable.aliasPhrases) {
        if (alias.length > 2 && phrase === alias) {
          score += 8;
          reason = reason ?? `Matched ${alias}`;
        } else if (alias.length > 3 && phraseContainsAlias(phrase, alias)) {
          score += 3;
          reason = reason ?? `Matched ${alias}`;
        }
      }
    }
  }

  for (const type of context.fieldTypes) {
    const categories = FIELD_TYPE_CATEGORY[type] ?? [];
    if (categories.includes(symbol.category)) score += 2;
  }

  if (symbol.kind === "emoji" && score > 0) score -= 1;
  return { score, reason };
}

function searchableTokens(symbol: FormSymbol): {
  exact: Set<string>;
  aliasPhrases: string[];
} {
  const aliasPhrases = [
    symbol.label,
    symbol.category,
    ...symbol.keywords,
    ...symbol.aliases,
  ].map(normalizeText);
  return {
    exact: new Set(aliasPhrases.flatMap(tokenize)),
    aliasPhrases: unique(aliasPhrases),
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/wi-fi/g, "wifi").replace(/ssid/g, "network");
}

function phraseContainsAlias(phrase: string, alias: string): boolean {
  if (alias.includes(" ")) return phrase.includes(alias);
  return tokenize(phrase).includes(alias);
}

function tokenize(value: string): string[] {
  return (normalizeText(value).match(WORD_RE) ?? []).filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token),
  );
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
