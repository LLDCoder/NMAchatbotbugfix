import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPaths = [
  "MoviePackageForm/MoviePackageFormField.tsx",
  "FilmTrailerForm/FilmTrailerFormField.tsx",
  "FilmScreeningForm/FilmScreeningFormField.tsx",
  "FilmRescreeningForm/FilmRescreeningFormField.tsx",
];

const readComponent = (relativePath) =>
  readFile(
    new URL(
      `../src/components/designable/src/components/${relativePath}`,
      import.meta.url,
    ),
    "utf8",
  );

for (const componentPath of componentPaths) {
  test(`${componentPath} normalizes language values without an effect write-back`, async () => {
    const source = await readComponent(componentPath);

    assert.doesNotMatch(source, /needsLanguagesNormalization/);
    assert.doesNotMatch(source, /hasLegacyLanguage/);
    assert.match(source, /languages:\s*normalizeLanguageIds\(/);
  });
}
