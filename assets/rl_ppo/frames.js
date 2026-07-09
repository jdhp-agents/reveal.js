function e(e){let t=-1;return e.querySelectorAll(`.fragment.visible`).forEach(e=>{let n=parseInt(e.getAttribute(`data-fragment-index`)??``,10);!Number.isNaN(n)&&n>t&&(t=n)}),t}function t(t,n){let r=t.closest(`section`),i=(t.getAttribute(`data-frames`)??``).trim().split(/\s+/).filter(Boolean),a=t.getAttribute(`data-initial-frame`),o,s=()=>{let t=e(r),s=t<0?a:i[Math.min(t,i.length-1)]??null,c=`${t}|${s}`;c!==o&&(o=c,n(s,t))},c=window.Reveal;if(c?.on)for(let e of[`ready`,`slidechanged`,`fragmentshown`,`fragmenthidden`])c.on(e,s);s()}function n(e,t){e&&e.querySelectorAll(`[data-ln]`).forEach(e=>{let n=parseInt(e.dataset.ln??``,10);e.classList.toggle(`current`,t.includes(n))})}function r(e,t){e&&(e.addEventListener(`input`,()=>t(parseFloat(e.value))),e.addEventListener(`change`,()=>e.blur()),e.addEventListener(`keydown`,e=>e.stopPropagation()))}var i={gae:`#009e73`,reuse:`#e69f00`,clip:`#cc79a7`,ent:`#0072b2`},a=i,o=(e,t)=>{let n=parseInt(e.slice(1),16);return`rgba(${n>>16}, ${n>>8&255}, ${n&255}, ${t})`},s=`
.ppo-code { font-family: inherit; line-height: 1.32; text-align: left; }
.ppo-code [data-ln] { position: relative; white-space: nowrap; transition: color 0.2s; border-radius: 0.15em; }
.ppo-code [data-ln]::before {
	content: attr(data-ln); position: absolute; left: -1.9em; width: 1.4em;
	text-align: right; color: #aaa; font-size: 75%; top: 0.18em;
}
.ppo-code [data-ln].current { color: #ff2c2d; }
/* ligne de continuation : même numéro (surlignée avec la ligne), numéro non répété */
.ppo-code [data-ln].cont::before { content: ''; }
.ppo-code .kw { font-weight: bold; }
.ppo-code .cm { color: #999; font-size: 85%; }
.ppo-code [data-ln].current .cm { color: #ff2c2d; opacity: 0.75; }
.ppo-code .i1 { padding-left: 1.2em; } .ppo-code .i2 { padding-left: 2.4em; }
.ppo-code .i3 { padding-left: 3.6em; } .ppo-code .i4 { padding-left: 4.8em; }
/* lignes ajoutées par chaque ingrédient (pseudo-code « diff ») */
.ppo-code .add-gae { background: ${o(a.gae,.13)}; box-shadow: inset 0.22em 0 0 ${a.gae}; }
.ppo-code .add-reuse { background: ${o(a.reuse,.16)}; box-shadow: inset 0.22em 0 0 ${a.reuse}; }
.ppo-code .add-clip { background: ${o(a.clip,.16)}; box-shadow: inset 0.22em 0 0 ${a.clip}; }
.ppo-code .add-ent { background: ${o(a.ent,.12)}; box-shadow: inset 0.22em 0 0 ${a.ent}; }
.ppo-code .gone { color: #bbb; text-decoration: line-through; }
.ppo-c-gae { color: ${a.gae}; } .ppo-c-reuse { color: ${a.reuse}; }
.ppo-c-clip { color: ${a.clip}; } .ppo-c-ent { color: ${a.ent}; }

/* feuille de route : TD AC → +GAE → +réutilisation → +clip → +entropie */
.ppo-roadmap { display: flex; justify-content: center; align-items: stretch; gap: 0.35em; margin: 0.6em 0; }
.ppo-roadmap .step {
	--c: #555; border: 0.12em solid var(--c); border-radius: 0.45em; padding: 0.35em 0.55em;
	color: var(--c); background: #fff; opacity: 0.3; text-align: center; line-height: 1.15;
	display: flex; flex-direction: column; justify-content: center; min-width: 5.2em;
}
.ppo-roadmap .step small { display: block; font-size: 70%; color: inherit; opacity: 0.9; }
.ppo-roadmap .step.done { opacity: 1; }
.ppo-roadmap .step.current { opacity: 1; background: var(--c); color: #fff; }
.ppo-roadmap .arrow { align-self: center; color: #999; }
.ppo-roadmap .step.gae { --c: ${a.gae}; } .ppo-roadmap .step.reuse { --c: ${a.reuse}; }
.ppo-roadmap .step.clip { --c: ${a.clip}; } .ppo-roadmap .step.ent { --c: ${a.ent}; }
.ppo-roadmap .step.ppo { --c: #222; }

svg.ppo-fig { font-family: "Source Sans Pro", Helvetica, sans-serif; overflow: visible; }
svg.ppo-fig text { user-select: none; }
svg.ppo-fig .halo { paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
.ppo-slider { width: 100%; accent-color: #4aa3df; }
.ppo-slider-row { display: flex; align-items: center; gap: 0.8em; margin: 0 auto; }
.ppo-slider-row .lbl { min-width: 6em; text-align: right; white-space: nowrap; }
`;if(!document.getElementById(`rl-ppo-styles`)){let e=document.createElement(`style`);e.id=`rl-ppo-styles`,e.textContent=s,document.head.appendChild(e)}export{i as INGREDIENT_COLORS,r as bindSlider,n as highlightLines,t as syncWithFragments};