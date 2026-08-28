import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // This app loads its data from the API inside effects (the standard
      // fetch-on-mount + cancel pattern used on every page), so the rule that
      // forbids setState in an effect body is disabled project-wide.
      'react-hooks/set-state-in-effect': 'off',
      // Contexts deliberately co-export their provider and hook (useAuth,
      // useToast, useConfirm) so consumers only need a single import.
      'react-refresh/only-export-components': 'off',
    },
  },
])
