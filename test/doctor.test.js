import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkCommand } from '../src/commands/doctor.js';

// Regression test for a real bug: `gradle -v` prints a *blank* first line
// before its banner. The old implementation treated "first line of output"
// as the truth signal for "command exists", so a blank first line was
// misreported as "command not found" even though the command ran fine.
test('checkCommand treats a successful command with a blank first output line as ok', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcmux-doctor-test-'));
  try {
    const script = path.join(dir, 'fake-gradle.sh');
    await writeFile(script, '#!/bin/sh\necho ""\necho "------"\necho "Gradle 9.7.0"\n', 'utf8');
    await chmod(script, 0o755);

    const result = checkCommand(script, ['-v']);
    assert.equal(result.ok, true);
    assert.equal(result.detail, 'Gradle 9.7.0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkCommand skips noisy "Picked up ..." and separator lines', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcmux-doctor-test-'));
  try {
    const script = path.join(dir, 'fake-java.sh');
    await writeFile(
      script,
      '#!/bin/sh\necho "Picked up JAVA_TOOL_OPTIONS: whatever"\necho "openjdk version \\"21.0.10\\""\n',
      'utf8'
    );
    await chmod(script, 0o755);

    const result = checkCommand(script, ['-version']);
    assert.equal(result.ok, true);
    assert.match(result.detail, /openjdk version/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('checkCommand reports ENOENT for a missing binary', () => {
  const result = checkCommand('/definitely/not/a/real/binary-xyz', ['-v']);
  assert.equal(result.ok, false);
  assert.match(result.detail, /ENOENT/);
});

test('checkCommand reports a non-zero exit code as not ok', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcmux-doctor-test-'));
  try {
    const script = path.join(dir, 'fails.sh');
    await writeFile(script, '#!/bin/sh\necho "boom" 1>&2\nexit 1\n', 'utf8');
    await chmod(script, 0o755);

    const result = checkCommand(script, []);
    assert.equal(result.ok, false);
    assert.match(result.detail, /boom/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
