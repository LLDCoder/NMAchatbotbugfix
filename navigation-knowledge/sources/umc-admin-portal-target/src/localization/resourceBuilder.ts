export type Language = "ar" | "en";
export type TranslationResource = Record<string, unknown>;

export type TranslationResourceEntry = {
  owner: string;
  ar: TranslationResource;
  en: TranslationResource;
};

export const mergeTranslationRegistry = (
  language: Language,
  registry: readonly TranslationResourceEntry[],
): TranslationResource => {
  const merged: TranslationResource = {};
  const owners = new Map<string, string>();

  registry.forEach((entry) => {
    Object.entries(entry[language]).forEach(([key, value]) => {
      const previousOwner = owners.get(key);
      if (previousOwner) {
        throw new Error(
          `[i18n] Duplicate top-level key "${key}" for "${language}": owners "${previousOwner}" and "${entry.owner}".`,
        );
      }
      owners.set(key, entry.owner);
      merged[key] = value;
    });
  });

  return merged;
};

export const buildTranslationResources = (
  registry: readonly TranslationResourceEntry[],
) => ({
  en: {
    translation: mergeTranslationRegistry("en", registry),
  },
  ar: {
    translation: mergeTranslationRegistry("ar", registry),
  },
});
