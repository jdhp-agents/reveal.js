// Feuille de route du deck rl_ppo.html : TD actor-critic → + rollouts et GAE →
// + réutilisation du lot (ratio) → + clipping → + entropie = PPO.
//
// Usage dans une slide :
//   <div class="ppo-roadmap" data-step="2"></div>
//   <script type="module" src="assets/rl_ppo/roadmap.ts"></script>
// data-step = indice de l'étape courante (0 à 5) ; les étapes précédentes sont
// pleines, les suivantes estompées ; data-step="all" : tout en plein.
// Le contenu est en Unicode (pas de MathJax : le module s'exécute après la
// composition des formules).
import './frames';

const STEPS: { cls: string; label: string; sub: string }[] = [
	{ cls: 'base', label: 'TD Actor-Critic', sub: 'starting point' },
	{ cls: 'gae', label: '+ rollouts & GAE', sub: 'better advantages' },
	{ cls: 'reuse', label: '+ data reuse', sub: 'ratio ρₜ(θ)' },
	{ cls: 'clip', label: '+ clipping', sub: 'small policy steps' },
	{ cls: 'ent', label: '+ entropy', sub: 'full loss' },
	{ cls: 'ppo', label: '= PPO', sub: '' },
];

document.querySelectorAll<HTMLElement>('.ppo-roadmap').forEach(box => {
	if (box.childElementCount) return;
	const attr = box.dataset.step ?? 'all';
	const cur = attr === 'all' ? STEPS.length : parseInt(attr, 10);
	STEPS.forEach((st, i) => {
		if (i > 0) {
			const arrow = document.createElement('span');
			arrow.className = 'arrow';
			arrow.textContent = '→';
			box.appendChild(arrow);
		}
		const div = document.createElement('div');
		div.className = `step ${st.cls}` + (i < cur ? ' done' : i === cur ? ' current' : '');
		div.innerHTML = st.label + (st.sub ? `<small>${st.sub}</small>` : '');
		box.appendChild(div);
	});
});
