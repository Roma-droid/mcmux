import { parseArgs } from './lib/args.js';
import { initCommand } from './commands/init.js';
import { loaderCommand } from './commands/loader.js';
import { targetCommand } from './commands/target.js';
import { generateCommand } from './commands/generate.js';
import { buildCommand } from './commands/build.js';
import { doctorCommand } from './commands/doctor.js';
import { migrateCommand } from './commands/migrate.js';

const HELP = `mcmux -- пиши мод один раз, собирай под разные загрузчики и версии Minecraft.

Использование:
  mcmux init <modId> [--name "..."] [--package com.example.mod] [--loaders fabric,forge]
  mcmux loader add <fabric|forge|neoforge|quilt>
  mcmux loader list
  mcmux target add <mc_version> <loader> [--java N] [--loader-version V] [--yarn V] [--fabric-api V]
  mcmux target list
  mcmux target remove <mc_version> <loader>
  mcmux generate [--target <mc_version>:<loader>]
  mcmux build [--target <mc_version>:<loader>] [--gradle-cmd gradle] [--generate-only]
  mcmux migrate <путь_к_src> [--out MIGRATION_TODO.md]
  mcmux doctor
  mcmux help

Пример:
  mcmux init examplemod --package com.example.examplemod --loaders fabric,forge
  mcmux target add 1.19.1 fabric --loader-version 0.14.21 --yarn 1.19.1+build.3 --fabric-api 0.58.0+1.19.1
  mcmux target add 1.20.1 forge --loader-version 47.2.0
  mcmux doctor
  mcmux build --target 1.19.1:fabric
`;

const COMMANDS = {
  init: initCommand,
  loader: loaderCommand,
  target: targetCommand,
  generate: generateCommand,
  build: buildCommand,
  migrate: migrateCommand,
  doctor: doctorCommand,
};

export async function main(argv, cwd = process.cwd()) {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Неизвестная команда: ${command}\n`);
    console.log(HELP);
    return 1;
  }

  const parsed = parseArgs(rest);
  try {
    const result = await handler(parsed, cwd);
    if (result?.message) console.log(result.message);
    if (result?.ok === false) return 1;
    return 0;
  } catch (err) {
    console.error(`Ошибка: ${err.message}`);
    return 1;
  }
}
