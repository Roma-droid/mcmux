import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig, targetKey } from '../lib/config.js';
import { generateTarget } from '../lib/generate.js';
import { resolveTargets } from './generate.js';

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${cmd} ${args.join(' ')}" завершился с кодом ${code}`));
    });
  });
}

export async function buildCommand({ flags }, cwd = process.cwd()) {
  const config = await loadConfig(cwd);
  const targets = resolveTargets(config, flags);
  const gradleCmd = flags['gradle-cmd'] || config.gradleCommand || 'gradle';

  const summary = [];
  for (const target of targets) {
    const outDir = path.join(cwd, 'build', 'mcmux', targetKey(target));
    await generateTarget(config, target, cwd, outDir);
    if (flags['generate-only']) {
      summary.push(`${targetKey(target)}: сгенерирован в ${path.relative(cwd, outDir)} (сборка пропущена, --generate-only)`);
      continue;
    }
    await run(gradleCmd, ['build'], outDir);
    summary.push(`${targetKey(target)}: build OK (${path.relative(cwd, outDir)})`);
  }
  return { message: summary.join('\n') };
}
