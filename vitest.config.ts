import { defineConfig } from "vitest/config";

/**
 * Les tests couvrent les chemins où une erreur coûte de l'argent ou expose
 * des données : validation du contenu des clients, authentification de
 * l'administration, et défenses de l'API publique.
 *
 * Ils ne couvrent pas le rendu du template : le build en intégration continue
 * échoue déjà si une page ne se construit pas, et tester du HTML statique
 * rapporterait peu pour un coût d'entretien élevé.
 */
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
