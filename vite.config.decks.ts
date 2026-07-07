/**
 * Build config for the personal decks' d3.js figures (assets/<deck-name>/*.ts).
 *
 * In dev (`npm start`) this config is unused: the Vite dev server transpiles the .ts
 * figure modules on the fly, straight from the `<script type="module" src="....ts">`
 * tags in the deck HTML.
 *
 * At publish time (`npm run build:decks`), this build compiles each figure to
 * _site/assets/<deck-name>/<figure-name>.js — the exact path the deck HTML references
 * once scripts/build-decks.mjs has rewritten `.ts` script srcs to `.js`.
 */
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const assetsDir = path.resolve(__dirname, 'assets');

// One rollup entry per figure source, named by its path relative to assets/
// (without extension) so the emitted .js mirrors the source layout.
const input: Record<string, string> = {};
for (const file of fs.readdirSync(assetsDir, { recursive: true, encoding: 'utf8' })) {
	if (file.endsWith('.ts')) {
		input[file.slice(0, -3)] = path.join(assetsDir, file);
	}
}

export default defineConfig({
	publicDir: false,
	build: {
		outDir: '_site/assets',
		// _site/ is assembled by scripts/build-decks.mjs just before this build runs
		emptyOutDir: false,
		rollupOptions: {
			input,
			output: {
				entryFileNames: '[name].js',
				// Code shared between figures (e.g. d3 itself, once several figures exist)
				chunkFileNames: '_shared/[name]-[hash].js',
				assetFileNames: '_shared/[name]-[hash][extname]',
			},
		},
	},
});
