import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import i18n from 'eslint-plugin-i18n'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      i18n,
    },
    rules: {
      'i18n/no-chinese-character': [
        'error',
        {
          includeComment: true,
        },
      ],
      // Timezone guardrails (project contract: Dubai wall-clock, no offset — see src/utils/gstTime.ts).
      // toISOString() converts to UTC with a Z suffix and new Date(string) parses in the
      // browser timezone; both break the UTC+4 contract. Use toApi/fromApi/nowGst instead.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.property.name='toISOString']",
          message: 'Do not submit toISOString() values (UTC+Z breaks the Dubai wall-clock contract). Use toApi() from @/utils/gstTime.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=1]",
          message: 'Do not parse backend date strings with new Date(str) (browser-timezone dependent). Use fromApi() from @/utils/gstTime.',
        },
      ],
    },
  },
])
