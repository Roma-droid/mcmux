import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { initCommand } from '../src/commands/init.js';
import { loaderCommand } from '../src/commands/loader.js';
import { targetCommand } from '../src/commands/target.js';
import { generateCommand } from '../src/commands/generate.js';
import { hasUnresolvedPlaceholders } from '../src/lib/render.js';

async function withTempProject(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcmux-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('init + loader add + target add + generate produces a clean fabric project', async () => {
  await withTempProject(async (dir) => {
    await initCommand(
      { positional: ['examplemod'], flags: { package: 'com.example.examplemod', loaders: 'fabric' } },
      dir
    );
    await targetCommand(
      {
        positional: ['add', '1.19.1', 'fabric'],
        flags: { 'loader-version': '0.14.21', yarn: '1.19.1+build.3', 'fabric-api': '0.58.0+1.19.1' },
      },
      dir
    );
    const { message } = await generateCommand({ flags: { target: '1.19.1:fabric' } }, dir);
    assert.match(message, /Сгенерировано/);

    const outDir = path.join(dir, 'build', 'mcmux', '1.19.1-fabric');

    const modEntry = await readFile(
      path.join(outDir, 'src/main/java/com/example/examplemod/Examplemod.java'),
      'utf8'
    );
    assert.equal(hasUnresolvedPlaceholders(modEntry), false);
    assert.match(modEntry, /public static final String MOD_ID = "examplemod";/);
    // The >=1.20 example block must be stripped out for a 1.19.1 target.
    assert.ok(!modEntry.includes('Example of version-gated code'));

    const fabricEntry = await readFile(
      path.join(outDir, 'src/main/java/com/example/examplemod/fabric/FabricModEntry.java'),
      'utf8'
    );
    assert.match(fabricEntry, /implements ModInitializer/);
    assert.match(fabricEntry, /Examplemod\.init\(\);/);

    const services = await readFile(
      path.join(
        outDir,
        'src/main/resources/META-INF/services/com.example.examplemod.platform.IPlatformHelper'
      ),
      'utf8'
    );
    assert.equal(services.trim(), 'com.example.examplemod.platform.FabricPlatformHelper');

    const buildGradle = await readFile(path.join(outDir, 'build.gradle.kts'), 'utf8');
    assert.equal(hasUnresolvedPlaceholders(buildGradle), false);
    assert.match(buildGradle, /minecraft\("com\.mojang:minecraft:1\.19\.1"\)/);
    assert.match(buildGradle, /yarn:1\.19\.1\+build\.3:v2/);

    const settings = await readFile(path.join(outDir, 'settings.gradle.kts'), 'utf8');
    assert.match(settings, /rootProject\.name = "examplemod-1\.19\.1-fabric"/);
  });
});

test('generating the same target for two different mc versions changes version-gated code', async () => {
  await withTempProject(async (dir) => {
    await initCommand(
      { positional: ['examplemod'], flags: { package: 'com.example.examplemod', loaders: 'fabric' } },
      dir
    );
    await targetCommand(
      { positional: ['add', '1.19.1', 'fabric'], flags: { 'loader-version': '0.14.21' } },
      dir
    );
    await targetCommand(
      { positional: ['add', '1.20.1', 'fabric'], flags: { 'loader-version': '0.15.0' } },
      dir
    );
    await generateCommand({ flags: {} }, dir);

    const old = await readFile(
      path.join(dir, 'build/mcmux/1.19.1-fabric/src/main/java/com/example/examplemod/Examplemod.java'),
      'utf8'
    );
    const modern = await readFile(
      path.join(dir, 'build/mcmux/1.20.1-fabric/src/main/java/com/example/examplemod/Examplemod.java'),
      'utf8'
    );
    assert.ok(!old.includes('Example of version-gated code'));
    assert.ok(modern.includes('Example of version-gated code'));
  });
});

test('loader add fails for unknown loader, succeeds for a real one', async () => {
  await withTempProject(async (dir) => {
    await initCommand({ positional: ['examplemod'], flags: { loaders: 'fabric' } }, dir);
    await assert.rejects(() => loaderCommand({ positional: ['add', 'bogus'] }, dir));
    const { message } = await loaderCommand({ positional: ['add', 'forge'] }, dir);
    assert.match(message, /Добавлен loader "forge"/);

    const forgeEntry = await readFile(
      path.join(dir, 'forge/src/main/java/com/example/examplemod/forge/ForgeModEntry.java'),
      'utf8'
    );
    assert.match(forgeEntry, /@Mod\(Examplemod\.MOD_ID\)/);
  });
});
