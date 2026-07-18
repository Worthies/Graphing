import * as assert from 'assert';
import { normalizeLocale } from '../../src/node/extension';

describe('normalizeLocale', () => {
  it('maps zh-cn to zh-CN', () => {
    assert.strictEqual(normalizeLocale('zh-cn'), 'zh-CN');
  });
  it('maps zh-hans to zh-CN', () => {
    assert.strictEqual(normalizeLocale('zh-hans'), 'zh-CN');
  });
  it('keeps en', () => {
    assert.strictEqual(normalizeLocale('en'), 'en');
  });
  it('falls back to en for unsupported or empty values', () => {
    assert.strictEqual(normalizeLocale('de'), 'en');
    assert.strictEqual(normalizeLocale('zh-tw'), 'en');
    assert.strictEqual(normalizeLocale(undefined), 'en');
    assert.strictEqual(normalizeLocale(''), 'en');
  });
});
