import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTheme, themeStorageKey, normalizeThemePreference } from '../src/themeCore.ts'

test('explicit theme overrides the operating system preference', () => {
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('light', false), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
  assert.equal(resolveTheme('dark', true), 'dark')
})

test('automatic theme follows the operating system', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
})

test('invalid stored theme is normalized and storage is isolated by user', () => {
  for (const value of ['sepia', '', 'DARK', null, undefined]) {
    assert.equal(normalizeThemePreference(value), 'system')
  }
  for (const value of ['light', 'dark', 'system']) {
    assert.equal(normalizeThemePreference(value), value)
  }
  assert.equal(themeStorageKey('user-123'), 'meu-fluxo:theme:user-123')
  assert.equal(themeStorageKey('user-456'), 'meu-fluxo:theme:user-456')
  assert.notEqual(themeStorageKey('user-123'), themeStorageKey('user-456'))
})
