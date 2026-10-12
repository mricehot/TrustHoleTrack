// ---------- Conforto de uso: teclado numérico, contador de metragens, menu do furo (toque longo), barra fixa do leque ----------

// 1) Campos de número: teclado numérico certo, conteúdo selecionado ao tocar e "próximo" no teclado.
document.addEventListener('focusin', ev=>{
  const i = ev.target;
  if(!i || i.tagName !== 'INPUT') return;
  const nomes = ((i.id || '') + ' ' + (i.getAttribute('aria-label') || '')).toLowerCase();
  const ehNumero = i.type === 'number' || i.inputMode === 'numeric' || i.inputMode === 'decimal'
    || /(^|[-_ ])(esperada|real|dias|furo-de|furo-ate|numero-de|numero-ate)([-_ ]|$)/.test(nomes) || i.id === 'leque-numero' || i.id === 'furo-numero';
  if(!ehNumero || i.type === 'checkbox') return;
  if(!i.inputMode) i.inputMode = /esperada|real|metrag/.test(nomes) ? 'decimal' : 'numeric';
  if(!i.enterKeyHint) i.enterKeyHint = 'next';
  try{ if(i.value) i.select(); }catch(e){}
});

// 2) Contador "X de Y furos com metragem" no topo da Perfilagem.
function garantirContadorMetragem(){
  let c = document.getElementById('perf-contador');
  if(c) return c;
  const viz = document.getElementById('view-perfilagem'); if(!viz) return null;
  c = document.createElement('div'); c.id = 'perf-contador'; c.className = 'perf-contador'; c.hidden = true; c.setAttribute('role', 'status');
  const ref = viz.querySelector('.perf-plano') || viz.firstElementChild;
  viz.insertBefore(c, ref ? ref.nextSibling : null);
  return c;
}
function atualizarContadorMetragem(){
  const c = garantirContadorMetragem(); if(!c) return;
  const ls = leques.filter(l=>l.anelId === anelAtivoId);
  const ids = new Set(ls.map(l=>l.id));
  const uteis = furos.filter(f=> ids.has(f.lequeId) && f.situacao !== 'obstruido');
  if(!uteis.length){ c.hidden = true; return; }
  const feitos = uteis.filter(f=> Number(f.metragemReal) > 0).length;
  const faltam = uteis.length - feitos, pct = Math.round(feitos / uteis.length * 100);
  c.hidden = false;
  c.dataset.completo = faltam === 0 ? '1' : '0';
  c.innerHTML = `<div class="pc-linha"><span class="pc-rot">📏 Metragem real</span><b>${feitos} de ${uteis.length}</b><span class="pc-falta">${faltam ? `faltam ${faltam}` : '✓ todas preenchidas'}</span></div><div class="pc-barra"><i style="width:${pct}%"></i></div>`;
}

// 3) Toque longo no número do furo: menu rápido (marcar, observação, foto, equipe).
let lpTimer = null, lpIni = null, lpSuprimirAte = 0;
function idFuroDoBotao(btn){ const m = /alternarEquipeFuro\('([^']+)'\)/.exec(btn.getAttribute('onclick') || ''); return m ? m[1] : null; }
document.addEventListener('pointerdown', ev=>{
  const b = ev.target.closest && ev.target.closest('.ck-furo-num'); if(!b) return;
  const id = idFuroDoBotao(b); if(!id) return;
  lpIni = { x: ev.clientX, y: ev.clientY };
  clearTimeout(lpTimer);
  lpTimer = setTimeout(()=>{ lpTimer = null; lpSuprimirAte = Date.now() + 700; if(typeof vibrarCurto === 'function') vibrarCurto(20); abrirMenuFuro(id); }, 520);
}, true);
['pointerup', 'pointercancel', 'pointerleave'].forEach(t=> document.addEventListener(t, ()=>{ clearTimeout(lpTimer); lpTimer = null; }, true));
document.addEventListener('pointermove', ev=>{ if(lpTimer && lpIni && Math.hypot(ev.clientX - lpIni.x, ev.clientY - lpIni.y) > 10){ clearTimeout(lpTimer); lpTimer = null; } }, true);
document.addEventListener('click', ev=>{ if(Date.now() < lpSuprimirAte && ev.target.closest && ev.target.closest('.ck-furo-num')){ ev.stopPropagation(); ev.preventDefault(); } }, true);
document.addEventListener('contextmenu', ev=>{ if(ev.target.closest && ev.target.closest('.ck-furo-num')) ev.preventDefault(); });

