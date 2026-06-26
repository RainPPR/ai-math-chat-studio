// @ts-check

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
    files: ["src/**/*.{js,ts,tsx,jsx}", "server/**/*.{js,ts,tsx,jsx}"],
    extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
    ],
    languageOptions: {
        parserOptions: {
            projectService: true,
        },
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "no-useless-assignment": "off",
        "no-empty": "off",
    },
});
