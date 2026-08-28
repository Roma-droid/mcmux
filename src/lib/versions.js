// Version comparison and metadata for Minecraft versions / loaders.
// Versions are compared as dot-separated numeric components, e.g. "1.19.1" vs "1.20".
// Unknown/custom version strings (e.g. an internal build number) are still comparable
// as long as they are dot-separated numbers.

export function parseVersion(v) {
  return String(v)
    .split('.')
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

export const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];

// Baseline metadata to help users pick sane defaults (Java version, whether the
// loader is even known to exist for that MC version). This is intentionally a
// small, editable seed table, not an attempt at an exhaustive/always-up-to-date
// registry -- users should confirm current loader versions themselves (see
// docs/VERSIONS.md) and can override java/loaderVersion per target.
export const JAVA_FOR_MC = [
  { min: '1.17', max: '1.17.99', java: 16 },
  { min: '1.18', max: '1.20.4', java: 17 },
  { min: '1.20.5', max: '1.99.99', java: 21 },
];

export function suggestJavaVersion(mcVersion) {
  for (const row of JAVA_FOR_MC) {
    if (compareVersions(mcVersion, row.min) >= 0 && compareVersions(mcVersion, row.max) <= 0) {
      return row.java;
    }
  }
  // Newer/unknown versions: default to the newest known toolchain.
  if (compareVersions(mcVersion, '1.20.5') >= 0) return 21;
  return 17;
}

export function isKnownLoader(loader) {
  return KNOWN_LOADERS.includes(String(loader).toLowerCase());
}
