// @ts-check

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
    files: ["src/**/*.{js,ts,tsx,jsx}", "server/**/*.{js,ts,tsx,jsx}"],
    extends: [
        js.configs.recommended,
        tseslint.configs.strictTypeChecked,
        tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
        parserOptions: {
            projectService: true,
        },
    },
});
