/**
 * Assembles the publishable static site for the personal slide decks into _site/.
 *
 * The decks are served as-is (same layout as the repo root, all-relative URLs), so this
 * script mostly copies files verbatim. The only transformation: `<script src="....ts">`
 * references are rewritten to `.js`, because the TypeScript figure sources are compiled
 * by `vite build -c vite.config.decks.ts` (run right after this script by `npm run
 * build:decks`), which emits the .js files into _site/assets/.
 *
 * The prebuilt framework files in dist/ are committed and copied as-is — the framework is
 * NOT rebuilt at publish time, so what gets published is exactly what was tested locally.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expandIncludes } from './deck-includes.mjs';

const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, '_site');

fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(site);

// Root HTML pages (landing page + every deck): chapter includes expanded, then
// .ts module scripts rewritten to .js
for (const file of fs.readdirSync(root)) {
	if (!file.endsWith('.html')) continue;
	const source = path.join(root, file);
	const html = expandIncludes(fs.readFileSync(source, 'utf8'), source)
		.replace(/(<script[^>]+src="[^"]+)\.ts"/g, '$1.js"');
	fs.writeFileSync(path.join(site, file), html);
	console.log(`html  ${file}`);
}

// Static folders and shared deck files, copied verbatim.
// assets/ excludes the .ts sources: their compiled .js counterparts are emitted by Vite.
const copies = [
	{ from: 'dist', filter: () => true },
	{ from: 'assets', filter: src => !src.endsWith('.ts') },
	{ from: 'jdhp.css' },
	{ from: 'jdhp.js' },
];
for (const { from, filter } of copies) {
	const src = path.join(root, from);
	if (!fs.existsSync(src)) {
		console.error(`missing: ${from} — run \`npm run build\` first if dist/ is absent`);
		process.exit(1);
	}
	fs.cpSync(src, path.join(site, from), { recursive: true, filter });
	console.log(`copy  ${from}`);
}

console.log(`\nSite assembled in ${path.relative(root, site)}/ — now compiling the d3 figures…`);
