import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { loadClient } from "@bxl/schema/load";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const slug = process.env.CLIENT;
if (!slug) {
  throw new Error(
    "variable CLIENT manquante — lancer `pnpm build <slug>` depuis la racine du repo.",
  );
}

const { site } = loadClient(repoRoot, slug);

export default defineConfig({
  site: `https://${site.domain}`,
  outDir: fileURLToPath(new URL(`../../dist/${slug}`, import.meta.url)),
  build: { format: "directory", assets: "_assets" },
  compressHTML: true,
  devToolbar: { enabled: false },
  image: {
    // Formats modernes uniquement : les photos sont l'argument de vente, elles
    // doivent être belles ET légères.
    responsiveStyles: true,
  },
  vite: {
    define: {
      __CLIENT_SLUG__: JSON.stringify(slug),
      __REPO_ROOT__: JSON.stringify(repoRoot),
    },
  },
});
