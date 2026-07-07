/**
 * HTML includes for the personal slide decks.
 *
 * A deck HTML file can pull in chapter files with a full-line directive:
 *
 *     <!-- @include decks/inf581_optimization/10-introduction.html -->
 *
 * The directive line is replaced by the file's exact content (no re-indentation), so
 * splitting a deck at chapter boundaries reassembles byte-identically. Paths are resolved
 * relative to the including file's directory, or from the repo root when they start
 * with "/". Includes may nest; cycles and missing files throw.
 *
 * The same expansion runs in both serving paths:
 *   - dev: the deckIncludes() Vite plugin below (used by vite.config.ts) expands pages
 *     as they are served, and triggers a browser reload when a chapter file changes;
 *   - publish: scripts/build-decks.mjs expands each root page while assembling _site/.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIRECTIVE = /^[ \t]*<!--\s*@include\s+(\S+?)\s*-->[ \t]*\r?\n?/gm;
const root = path.resolve(import.meta.dirname, '..');

/** Directory holding the split-out chapter files (one subfolder per deck). */
export const DECKS_DIR = path.join(root, 'decks');

export function expandIncludes(html, filePath, stack = []) {
	return html.replace(DIRECTIVE, (line, target) => {
		const included = target.startsWith('/')
			? path.join(root, target)
			: path.resolve(path.dirname(filePath), target);
		const chain = [...stack, filePath];
		if (chain.includes(included)) {
			throw new Error(`deck-includes: cycle detected: ${[...chain, included].map(f => path.relative(root, f)).join(' -> ')}`);
		}
		if (!fs.existsSync(included)) {
			throw new Error(`deck-includes: "${target}" not found (from ${path.relative(root, filePath)})`);
		}
		return expandIncludes(fs.readFileSync(included, 'utf8'), included, chain);
	});
}

/** Vite plugin: expand includes in served .html pages + reload on chapter edits. */
export function deckIncludes() {
	return {
		name: 'deck-includes',
		transformIndexHtml: {
			order: 'pre',
			handler(html, ctx) {
				return expandIncludes(html, ctx.filename);
			},
		},
		configureServer(server) {
			const reload = file => {
				if (path.resolve(file).startsWith(DECKS_DIR + path.sep)) {
					server.ws.send({ type: 'full-reload' });
				}
			};
			server.watcher.on('change', reload);
			server.watcher.on('add', reload);
			server.watcher.on('unlink', reload);
		},
	};
}
