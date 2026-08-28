import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preprocess, evaluatePredicate, PreprocessorSyntaxError } from '../src/lib/preprocessor.js';

test('simple if true keeps body', () => {
  const src = ['//? if >=1.20 {', 'kept', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'kept');
});

test('simple if false drops body', () => {
  const src = ['//? if >=1.20 {', 'kept', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.19.1', loader: 'fabric' }), '');
});

test('if/else picks the right branch', () => {
  const src = ['//? if >=1.20 {', 'new', '//?} else {', 'old', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.19.1', loader: 'fabric' }), 'old');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'new');
});

test('if/else-if/else chain', () => {
  const src = [
    '//? if 1.19.1 {',
    'a',
    '//?} else if 1.20.1 {',
    'b',
    '//?} else {',
    'c',
    '//?}',
  ].join('\n');
  assert.equal(preprocess(src, { version: '1.19.1', loader: 'fabric' }), 'a');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'b');
  assert.equal(preprocess(src, { version: '1.21', loader: 'fabric' }), 'c');
});

test('loader predicate', () => {
  const src = ['//? if fabric {', 'fabric-only', '//?} else {', 'other', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'fabric-only');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'forge' }), 'other');
});

test('combined AND predicate (space separated)', () => {
  const src = ['//? if fabric >=1.20 {', 'match', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'match');
  assert.equal(preprocess(src, { version: '1.19.1', loader: 'fabric' }), '');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'forge' }), '');
});

test('negation', () => {
  const src = ['//? if !forge {', 'not-forge', '//?}'].join('\n');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'fabric' }), 'not-forge');
  assert.equal(preprocess(src, { version: '1.20.1', loader: 'forge' }), '');
});

test('nested blocks', () => {
  const src = [
    '//? if >=1.19 {',
    'outer',
    '//? if fabric {',
    'inner-fabric',
    '//?} else {',
    'inner-other',
    '//?}',
    '//?}',
  ].join('\n');
  assert.equal(
    preprocess(src, { version: '1.20.1', loader: 'fabric' }),
    ['outer', 'inner-fabric'].join('\n')
  );
  assert.equal(
    preprocess(src, { version: '1.20.1', loader: 'forge' }),
    ['outer', 'inner-other'].join('\n')
  );
  assert.equal(preprocess(src, { version: '1.18', loader: 'fabric' }), '');
});

test('unterminated block throws', () => {
  const src = ['//? if fabric {', 'x'].join('\n');
  assert.throws(() => preprocess(src, { version: '1.20.1', loader: 'fabric' }), PreprocessorSyntaxError);
});

test('unmatched end throws', () => {
  const src = ['//?}'].join('\n');
  assert.throws(() => preprocess(src, { version: '1.20.1', loader: 'fabric' }), PreprocessorSyntaxError);
});

test('evaluatePredicate operators', () => {
  const ctx = { version: '1.20.1', loader: 'fabric' };
  assert.equal(evaluatePredicate('>=1.20', ctx), true);
  assert.equal(evaluatePredicate('>1.20.1', ctx), false);
  assert.equal(evaluatePredicate('<=1.20.1', ctx), true);
  assert.equal(evaluatePredicate('<1.20', ctx), false);
  assert.equal(evaluatePredicate('==1.20.1', ctx), true);
  assert.equal(evaluatePredicate('1.20.1', ctx), true);
});
