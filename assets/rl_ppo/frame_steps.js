// Fragments « compteurs » des slides pilotées par une liste de frames.
//
// Script CLASSIQUE (pas un module, pas de TypeScript) : à placer dans la
// <section>, après l'élément qui porte l'attribut data-frames :
//
//   <svg … data-frames="1:init 1:try.0 1:sim.0 …"></svg>
//   <script src="assets/rl_ppo/frame_steps.js"></script>
//
// Il crée un fragment vide (data-fragment-index = 0, 1, 2, …) par jeton de
// data-frames. Un script classique s'exécute pendant l'analyse de la page,
// donc AVANT le Reveal.initialize() du bas de page : reveal.js voit ces
// fragments exactement comme s'ils étaient écrits à la main (navigation
// arrière, accès direct par l'URL, vue présentateur). Un module (type=module)
// s'exécute trop tard pour cela — voir le commentaire de la slide « At each
// iteration » de decks/optimization_cem/cem.html.
//
// Les modules des figures (frames.ts) lisent ensuite le plus grand
// data-fragment-index visible de la section pour savoir quelle frame afficher.
(function () {
	var script = document.currentScript;
	var section = script && script.closest('section');
	var driver = section && section.querySelector('[data-frames]');
	if (!driver) return;
	var count = driver.getAttribute('data-frames').trim().split(/\s+/).length;
	var box = document.createElement('div');
	box.className = 'frame-steps';
	box.setAttribute('aria-hidden', 'true');
	box.style.display = 'none';
	for (var i = 0; i < count; i++) {
		var span = document.createElement('span');
		span.className = 'fragment';
		span.setAttribute('data-fragment-index', String(i));
		box.appendChild(span);
	}
	section.appendChild(box);
})();
