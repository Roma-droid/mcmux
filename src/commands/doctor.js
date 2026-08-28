import { spawnSync } from 'node:child_process';
import { findConfig, loadConfig, validateConfig, targetKey } from '../lib/config.js';

function checkCommand(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.error) return null;
  return (res.stdout || res.stderr || '').split('\n')[0].trim();
}

export async function doctorCommand(_args, cwd = process.cwd()) {
  const lines = [];
  let ok = true;

  const javaVersion = checkCommand('java', ['-version']);
  if (javaVersion) lines.push(`[ok] java найден: ${javaVersion}`);
  else {
    lines.push('[!!] java не найден в PATH -- нужен JDK для сборки любого таргета.');
    ok = false;
  }

  const configFile = findConfig(cwd);
  if (!configFile) {
    lines.push(`[!!] ${'mcmux.config.json'} не найден -- запустите "mcmux init".`);
    return { message: lines.join('\n'), ok: false };
  }
  lines.push(`[ok] найден mcmux.config.json`);

  const config = await loadConfig(cwd);
  const errors = validateConfig(config);
  if (errors.length) {
    ok = false;
    for (const e of errors) lines.push(`[!!] config: ${e}`);
  } else {
    lines.push('[ok] mcmux.config.json валиден');
  }

  const gradleCmd = config.gradleCommand || 'gradle';
  const gradleVersion = checkCommand(gradleCmd, ['-v']);
  if (gradleVersion) lines.push(`[ok] "${gradleCmd}" найден`);
  else {
    lines.push(`[!!] команда "${gradleCmd}" не найдена в PATH -- "mcmux build" не сможет запустить сборку (generate всё равно будет работать).`);
    ok = false;
  }

  if (!config.targets || config.targets.length === 0) {
    lines.push('[!!] в проекте нет ни одной цели сборки (mcmux target add ...)');
    ok = false;
  } else {
    for (const t of config.targets) {
      const placeholders = [];
      if (!t.loaderVersion || t.loaderVersion === '<FILL_IN>') placeholders.push('loaderVersion');
      if (t.loader === 'fabric') {
        if (t.vars?.yarnMappings === '<FILL_IN>' || !t.vars?.yarnMappings) placeholders.push('yarnMappings');
        if (t.vars?.fabricApiVersion === '<FILL_IN>' || !t.vars?.fabricApiVersion) placeholders.push('fabricApiVersion');
      }
      if (placeholders.length) {
        lines.push(`[!!] цель ${targetKey(t)}: не заполнены поля: ${placeholders.join(', ')} (см. docs/VERSIONS.md)`);
        ok = false;
      } else {
        lines.push(`[ok] цель ${targetKey(t)} настроена`);
      }
    }
  }

  return { message: lines.join('\n'), ok };
}
