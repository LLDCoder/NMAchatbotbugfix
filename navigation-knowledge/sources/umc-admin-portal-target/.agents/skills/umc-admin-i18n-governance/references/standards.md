# English and UAE Arabic Standards

## Resource ownership

- Keep one i18next namespace: `translation`.
- Register every locale pair in `src/localization/resources.ts`; each top-level key has one owner.
- Put keys under the owning module. Reuse a shared key only when meaning, action, tone, parameters, and ownership are identical.
- Do not use English sentences as keys or `defaultValue` to mask missing resources.

## Language standard

Confirm English grammar, action, status role, recovery instruction, capitalization, punctuation, interpolation, and context. Do not rewrite legal, branded, or backend-managed wording without its authority.

Use clear, neutral Modern Standard Arabic suitable for UAE government services. Review agreement, definiteness, prepositions, punctuation, and whether the sentence works independently.

| English | Arabic |
| --- | --- |
| National Media Authority | الهيئة الوطنية للإعلام |
| Application / Request | طلب |
| Service | خدمة |
| Permit | تصريح |
| License | رخصة |
| Inspection | تفتيش |
| Violation | مخالفة |
| Fine | غرامة |
| Refund | استرداد |
| Complaint | شكوى |
| Payment | دفع |
| Approval | موافقة |
| Upload File | رفع ملف |

Do not assign one global Arabic term to `Appeal`, `Objection`, or `Grievance`.
Confirm the legal and workflow role in the owning module, then record whether the
approved term is `تظلّم`, `اعتراض`, or another authority-provided term.
Likewise, do not mechanically unify inspection or service-configuration terms.

## Runtime rules

- Prefer `isArabicLanguage(language)` for application values. `i18n.resolvedLanguage` is safe for direct comparison because i18next resolves `ar-AE` to `ar`.
- Use `toFormilyValidateLanguage` for Formily validation locale values
  `ar-AE` / `en-US`. This is independent from the AntD v4 locale object.
- Select confirmed bilingual API fields only. Apply a cross-language fallback only where the current contract allows it.
- Technical/backend messages are diagnostics. UI state stores an error category or i18n key, not arbitrary text.
- Keep email, IDs, reference numbers, URLs, currency, and technical acronyms readable under RTL.
- AntD direction comes from `ConfigProvider`; root direction comes from the document. Component `dir` is only for genuine mixed-direction content.

## Cross-Portal rule

Customer and Admin share terminology, not runtime files or npm packages. Each repository retains its own manifest/registry, Harness, evidence, and Skill.
