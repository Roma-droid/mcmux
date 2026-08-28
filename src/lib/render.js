// Minimal {{placeholder}} template renderer. No conditionals/loops on purpose --
// the *content* variability across loaders/versions is handled by the
// preprocessor (see preprocessor.js) and by having separate per-loader
// template directories, not by templating logic here.

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Strict render: throws if a placeholder has no matching var. */
export function renderTemplate(source, vars) {
  return source.replace(PLACEHOLDER_RE, (match, key) => {
    if (!(key in vars)) {
      throw new Error(`Template variable not provided: ${key}`);
    }
    return String(vars[key]);
  });
}

/** Lenient render: substitutes what it can, leaves unknown {{key}} as-is. */
export function renderTemplatePartial(source, vars) {
  return source.replace(PLACEHOLDER_RE, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function hasUnresolvedPlaceholders(source) {
  return PLACEHOLDER_RE.test(source);
}

/** Expands the __PKG__/__PKGDOTS__/__MODCLASS__ path markers only -- no {{}} handling. */
export function expandPathPlaceholders(pathTemplate, vars) {
  let out = pathTemplate;
  out = out.replaceAll('__PKG__', String(vars.package).replaceAll('.', '/'));
  out = out.replaceAll('__PKGDOTS__', String(vars.package));
  if (vars.ModClass) out = out.replaceAll('__MODCLASS__', vars.ModClass);
  return out;
}

export function templateVars(config) {
  const ModClass = toPascalCase(config.modId);
  return {
    modId: config.modId,
    modName: config.modName || config.modId,
    modVersion: config.modVersion || '0.1.0',
    package: config.package,
    ModClass,
  };
}

function toPascalCase(id) {
  return id
    .split(/[_-]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
}