function abrirMenuFuro(id){
  const f = checklistFuros.find(x=>x.id===id); if(!f) return;
  const c = checklistLeques.find(x=>x.id===f.checklistLequeId);
  const cod = c ? (PREFIXO[c.tipo] || '') + c.numero : '';
  const tem = !!(f.fotoUrl || (typeof fotosPendentes !== 'undefined' && fotosPendentes.has(f.id)));
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box menu-furo">
    <p style="font-weight:700;">${escHtml(cod)} · F${escHtml(String(f.numero))}</p>
    <div class="mf-grade">
      <button type="button" data-a="perf" ${f.obstruido ? 'disabled' : ''}>${f.perfilado ? '↩ Desmarcar perfilado' : '✓ Perfilado'}</button>
      <button type="button" data-a="topo" ${f.obstruido ? 'disabled' : ''}>${f.topografado ? '↩ Desmarcar topografado' : '✓ Topografado'}</button>
      <button type="button" data-a="obs">${f.obstruido ? '↩ Liberar furo' : '⛔ Obstruído'}</button>
      <button type="button" data-a="nota">📝 ${f.observacao ? 'Editar anotação' : 'Anotação'}</button>
      <button type="button" data-a="foto">📷 ${tem ? 'Ver foto' : 'Tirar foto'}</button>
      <button type="button" data-a="equipe">👥 Equipe do furo</button>
    </div>
    <div class="modal-actions"><button class="ghost" id="mf-fechar">Fechar</button></div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('mf-fechar').onclick = fechar;
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  root.querySelector('.mf-grade').addEventListener('click', e=>{
    const b = e.target.closest('button[data-a]'); if(!b || b.disabled) return;
    fechar();
    const a = b.dataset.a;
    if(a === 'perf') toggleChecklistFuro(id);
    else if(a === 'topo') toggleChecklistFuroTopografado(id);
    else if(a === 'obs') definirObstrucaoChecklistFuro(id, f.obstruido ? '' : OBSTRUIDO_VALOR);
    else if(a === 'nota') editarObservacaoFuro(id);
    else if(a === 'foto') (tem ? verFotoFuro : tirarFotoFuro)(id);
    else if(a === 'equipe') alternarEquipeFuro(id);
  });
}

// 4) Barra fixa no leque aberto: marca o próximo furo pendente sem rolar até ele.
function marcarProximoPendente(lequeId, campo){
  const lista = checklistFurosDoLeque(lequeId);
  const prox = lista.find(f=> !f.obstruido && !f[campo]);
  if(!prox){ showToast('Nenhum furo pendente neste leque.', { tipo:'aviso' }); return; }
  if(campo === 'perfilado') toggleChecklistFuro(prox.id); else toggleChecklistFuroTopografado(prox.id);
}
function injetarBarrasFixas(){
  document.querySelectorAll('.checklist-leque-card').forEach(card=>{
    const corpo = card.querySelector('.ck-corpo'); if(!corpo) return;
    card.querySelectorAll('.ck-barra-fixa').forEach(b=>b.remove());
    const id = (card.id || '').replace(/^ck-card-/, '');
    const fl = checklistFurosDoLeque(id); if(!fl.length) return;
    const uteis = fl.filter(f=>!f.obstruido);
    const nP = uteis.filter(f=>f.perfilado).length, nT = uteis.filter(f=>f.topografado).length;
    const c = checklistLeques.find(x=>x.id===id);
    const barra = document.createElement('div'); barra.className = 'ck-barra-fixa';
    barra.innerHTML = `<span class="bf-cod">${escHtml(c ? (PREFIXO[c.tipo] || '') + c.numero : '')}</span>
      <button type="button" class="bf-per" ${nP >= uteis.length ? 'disabled' : ''} onclick="marcarProximoPendente('${id}','perfilado')"><span>✓ Próx. perfilado</span><small>${nP}/${uteis.length}</small></button>
      <button type="button" class="bf-top" ${nT >= uteis.length ? 'disabled' : ''} onclick="marcarProximoPendente('${id}','topografado')"><span>✓ Próx. topografado</span><small>${nT}/${uteis.length}</small></button>`;
    corpo.appendChild(barra);
  });
}

(function(){
  const orig = renderChecklist;
  renderChecklist = function(){ const r = orig.apply(this, arguments); try{ injetarBarrasFixas(); }catch(e){} return r; };
  const origAll = renderAll;
  renderAll = function(){ const r = origAll.apply(this, arguments); try{ atualizarContadorMetragem(); }catch(e){} return r; };
  const origSalvar = salvarMetragemInline;
  salvarMetragemInline = function(){ const r = origSalvar.apply(this, arguments); try{ atualizarContadorMetragem(); }catch(e){} return r; };
})();
