import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Recursively list all regular files under `dir`, returned as paths relative
 * to `dir` (posix-style separators, so they render consistently regardless
 * of host OS).
 */
export async function listFilesRecursive(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Node's recursive readdir gives entry.path/entry.parentPath as the
    // absolute directory containing the entry, depending on version.
    const parentDir = entry.parentPath ?? entry.path;
    const abs = path.join(parentDir, entry.name);
    const rel = path.relative(dir, abs).split(path.sep).join('/');
    files.push(rel);
  }
  return files.sort();
}

export async function readTemplateFile(dir, relPath) {
  return readFile(path.join(dir, relPath), 'utf8');
}
