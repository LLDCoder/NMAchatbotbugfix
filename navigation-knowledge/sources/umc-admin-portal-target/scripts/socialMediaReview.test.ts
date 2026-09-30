import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("renders submitted social media operations as read-only status cards", () => {
  const source = readFileSync(
    "src/components/designable/src/components/SocialMediaAccount/SocialMediaAccountField.tsx",
    "utf8",
  );

  assert.match(source, /operation\?:\s*"ADD"\s*\|\s*"MODIFY"\s*\|\s*"DELETE"/);
  assert.match(source, /SocialMediaAccount\.statusNew/);
  assert.match(source, /SocialMediaAccount\.statusModified/);
  assert.match(source, /SocialMediaAccount\.statusDeleted/);
  assert.match(source, /social-media-account-card__title-row/);
  assert.match(source, /isReadOnlyMode\s*&&\s*statusKey/);
  assert.match(source, /SocialMediaAccount\.details/);
  assert.match(
    source,
    /<OverflowTooltip\s+className="social-media-account-name"\s+title=\{displayName\}/,
  );
});

test("provides English and Arabic status labels", () => {
  for (const locale of ["en", "ar"]) {
    const translations = JSON.parse(
      readFileSync(`src/localization/formily/${locale}.json`, "utf8"),
    );
    assert.equal(typeof translations.SocialMediaAccount.statusNew, "string");
    assert.equal(typeof translations.SocialMediaAccount.statusModified, "string");
    assert.equal(typeof translations.SocialMediaAccount.statusDeleted, "string");
    assert.equal(typeof translations.SocialMediaAccount.details, "string");
  }
});

test("uses the Figma status colors for new, modified, and deleted cards", () => {
  const styles = readFileSync(
    "src/components/designable/src/components/SocialMediaAccount/styles.less",
    "utf8",
  );

  assert.match(
    styles,
    /social-media-account-status--add\s*\{[\s\S]*color:\s*#286cff;[\s\S]*background:\s*#e7f5ff;/,
  );
  assert.match(
    styles,
    /social-media-account-status--modify\s*\{[\s\S]*color:\s*#9e6c17;[\s\S]*background:\s*#fff5df;/,
  );
  assert.match(
    styles,
    /social-media-account-status--delete\s*\{[\s\S]*color:\s*#b43d3d;[\s\S]*background:\s*#fceeee;/,
  );
});
