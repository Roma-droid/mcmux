import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTemplate,
  renderTemplatePartial,
  hasUnresolvedPlaceholders,
  expandPathPlaceholders,
  templateVars,
} from '../src/lib/render.js';

test('renderTemplate substitutes all known vars', () => {
  assert.equal(renderTemplate('pkg {{package}};', { package: 'com.example' }), 'pkg com.example;');
});

test('renderTemplate throws on missing var', () => {
  assert.throws(() => renderTemplate('{{missing}}', {}));
});

test('renderTemplatePartial leaves unknown vars untouched', () => {
  const out = renderTemplatePartial('{{modId}} {{version}}', { modId: 'foo' });
  assert.equal(out, 'foo {{version}}');
});

test('hasUnresolvedPlaceholders', () => {
  assert.equal(hasUnresolvedPlaceholders('foo {{bar}}'), true);
  assert.equal(hasUnresolvedPlaceholders('foo bar'), false);
});

test('expandPathPlaceholders expands package + class markers', () => {
  const out = expandPathPlaceholders('src/__PKG__/__MODCLASS__.java.tmpl', {
    package: 'com.example.mod',
    ModClass: 'ExampleMod',
  });
  assert.equal(out, 'src/com/example/mod/ExampleMod.java.tmpl');
});

test('templateVars derives PascalCase ModClass from modId', () => {
  const vars = templateVars({ modId: 'example_mod', package: 'com.example' });
  assert.equal(vars.ModClass, 'ExampleMod');
});
