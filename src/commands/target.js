import { loadConfig, saveConfig, findTarget, targetKey } from '../lib/config.js';
import { isKnownLoader, suggestJavaVersion } from '../lib/versions.js';

export async function targetCommand({ positional, flags }, cwd = process.cwd()) {
  const [sub, a, b] = positional;
  const config = await loadConfig(cwd);

  if (sub === 'list') {
    if (config.targets.length === 0) return { message: '(целей сборки пока нет)' };
    const lines = config.targets.map(
      (t) =>
        `${targetKey(t)}  java=${t.javaVersion ?? suggestJavaVersion(t.version)}` +
        (t.loaderVersion ? `  loaderVersion=${t.loaderVersion}` : '')
    );
    return { message: lines.join('\n') };
  }

  if (sub === 'add') {
    const version = a;
    const loader = b;
    if (!version || !loader) {
      throw new Error('Использование: mcmux target add <mc_version> <loader> [--java N] [--loader-version V] [--yarn V] [--fabric-api V]');
    }
    const loweredLoader = loader.toLowerCase();
    if (!isKnownLoader(loweredLoader)) {
      throw new Error(`Неизвестный loader "${loader}".`);
    }
    if (!config.loaders.includes(loweredLoader)) {
      throw new Error(
        `Loader "${loweredLoader}" ещё не добавлен в проект. Сначала: mcmux loader add ${loweredLoader}`
      );
    }
    if (findTarget(config, version, loweredLoader)) {
      throw new Error(`Цель ${version}-${loweredLoader} уже существует.`);
    }

    const target = {
      version,
      loader: loweredLoader,
      javaVersion: flags.java ? Number(flags.java) : undefined,
      loaderVersion: flags['loader-version'],
      vars: {},
    };
    if (loweredLoader === 'fabric') {
      if (flags.yarn) target.vars.yarnMappings = flags.yarn;
      if (flags['fabric-api']) target.vars.fabricApiVersion = flags['fabric-api'];
    }
    config.targets.push(target);
    await saveConfig(config, cwd);
    return {
      message:
        `Добавлена цель ${version}-${loweredLoader}.\n` +
        (flags['loader-version'] ? '' : `Не забудьте указать актуальную версию загрузчика: mcmux target add ${version} ${loweredLoader} --loader-version <версия> (или отредактируйте mcmux.config.json).\n`) +
        `Сгенерировать проект: mcmux generate --target ${version}:${loweredLoader}`,
    };
  }

  if (sub === 'remove') {
    const version = a;
    const loader = b?.toLowerCase();
    const idx = config.targets.findIndex((t) => t.version === version && t.loader === loader);
    if (idx === -1) throw new Error(`Цель ${version}-${loader} не найдена.`);
    config.targets.splice(idx, 1);
    await saveConfig(config, cwd);
    return { message: `Удалена цель ${version}-${loader}.` };
  }

  throw new Error('Использование: mcmux target <add|list|remove> ...');
}
