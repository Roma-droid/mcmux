import path from 'node:path';
import { loadConfig, findTarget, targetKey } from '../lib/config.js';
import { generateTarget } from '../lib/generate.js';

function resolveTargets(config, flags) {
  if (flags.target) {
    const [version, loader] = String(flags.target).split(':');
    const t = findTarget(config, version, loader?.toLowerCase());
    if (!t) throw new Error(`Цель "${flags.target}" не найдена в mcmux.config.json.`);
    return [t];
  }
  if (config.targets.length === 0) {
    throw new Error('В проекте нет целей сборки. Добавьте: mcmux target add <mc_version> <loader>');
  }
  return config.targets;
}

export async function generateCommand({ flags }, cwd = process.cwd()) {
  const config = await loadConfig(cwd);
  const targets = resolveTargets(config, flags);
  const results = [];
  for (const target of targets) {
    const outDir = path.join(cwd, 'build', 'mcmux', targetKey(target));
    const result = await generateTarget(config, target, cwd, outDir);
    results.push(result);
  }
  return {
    message: results
      .map((r) => `Сгенерировано: ${path.relative(cwd, r.outDir)} (${r.files.length} файлов)`)
      .join('\n'),
  };
}

export { resolveTargets };
