import js from '@eslint/js'
import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'

const globals = {
  Buffer: 'readonly',
  Blob: 'readonly',
  MediaMetadata: 'readonly',
  URL: 'readonly',
  IntersectionObserver: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  document: 'readonly',
  global: 'readonly',
  localStorage: 'readonly',
  module: 'readonly',
  navigator: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
  __dirname: 'readonly'
}

export default [
  {
    ignores: ['build/**', 'dist/**', 'node_modules/**', 'out/**', 'src/main/generated/prisma/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{cjs,js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      sourceType: 'module'
    },
    plugins: {
      react
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'no-constant-condition': 'off',
      'no-unused-vars': 'warn',
      'react/no-unknown-property': 'off',
      'react/prop-types': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  }
]
