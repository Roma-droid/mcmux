import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { preprocess } from './preprocessor.js';
import {
  renderTemplate,
  renderTemplatePartial,
  hasUnresolvedPlaceholders,
  expandPathPlaceholders,
  templateVars,
} from './render.js';
import { listFilesRecursive, readTemplateFile } from './templates.js';
import { suggestJavaVersion } from './versions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates');

const LOADER_DEFAULTS = {
  fabric: { loomVersion: '1.7-SNAPSHOT', yarnMappings: '<FILL_IN>', fabricApiVersion: '<FILL_IN>' },
  forge: { forgeGradleVersion: '[6.0,6.2)' },
  neoforge: { neoGradleVersion: '7.0.+' },
};

export function loaderLayerDir(loader) {
  return path.join(TEMPLATES_ROOT, loader);
}

export function commonLayerDir() {
  return path.join(TEMPLATES_ROOT, 'common');
}

/**
 * `mcmux init` / `mcmux loader add`: materializes a template layer (the
 * tool's own templates/common or templates/<loader>) into the user's
 * project, at `destDir` (e.g. "<project>/common" or "<project>/fabric").
 *
 * Project-level placeholders ({{modId}}, {{modName}}, {{modVersion}},
 * {{package}}, {{ModClass}}) are resolved now, since they never change per
 * build target. Anything left unresolved (target-level vars like
 * {{version}}/{{loaderVersion}}, or //? preprocessor directives) is written
 * out as-is with the file kept under its original *.tmpl name, so it stays
 * obviously "still a template" to whoever edits the project.
 */
export async function materializeLayer(layerDir, destDir, config) {
  const vars = templateVars(config);
  const files = await listFilesRecursive(layerDir);
  const written = [];
  for (const relPath of files) {
    const raw = await readTemplateFile(layerDir, relPath);
    const rendered = renderTemplatePartial(raw, vars);
    let outRelPath = expandPathPlaceholders(relPath, vars);
    if (!hasUnresolvedPlaceholders(rendered) && outRelPath.endsWith('.tmpl')) {
      outRelPath = outRelPath.slice(0, -'.tmpl'.length);
    }
    const outPath = path.join(destDir, outRelPath);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, rendered, 'utf8');
    written.push(outRelPath);
  }
  return written;
}

/** Compute the full variable set used to render templates for one target. */
export function targetVars(config, target) {
  const base = templateVars(config);
  const javaVersion = target.javaVersion ?? suggestJavaVersion(target.version);
  return {
    ...base,
    ...LOADER_DEFAULTS[target.loader],
    version: target.version,
    loader: target.loader,
    modVersion: config.modVersion || '0.1.0',
    javaVersion,
    loaderVersion: target.loaderVersion || '<FILL_IN>',
    ...target.vars,
  };
}

/**
 * Renders one already-materialized project source layer (the project's own
 * "common" or "<loader>" directory, as produced by materializeLayer) into
 * outDir for one concrete target. Files still ending in .tmpl get the
 * preprocessor + a strict final render (all target vars are now known, so
 * nothing should be left unresolved); plain files just get preprocessed.
 */
async function applyProjectLayer(layerDir, outDir, context, vars) {
  let files;
  try {
    files = await listFilesRecursive(layerDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const written = [];
  for (const relPath of files) {
    const raw = await readTemplateFile(layerDir, relPath);
    const preprocessed = preprocess(raw, context, relPath);
    const isTemplate = relPath.endsWith('.tmpl');
    const finalContent = isTemplate ? renderTemplate(preprocessed, vars) : preprocessed;
    const outRelPath = isTemplate ? relPath.slice(0, -'.tmpl'.length) : relPath;
    const outPath = path.join(outDir, outRelPath);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, finalContent, 'utf8');
    written.push(outRelPath);
  }
  return written;
}

/**
 * Generates a complete, standalone, ordinary single-loader Gradle project
 * for one target (version+loader pair) at outDir, from the *project's own*
 * common/<loader> source directories (not the tool's template library --
 * those were only used once, by materializeLayer, to seed the project).
 * Each generated project is exactly the kind of plain Fabric/Forge/NeoForge
 * project those loaders' own tooling already understands: mcmux does not
 * invent any cross-loader Gradle magic, it just merges+preprocesses sources
 * ahead of time.
 */
export async function generateTarget(config, target, projectDir, outDir) {
  const context = { version: target.version, loader: target.loader };
  const vars = targetVars(config, target);

  const writtenFiles = [];
  writtenFiles.push(
    ...(await applyProjectLayer(path.join(TEMPLATES_ROOT, 'root'), outDir, context, vars))
  );
  writtenFiles.push(
    ...(await applyProjectLayer(path.join(projectDir, 'common'), outDir, context, vars))
  );
  writtenFiles.push(
    ...(await applyProjectLayer(path.join(projectDir, target.loader), outDir, context, vars))
  );
  return { outDir, files: writtenFiles, vars };
}
