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

// ---------- Efeitos do Infográfico ----------
// Sutis e rápidos (≤ ~1s), no mesmo estilo do checklist: números contam, barras enchem, gráficos se desenham.
// Só rodam quando o dado muda ou a tela é aberta de novo; respeitam "reduzir movimento".
(function(){
  const IDS_NUM = ['metros-hoje','metros-semana','metros-mes','metros-ant','topo-hoje','topo-semana','topo-mes','topo-ant'];
  const BARRAS = ['perfilado','topografado'];
  const GRAFS = ['infografico-chart-dia','infografico-chart-perf-dia','infografico-chart-topo-dia'];
  const ult = {}; // última assinatura animada por elemento
  window.__infoReset = ()=>{ for(const k in ult) delete ult[k]; };

  function contar(id, destino){
    const e = document.getElementById(id); if(!e) return;
    const tn = [...e.childNodes].find(n=> n.nodeType === 3); if(!tn) return;
    const txt = tn.data.trim(), novo = parseFloat(txt.replace(',', '.'));
    if(isNaN(novo) || ult[id] === txt) return;
    const casas = (txt.split(/[.,]/)[1] || '').length, primeira = ult[id] === undefined, antigo = primeira ? novo : parseFloat(String(ult[id]).replace(',', '.'));
    ult[id] = txt;
    if(primeira || novo === antigo || semMovimento()) return; // na abertura da aba a contagem já é feita por animarEntradaDaAba
    const ms = 700, ini = performance.now(), tok = (e._tokInfo = (e._tokInfo || 0) + 1);
    const fmt = v => casas ? v.toFixed(casas).replace('.', ',') : String(Math.round(v));
    const passo = agora=>{
      if(tok !== e._tokInfo || !e.isConnected) return;
      const t = Math.min(1, (agora - ini) / ms), k = 1 - Math.pow(1 - t, 3);
      tn.data = fmt(antigo + (novo - antigo) * k);
      if(t < 1) requestAnimationFrame(passo);
      else { tn.data = txt; e.animate([{ filter:'brightness(1.5)' }, { filter:'brightness(1)' }], { duration:450 }); }
    };
    tn.data = fmt(antigo); requestAnimationFrame(passo);
  }

  function barra(nome){
    const b = document.getElementById('infografico-pct-' + nome + '-barra'); if(!b) return;
    const alvo = b.style.width, chave = 'barra-' + nome;
    if(ult[chave] === alvo) return;
    const primeira = ult[chave] === undefined, de = primeira ? '0%' : ult[chave];
    ult[chave] = alvo;
    if(semMovimento()) return;
    if(!primeira) b.animate([{ width:de }, { width:alvo }], { duration:800, easing:'cubic-bezier(.2,.7,.2,1)' }); // na abertura, quem enche a barra é animarEntradaDaAba
    if(parseFloat(alvo) >= 100) setTimeout(()=> b.isConnected && b.animate([{ boxShadow:'0 0 0 0 rgba(46,155,87,0)' }, { boxShadow:'0 0 10px 2px rgba(46,155,87,.55)' }, { boxShadow:'0 0 0 0 rgba(46,155,87,0)' }], { duration:900 }), 750);
  }

  function grafico(id){
    const svg = document.getElementById(id); if(!svg) return;
    const linha = svg.querySelector('path[data-exp="linha"]'); if(!linha) return;
    const sig = linha.getAttribute('d'); if(ult[id] === sig) return;
    ult[id] = sig;
    if(semMovimento()) return;
    const area = linha.previousElementSibling, pts = [...svg.querySelectorAll('circle[data-exp]')];
    try{
      const c = linha.getTotalLength();
      linha.animate([{ strokeDasharray:c + ' ' + c, strokeDashoffset:c }, { strokeDasharray:c + ' ' + c, strokeDashoffset:0 }], { duration:900, easing:'cubic-bezier(.3,.6,.3,1)' });
    }catch(e){}
    if(area) area.animate([{ opacity:0 }, { opacity:1 }], { duration:900, easing:'ease-in' });
    pts.forEach((p, i)=> p.animate([{ opacity:0, transform:'scale(.2)', transformBox:'fill-box', transformOrigin:'center' }, { opacity:1, transform:'scale(1)', transformBox:'fill-box', transformOrigin:'center' }], { duration:260, delay:350 + i * 35, fill:'backwards', easing:'ease-out' }));
    svg.querySelectorAll('text[data-exp="valor"]').forEach(t=> t.animate([{ opacity:0 }, { opacity:1 }], { duration:300, delay:850, fill:'backwards' }));
  }

  const orig = window.renderInfograficoResumo;
  if(typeof orig === 'function'){
    window.renderInfograficoResumo = function(){
      const r = orig.apply(this, arguments);
      try{ document.querySelectorAll('#view-infografico .infografico-kpi').forEach(k=>{ const v = k.querySelector('.valor'); k.classList.toggle('fx-ativo', !!v && parseFloat(v.textContent.replace(',', '.')) > 0); });
        BARRAS.forEach(n=>{ const b = document.getElementById('infografico-pct-' + n + '-barra'); if(b) b.classList.toggle('cheio', parseFloat(b.style.width) >= 100); }); }catch(e){}
      try{ IDS_NUM.forEach(n=> contar('infografico-' + n)); BARRAS.forEach(barra); GRAFS.forEach(grafico); }catch(e){}
      return r;
    };
  }
  // Ao voltar para a aba, as animações rodam de novo.
  const om = window.mostrarView;
  if(typeof om === 'function'){
    window.mostrarView = function(v){ if(v === 'infografico') window.__infoReset(); return om.apply(this, arguments); };
  }
})();
