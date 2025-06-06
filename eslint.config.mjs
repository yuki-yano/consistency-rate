import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginPerfectionist from "eslint-plugin-perfectionist"
import pluginReactJSXRuntime from "eslint-plugin-react/configs/jsx-runtime.js"
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js"
import pluginReactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.exnext,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReactConfig,
  pluginReactJSXRuntime,
  // pluginPerfectionist.configs["recommended-natural"],
  eslintConfigPrettier,
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
    },
  },
  {
    ignores: ["**/*.js", "**/*.mjs", "vite.config.ts"],
  },
]
