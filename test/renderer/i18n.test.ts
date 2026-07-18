import * as assert from 'assert';
import { initI18n, t, negotiateLocale } from '../../src/renderer/i18n';
import en from '../../src/renderer/i18n/locales/en';
import zhCN from '../../src/renderer/i18n/locales/zh-CN';

function flattenKeys(obj: any, prefix: string[] = []): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object') {
      keys.push(...flattenKeys(v, [...prefix, k]));
    } else {
      keys.push([...prefix, k].join('.'));
    }
  }
  return keys.sort();
}

describe('i18n', () => {
  describe('negotiateLocale', () => {
    it('maps zh-cn to zh-CN', () => {
      assert.strictEqual(negotiateLocale('zh-cn'), 'zh-CN');
    });
    it('keeps en', () => {
      assert.strictEqual(negotiateLocale('en'), 'en');
    });
    it('falls back to en for unsupported languages', () => {
      assert.strictEqual(negotiateLocale('de'), 'en');
      assert.strictEqual(negotiateLocale('zh-tw'), 'en');
      assert.strictEqual(negotiateLocale(undefined), 'en');
      assert.strictEqual(negotiateLocale(''), 'en');
    });
  });

  describe('locale parity', () => {
    it('zh-CN has exactly the same key set as en', () => {
      assert.deepStrictEqual(flattenKeys(zhCN), flattenKeys(en));
    });
  });

  describe('t()', () => {
    it('returns interpolated English by default', () => {
      initI18n('en');
      assert.strictEqual(t('toolbar.modes.select', { shortcut: 'V' }), 'Select (V)');
    });
    it('returns interpolated Chinese for zh-CN', () => {
      initI18n('zh-CN');
      assert.strictEqual(t('toolbar.modes.select', { shortcut: 'V' }), '选择 (V)');
    });
    it('interpolates error detail', () => {
      initI18n('zh-CN');
      assert.strictEqual(t('errors.svgParseError', { detail: 'boom' }), 'SVG 解析错误：boom');
    });
    it('falls back to en for an unknown injected locale', () => {
      initI18n('fr');
      assert.strictEqual(t('toolbar.modes.select', { shortcut: 'V' }), 'Select (V)');
    });
  });
});
