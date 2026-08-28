import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig, saveConfig } from '../lib/config.js';
import { isKnownLoader, KNOWN_LOADERS } from '../lib/versions.js';
import { materializeLayer, loaderLayerDir } from '../lib/generate.js';

export async function loaderCommand({ positional }, cwd = process.cwd()) {
  const [sub, loader] = positional;
  const config = await loadConfig(cwd);

  if (sub === 'list') {
    return { message: config.loaders.join(', ') || '(нет)' };
  }

  if (sub === 'add') {
    if (!loader) throw new Error('Использование: mcmux loader add <fabric|forge|neoforge|quilt>');
    const lower = loader.toLowerCase();
    if (!isKnownLoader(lower)) {
      throw new Error(`Неизвестный loader "${loader}". Поддерживаются: ${KNOWN_LOADERS.join(', ')}`);
    }
    if (config.loaders.includes(lower)) {
      throw new Error(`Loader "${lower}" уже добавлен в проект.`);
    }
    const destDir = path.join(cwd, lower);
    if (existsSync(destDir)) {
      throw new Error(`Директория ${lower}/ уже существует -- удалите её вручную, если хотите пересоздать.`);
    }
    await materializeLayer(loaderLayerDir(lower), destDir, config);
    config.loaders.push(lower);
    await saveConfig(config, cwd);
    return {
      message:
        `Добавлен loader "${lower}" (директория ${lower}/).\n` +
        `Портируйте туда специфичный для загрузчика код (регистрация через API ${lower}), опираясь\n` +
        'на common/ и уже существующие модули как на образец.\n' +
        `Затем: mcmux target add <mc_version> ${lower}`,
    };
  }

  throw new Error('Использование: mcmux loader <add|list> [loader]');
}
