/**
 * Webview i18n. Synchronous init: all locale resources are bundled,
 * so there is no async load gap and no English flash.
 */
import i18next from 'i18next';
import en from './locales/en';
import zhCN from './locales/zh-CN';

const BUNDLED_LOCALES = ['en', 'zh-CN'];

// Map VS Code language tags (lowercased) to bundled locale ids.
const LOCALE_MAP: Record<string, string> = {
  'en': 'en',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN'
};

export function negotiateLocale(raw: string | undefined | null): string {
  if (!raw) return 'en';
  const tag = raw.toLowerCase();
  if (LOCALE_MAP[tag]) return LOCALE_MAP[tag];
  const primary = tag.split('-')[0];
  if (LOCALE_MAP[primary]) return LOCALE_MAP[primary];
  return 'en';
}

export function initI18n(locale?: string): void {
  const lng = negotiateLocale(locale);
  i18next.init({
    lng,
    fallbackLng: 'en',
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN }
    }
  });
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options) as string;
}

export { BUNDLED_LOCALES };
