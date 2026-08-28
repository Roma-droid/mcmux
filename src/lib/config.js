import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

export const CONFIG_FILENAME = 'mcmux.config.json';

export function configPath(cwd = process.cwd()) {
  return path.join(cwd, CONFIG_FILENAME);
}

export function findConfig(cwd = process.cwd()) {
  const p = configPath(cwd);
  return existsSync(p) ? p : null;
}

export async function loadConfig(cwd = process.cwd()) {
  const p = findConfig(cwd);
  if (!p) {
    throw new Error(
      `Не найден ${CONFIG_FILENAME} в ${cwd}. Запустите "mcmux init" в корне проекта.`
    );
  }
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw);
}

export async function saveConfig(config, cwd = process.cwd()) {
  const p = configPath(cwd);
  await writeFile(p, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return p;
}

export function targetKey(target) {
  return `${target.version}-${target.loader}`;
}

export function findTarget(config, version, loader) {
  return config.targets.find((t) => t.version === version && t.loader === loader);
}

export function validateConfig(config) {
  const errors = [];
  if (!config.modId || !/^[a-z][a-z0-9_]*$/.test(config.modId)) {
    errors.push('modId должен состоять из строчных латинских букв, цифр и "_", начинаться с буквы.');
  }
  if (!config.package || !/^[a-z][a-z0-9_.]*$/.test(config.package)) {
    errors.push('package должен быть валидным java-пакетом в нижнем регистре.');
  }
  if (!Array.isArray(config.loaders) || config.loaders.length === 0) {
    errors.push('loaders должен быть непустым массивом.');
  }
  if (!Array.isArray(config.targets)) {
    errors.push('targets должен быть массивом.');
  }
  return errors;
}
