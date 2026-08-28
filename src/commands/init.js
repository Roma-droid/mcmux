import path from 'node:path';
import { findConfig, saveConfig, validateConfig } from '../lib/config.js';
import { isKnownLoader, KNOWN_LOADERS } from '../lib/versions.js';
import { materializeLayer, commonLayerDir, loaderLayerDir } from '../lib/generate.js';

export async function initCommand({ positional, flags }, cwd = process.cwd()) {
  const modId = positional[0];
  if (!modId) {
    throw new Error(
      'Использование: mcmux init <modId> [--name "..."] [--package com.example.mod] [--loaders fabric,forge]'
    );
  }
  if (findConfig(cwd)) {
    throw new Error('mcmux.config.json уже существует в этой директории.');
  }

  const loaders = String(flags.loaders || 'fabric,forge')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  for (const loader of loaders) {
    if (!isKnownLoader(loader)) {
      throw new Error(`Неизвестный loader "${loader}". Поддерживаются: ${KNOWN_LOADERS.join(', ')}`);
    }
  }

  const config = {
    modId,
    modName: flags.name || modId,
    modVersion: flags['mod-version'] || '0.1.0',
    package: flags.package || `com.example.${modId}`,
    loaders,
    gradleCommand: flags['gradle-cmd'] || 'gradle',
    targets: [],
  };

  const errors = validateConfig(config);
  if (errors.length) {
    throw new Error('Некорректная конфигурация:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  }

  await materializeLayer(commonLayerDir(), path.join(cwd, 'common'), config);
  for (const loader of loaders) {
    await materializeLayer(loaderLayerDir(loader), path.join(cwd, loader), config);
  }

  const p = await saveConfig(config, cwd);
  return {
    message:
      `Создан ${p}\n` +
      `Сгенерированы исходники: common/, ${loaders.join('/, ')}/\n` +
      `Мод ID: ${config.modId}\n` +
      `Пакет: ${config.package}\n` +
      `Loaders: ${loaders.join(', ')}\n\n` +
      'Общую логику мода пишите в common/, специфичную для загрузчика -- в\n' +
      'соответствующей папке (fabric/, forge/, ...). Файлы с расширением .tmpl\n' +
      'ещё содержат {{плейсхолдеры}}, которые заполняются под конкретную версию\n' +
      'при generate/build (см. build.gradle.kts.tmpl -- версию Minecraft, Forge/\n' +
      'Fabric и т.д. нужно один раз указать через "mcmux target add").\n\n' +
      'Дальше: добавьте цели сборки командой\n' +
      '  mcmux target add <mc_version> <loader>\n' +
      'например:\n' +
      '  mcmux target add 1.19.1 fabric\n' +
      '  mcmux target add 1.20.1 forge',
  };
}
