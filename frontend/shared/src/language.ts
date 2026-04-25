import type { UIlang } from './types.js';

export const SAFESEND_LANGUAGE_KEY = 'safesend-language';
export const DEFAULT_LANGUAGE: UIlang = 'bm';

export function getStoredLanguage(): UIlang {
  if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE;
  const value = localStorage.getItem(SAFESEND_LANGUAGE_KEY);
  return value === 'en' || value === 'bm' ? value : DEFAULT_LANGUAGE;
}

export function setStoredLanguage(language: UIlang): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAFESEND_LANGUAGE_KEY, language);
}
