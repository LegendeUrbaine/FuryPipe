import { transformSync } from 'esbuild';
import globals from 'globals';

const typescriptProcessor = {
  preprocess(source, filename) {
    const result = transformSync(source, {
      format: 'esm',
      loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
      sourcefile: filename,
      target: 'esnext',
    });

    return [{ text: result.code, filename: `${filename}.mjs` }];
  },
  postprocess(messageLists) {
    return messageLists.flat();
  },
  supportsAutofix: false,
};

export default [
  {
    ignores: [
      'dist/**',
      'artifacts/**',
      'eval/**',
      'node_modules/**',
      'coverage/**',
      '.superpowers/**',
    ],
  },
  {
    files: [
      'src/**/*.{js,mjs,cjs,ts,tsx}',
      'scripts/**/*.{js,mjs,cjs,ts,tsx}',
      'tests/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        __FURYPIPE_VERSION__: 'readonly',
      },
      sourceType: 'module',
    },
    rules: {
      'constructor-super': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-const-assign': 'error',
      'no-debugger': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-ex-assign': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-obj-calls': 'error',
      'no-self-assign': 'error',
      'no-setter-return': 'error',
      'no-sparse-arrays': 'error',
      'no-this-before-super': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'no-with': 'error',
      'require-yield': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'scripts/**/*.ts', 'scripts/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    processor: typescriptProcessor,
  },
];
