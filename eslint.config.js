import js from '@eslint/js'
import { includeIgnoreFile } from '@eslint/compat'
import { defineConfig } from 'eslint/config'
import { URL, fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url))

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  }
)
