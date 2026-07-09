function e(e){let t=-1;return e.querySelectorAll(`.fragment.visible`).forEach(e=>{let n=parseInt(e.getAttribute(`data-fragment-index`)??``,10);!Number.isNaN(n)&&n>t&&(t=n)}),t}function t(t,n){let r=t.closest(`section`),i=(t.getAttribute(`data-frames`)??``).trim().split(/\s+/).filter(Boolean),a=t.getAttribute(`data-initial-frame`),o,s=()=>{let t=e(r),s=t<0?a:i[Math.min(t,i.length-1)]??null,c=`${t}|${s}`;c!==o&&(o=c,n(s,t))},c=window.Reveal;if(c?.on)for(let e of[`ready`,`slidechanged`,`fragmentshown`,`fragmenthidden`])c.on(e,s);s()}function n(e){let t=window.Reveal?.getCurrentSlide?.();return!!t&&t.contains(e)}function r(e,t){e&&e.querySelectorAll(`[data-ln]`).forEach(e=>{let n=parseInt(e.dataset.ln??``,10);e.classList.toggle(`current`,t.includes(n))})}var i=`
.mcts-code { font-family: inherit; line-height: 1.32; text-align: left; }
.mcts-code [data-ln] { position: relative; white-space: nowrap; transition: color 0.2s; }
.mcts-code [data-ln]::before {
	content: attr(data-ln); position: absolute; left: -1.9em; width: 1.4em;
	text-align: right; color: #aaa; font-size: 75%; top: 0.18em;
}
.mcts-code [data-ln].current { color: #ff2c2d; }
.mcts-code .kw { font-weight: bold; }
.mcts-code .cm { color: #999; font-size: 85%; }
.mcts-code [data-ln].current .cm { color: #ff2c2d; opacity: 0.75; }
/* lignes qui diffèrent entre les deux variantes (slide de comparaison) */
.mcts-code [data-ln].diff { background: #fff1c4; border-radius: 0.2em; }
.mcts-code .i1 { padding-left: 1.2em; } .mcts-code .i2 { padding-left: 2.4em; }
.mcts-code .i3 { padding-left: 3.6em; }
svg.mcts-fig { font-family: "Source Sans Pro", Helvetica, sans-serif; overflow: visible; }
svg.mcts-fig text { user-select: none; }
/* étiquettes des arbres (N, Q, W/N, probabilités) : liseré blanc pour que les
   arêtes qui passent dessous ne les barrent pas */
svg.mcts-fig .tree-nodes text, svg.mcts-fig text.link-label {
	paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round;
}
.mcts-slider { width: 100%; accent-color: #4aa3df; }
`;if(!document.getElementById(`rl-mcts-styles`)){let e=document.createElement(`style`);e.id=`rl-mcts-styles`,e.textContent=i,document.head.appendChild(e)}export{r as highlightLines,n as isOnCurrentSlide,t as syncWithFragments};