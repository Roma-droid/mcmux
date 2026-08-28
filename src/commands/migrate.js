import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { listFilesRecursive, readTemplateFile } from '../lib/templates.js';

// Import-prefix heuristics for classifying existing source files. This is a
// *reporting* tool, not an automatic translator: Forge and Fabric APIs
// differ enough (registries, events, networking) that turning one into the
// other reliably needs a human decision per call site. What this command
// gives you is a triage report: which files are loader-agnostic already
// (safe to move into common/ as-is) vs which ones call loader-specific APIs
// and need a hand-ported equivalent in each target loader's module.
const LOADER_IMPORT_PREFIXES = {
  fabric: ['net.fabricmc.'],
  forge: ['net.minecraftforge.'],
  neoforge: ['net.neoforged.'],
  quilt: ['org.quiltmc.'],
};

function classify(content) {
  const hits = {};
  for (const [loader, prefixes] of Object.entries(LOADER_IMPORT_PREFIXES)) {
    for (const prefix of prefixes) {
      if (content.includes(`import ${prefix}`)) {
        hits[loader] = (hits[loader] || 0) + (content.match(new RegExp(`import ${prefix.replace('.', '\\.')}`, 'g')) || []).length;
      }
    }
  }
  return hits;
}

export async function migrateCommand({ positional, flags }, cwd = process.cwd()) {
  const scanDir = path.resolve(cwd, positional[0] || flags.scan || 'src');
  const files = (await listFilesRecursive(scanDir)).filter((f) => f.endsWith('.java'));
  if (files.length === 0) {
    return { message: `Не найдено .java файлов в ${scanDir}. Использование: mcmux migrate <путь_к_src> [--out MIGRATION_TODO.md]` };
  }

  const agnostic = [];
  const perLoader = {};

  for (const rel of files) {
    const content = await readTemplateFile(scanDir, rel);
    const hits = classify(content);
    const loaders = Object.keys(hits);
    if (loaders.length === 0) {
      agnostic.push(rel);
    } else {
      for (const loader of loaders) {
        (perLoader[loader] ||= []).push({ file: rel, imports: hits[loader] });
      }
    }
  }

  const reportLines = [];
  reportLines.push(`# Отчёт миграции mcmux`);
  reportLines.push('');
  reportLines.push(`Просканировано: ${scanDir}`);
  reportLines.push(`Всего .java файлов: ${files.length}`);
  reportLines.push('');
  reportLines.push(`## Не зависят от загрузчика (${agnostic.length})`);
  reportLines.push('Эти файлы не импортируют ни один известный loader-specific пакет -- скорее всего,');
  reportLines.push('их можно переместить в common/ как есть (проверьте вручную).');
  reportLines.push('');
  for (const f of agnostic) reportLines.push(`- ${f}`);
  reportLines.push('');

  for (const [loader, list] of Object.entries(perLoader)) {
    reportLines.push(`## Зависят от ${loader} (${list.length})`);
    reportLines.push(`Импортируют ${loader}-специфичные пакеты -- логику нужно перенести в ${loader}/`);
    reportLines.push(`и написать аналог для остальных загрузчиков через IPlatformHelper / отдельный entrypoint.`);
    reportLines.push('');
    for (const { file, imports } of list) reportLines.push(`- ${file} (${imports} импортов)`);
    reportLines.push('');
  }

  const outFile = path.resolve(cwd, flags.out || 'MIGRATION_TODO.md');
  await writeFile(outFile, reportLines.join('\n') + '\n', 'utf8');

  return {
    message:
      `Проанализировано ${files.length} файлов.\n` +
      `Без привязки к загрузчику: ${agnostic.length}\n` +
      Object.entries(perLoader)
        .map(([loader, list]) => `Зависят от ${loader}: ${list.length}`)
        .join('\n') +
      `\n\nОтчёт записан в ${path.relative(cwd, outFile)}`,
  };
}
