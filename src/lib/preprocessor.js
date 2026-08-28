// A tiny, dependency-free "write once, build for many versions/loaders" source
// preprocessor, inspired by Stonecutter's comment-directive approach.
//
// Syntax (works in any file where the comment style is `//`, e.g. .java, .kts):
//
//   //? if <predicate> {
//   ...code kept when predicate is true...
//   //?} else if <predicate> {
//   ...
//   //?} else {
//   ...
//   //?}
//
// Predicate tokens (space-separated == AND, prefix `!` == NOT):
//   fabric | forge | neoforge | quilt        -> matches build.loader
//   1.20.1 | ==1.20.1                        -> version equals
//   >=1.20  <1.21  >1.19.1  <=1.20.4         -> version comparison
//
// Directive lines are always stripped from the output; only the chosen
// branch's body lines are kept, uncommented, exactly as written.

import { compareVersions, KNOWN_LOADERS } from './versions.js';

const IF_RE = /^\/\/\?\s*if\s+(.+?)\s*\{\s*$/;
const ELSE_IF_RE = /^\/\/\?\}\s*else\s+if\s+(.+?)\s*\{\s*$/;
const ELSE_RE = /^\/\/\?\}\s*else\s*\{\s*$/;
const END_RE = /^\/\/\?\}\s*$/;

export class PreprocessorSyntaxError extends Error {}

function evalToken(token, context) {
  if (token.startsWith('!')) {
    return !evalToken(token.slice(1), context);
  }
  const lower = token.toLowerCase();
  if (KNOWN_LOADERS.includes(lower)) {
    return String(context.loader).toLowerCase() === lower;
  }
  const m = token.match(/^(>=|<=|==|>|<)?(.+)$/);
  if (!m) throw new PreprocessorSyntaxError(`Bad predicate token: ${token}`);
  const op = m[1] || '==';
  const ver = m[2];
  const cmp = compareVersions(context.version, ver);
  switch (op) {
    case '>=':
      return cmp >= 0;
    case '<=':
      return cmp <= 0;
    case '>':
      return cmp > 0;
    case '<':
      return cmp < 0;
    case '==':
      return cmp === 0;
    default:
      throw new PreprocessorSyntaxError(`Bad predicate operator: ${op}`);
  }
}

export function evaluatePredicate(predicate, context) {
  const tokens = predicate.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new PreprocessorSyntaxError('Empty predicate');
  return tokens.every((t) => evalToken(t, context));
}

/**
 * @param {string} source
 * @param {{version: string, loader: string}} context
 * @param {string} [fileLabel] used only for error messages
 */
export function preprocess(source, context, fileLabel = '<source>') {
  const lines = source.split('\n');
  const out = [];
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const ifMatch = trimmed.match(IF_RE);
    const elseIfMatch = trimmed.match(ELSE_IF_RE);
    const elseMatch = trimmed.match(ELSE_RE);
    const endMatch = trimmed.match(END_RE);

    if (ifMatch) {
      const parentActive = stack.length === 0 || stack[stack.length - 1].active;
      const cond = parentActive && evaluatePredicate(ifMatch[1], context);
      stack.push({ active: cond, taken: cond, parentActive });
      continue;
    }
    if (elseIfMatch) {
      if (stack.length === 0) {
        throw new PreprocessorSyntaxError(`${fileLabel}:${i + 1}: 'else if' without matching 'if'`);
      }
      const top = stack[stack.length - 1];
      const cond = top.parentActive && !top.taken && evaluatePredicate(elseIfMatch[1], context);
      top.active = cond;
      if (cond) top.taken = true;
      continue;
    }
    if (elseMatch) {
      if (stack.length === 0) {
        throw new PreprocessorSyntaxError(`${fileLabel}:${i + 1}: 'else' without matching 'if'`);
      }
      const top = stack[stack.length - 1];
      const cond = top.parentActive && !top.taken;
      top.active = cond;
      if (cond) top.taken = true;
      continue;
    }
    if (endMatch) {
      if (stack.length === 0) {
        throw new PreprocessorSyntaxError(`${fileLabel}:${i + 1}: unmatched '//?}'`);
      }
      stack.pop();
      continue;
    }

    const active = stack.length === 0 || stack[stack.length - 1].active;
    if (active) out.push(line);
  }

  if (stack.length !== 0) {
    throw new PreprocessorSyntaxError(`${fileLabel}: unterminated '//? if' block(s)`);
  }

  return out.join('\n');
}
