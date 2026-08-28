import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, suggestJavaVersion, isKnownLoader } from '../src/lib/versions.js';

test('compareVersions basic ordering', () => {
  assert.equal(compareVersions('1.19.1', '1.20'), -1);
  assert.equal(compareVersions('1.20', '1.19.1'), 1);
  assert.equal(compareVersions('1.20.1', '1.20.1'), 0);
  assert.equal(compareVersions('1.20', '1.20.0'), 0);
});

test('suggestJavaVersion picks sane defaults', () => {
  assert.equal(suggestJavaVersion('1.19.1'), 17);
  assert.equal(suggestJavaVersion('1.20.1'), 17);
  assert.equal(suggestJavaVersion('1.21'), 21);
});

test('isKnownLoader', () => {
  assert.equal(isKnownLoader('Fabric'), true);
  assert.equal(isKnownLoader('sponge'), false);
});
