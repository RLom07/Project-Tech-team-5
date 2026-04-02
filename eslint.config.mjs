import globals from "globals"
import { defineConfig } from "eslint/config"

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node }
  },
  {
    rules: {
      "no-unused-vars": [
        "warn",
        {
          "varsIgnorePattern": "^(data|kiesGenre|kiesSfeer|kiesBelangrijk|kiesPeriode|kiesDoelgroep|kiesTaal)$",
          "argsIgnorePattern": "^_" 
        }
      ],
      "semi": ["warn", "never"],
      "quotes": ["warn", "double"]
    }
  }
])
