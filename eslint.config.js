import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tsEslint from 'typescript-eslint'

export default tsEslint.config(
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      parserOptions: {
        parser: tsEslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: {
          ts: tsEslint.parser,
          js: tsEslint.parser,
          '<template>': tsEslint.parser,
        },
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.d.ts',
    ],
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  }
)