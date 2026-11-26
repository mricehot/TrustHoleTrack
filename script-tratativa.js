// ---------- Tratativa dos dados: perfilagem -> topografia -> azimute -> tratado, por leque e por realce ----------
// Tudo sai do checklist: o furo obstruído/detonado não conta (100% = tudo que dava para fazer).
function estadoTratativaLeque(c){
  const fs = checklistFurosDoLeque(c.id), uteis = fs.filter(f=>!f.obstruido);
  const tem = uteis.length > 0;
  const perf = tem && uteis.every(f=>f.perfilado), topo = tem && uteis.every(f=>f.topografado);
  const semAz = uteis.filter(f=> !furoTemAzimute(f));
  const az = tem && semAz.length === 0;
  const tratado = !!c.tratado;
  return { c, tem, uteis: uteis.length, perf, topo, az, semAz: semAz.length, tratado, pronto: tem && perf && topo && !tratado,
    feitos: { perf: uteis.filter(f=>f.perfilado).length, topo: uteis.filter(f=>f.topografado).length } };
}
function marcarLequeTratado(id, valor){
  const c = checklistLeques.find(x=>x.id===id); if(!c) return;
  const v = valor !== false, antes = !!c.tratado;
  c.tratado = v; c.tratadoEm = v ? new Date().toISOString() : null; c.tratadoPor = v ? nomeDoUsuario() : '';
  enfileirar('checklist_leques', 'update', { id: c.id, tratado: v, tratado_em: c.tratadoEm, tratado_por: v ? c.tratadoPor : null });
  salvarChecklistLocal();
  if(typeof renderAll === 'function') renderAll(); else renderChecklist();
  showToast(`${codigoLequeCk(c)} ${v ? 'marcado como tratado' : 'voltou para pendente'}.`, { tipo:'ok', acaoLabel:'Desfazer', onAcao: ()=> marcarLequeTratado(id, !v) });
}
function marcarProntosTratados(anelId){
  const prontos = checklistLeques.filter(c=>c.anelId === anelId).map(estadoTratativaLeque).filter(e=>e.pronto);
  if(!prontos.length) return;
  if(!confirm(`Marcar ${prontos.length} ${prontos.length === 1 ? 'leque' : 'leques'} como tratado${prontos.length === 1 ? '' : 's'}?`)) return;
  prontos.forEach(e=>{ const c = e.c; c.tratado = true; c.tratadoEm = new Date().toISOString(); c.tratadoPor = nomeDoUsuario();
    enfileirar('checklist_leques', 'update', { id: c.id, tratado: true, tratado_em: c.tratadoEm, tratado_por: c.tratadoPor }); });
  salvarChecklistLocal(); renderAll();
  showToast(`${prontos.length} marcados como tratados.`, { tipo:'ok' });
}
function abrirRealceNoChecklist(anelId, lequeId){
  if(anelId !== anelAtivoId && typeof definirAnelAtivo === 'function') definirAnelAtivo(anelId);
  if(lequeId) checklistExpandido.add(lequeId);
  mostrarView('checklist'); renderChecklist();
  if(lequeId) setTimeout(()=>{ const el = document.querySelector(`.checklist-leque-card[data-id="${lequeId}"]`); if(el) el.scrollIntoView({ block:'center' }); }, 120);
}
// Selo dentro do cartão do leque no checklist
function htmlTratadoLeque(c){
  const e = estadoTratativaLeque(c);
  if(e.tratado) return `<div class="trat-faixa ok"><span>✓ Tratado${c.tratadoPor ? ' por ' + escHtml(c.tratadoPor) : ''}</span><button type="button" class="ghost" onclick="event.stopPropagation(); marcarLequeTratado('${c.id}', false)">Desfazer</button></div>`;
  if(e.pronto) return `<div class="trat-faixa pronto"><span>● Pronto para tratar${e.az ? '' : ' · falta azimute em ' + e.semAz}</span><button type="button" class="steel" onclick="event.stopPropagation(); marcarLequeTratado('${c.id}')">Marcar tratado</button></div>`;
  return '';
}
const TRAT_ETAPAS = [['perf','1','Perfilagem','#1f8a4c'], ['topo','2','Topografia','#1f63b0'], ['az','3','Azimute','#8a5cc2'], ['tratado','4','Tratado','#0f7d78']];
function realcesDaTratativa(){
  if(typeof carregarFavoritosRealces === 'function') carregarFavoritosRealces();
  const favs = aneis.filter(a=>realcesFavoritos.has(a.id));
  if(favs.length) return { lista: favs, fallback:false };
  const at = aneis.find(a=>a.id === anelAtivoId);
  return { lista: at ? [at] : [], fallback:true };
}
function renderTratativa(){
  const view = document.getElementById('view-perfilagem'); if(!view) return;
  let root = document.getElementById('tratativa-root');
  if(!root){ root = document.createElement('div'); root.id = 'tratativa-root'; view.insertBefore(root, view.firstChild); view.classList.add('com-tratativa'); }
  const { lista, fallback } = realcesDaTratativa();
  if(!lista.length){ root.innerHTML = '<div class="trat-vazio">Nenhum realce ainda. Crie um na aba Realce.</div>'; return; }
  const ord = (a,b)=> (PREFIXO[a.c.tipo]+a.c.numero).localeCompare(PREFIXO[b.c.tipo]+b.c.numero, undefined, { numeric:true });
  const dados = lista.map(a=>{ const es = checklistLeques.filter(c=>c.anelId === a.id).map(estadoTratativaLeque).sort(ord); return { a, es }; });
  const prontosTot = dados.reduce((s,d)=> s + d.es.filter(e=>e.pronto).length, 0);
  const cartoes = dados.map(({a, es})=>{
    const n = es.length, cont = { perf: es.filter(e=>e.perf).length, topo: es.filter(e=>e.topo).length, az: es.filter(e=>e.az).length, tratado: es.filter(e=>e.tratado).length };
    const linhas = TRAT_ETAPAS.map(([k, num, rot, cor])=>{ const v = cont[k], pct = n ? Math.round(v / n * 100) : 0;
      return `<div class="trat-linha"><span class="trat-rot"><i style="background:${cor}">${num}</i>${rot}</span><div class="trat-bar"><i style="width:${pct}%;background:${cor}"></i></div><b>${v}/${n}</b></div>`; }).join('');
    const prontos = es.filter(e=>e.pronto);
    const tratados = es.filter(e=>e.tratado);
    const dtTrat = c=> c.tratadoEm ? new Date(c.tratadoEm).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '';
    const listaTratados = tratados.length ? `<details class="trat-tratados"><summary>Tratados (${tratados.length}) · toque para ver ou voltar</summary>${tratados.map(e=>`<div class="trat-linha-tr"><b>${escHtml(codigoLequeCk(e.c))}</b><span>${dtTrat(e.c)}${e.c.tratadoPor ? ' · ' + escHtml(e.c.tratadoPor) : ''}</span><button type="button" class="ghost" onclick="marcarLequeTratado('${e.c.id}', false)">Voltar para pendente</button></div>`).join('')}</details>` : '';
    const chips = es.map(e=>{ const cod = codigoLequeCk(e.c); const cl = e.tratado ? 'tratado' : e.pronto ? 'pronto' : (e.perf || e.topo || e.feitos.perf || e.feitos.topo) ? 'parcial' : '';
      return `<button type="button" class="trat-chip ${cl}" onclick="abrirRealceNoChecklist('${a.id}','${e.c.id}')" title="${e.tratado ? 'tratado' : e.pronto ? 'pronto para tratar' : 'ver no checklist'}">${escHtml(cod)}${e.tratado ? ' ✓' : ''}</button>`; }).join('');
    const listaProntos = prontos.length ? `<div class="trat-prontos"><div class="trat-prontos-t"><b>Prontos para tratar (${prontos.length})</b><button type="button" class="ghost" onclick="marcarProntosTratados('${a.id}')">Marcar todos</button></div>${prontos.map(e=>`<div class="trat-pronto"><button type="button" class="trat-cod" onclick="abrirRealceNoChecklist('${a.id}','${e.c.id}')">${escHtml(codigoLequeCk(e.c))}</button><span>${e.uteis} furos<small class="${e.az ? 'az-ok' : 'az-falta'}">azimute ${e.uteis - e.semAz}/${e.uteis}</small></span><button type="button" class="steel" onclick="marcarLequeTratado('${e.c.id}')">Tratado</button></div>`).join('')}</div>` : '';
    return `<section class="trat-card"><header><div><b>${escHtml(a.nome)}</b><small>${escHtml(a.nivel || '')}${a.nivel && a.orientacao ? ' · ' : ''}${a.orientacao === 'ascendente' ? '↑ Ascendente' : a.orientacao === 'descendente' ? '↓ Descendente' : ''}</small></div><button type="button" class="ghost" onclick="abrirRealceNoChecklist('${a.id}')">Checklist ›</button></header>
      ${n ? `<div class="trat-linhas">${linhas}</div>${listaProntos}${listaTratados}<div class="trat-leques-t">Todos os leques</div><div class="trat-chips" role="group" aria-label="Leques do realce">${chips}</div><div class="trat-leg"><span><i class="l-nada"></i>pendente</span><span><i class="l-parcial"></i>em andamento</span><span><i class="l-pronto"></i>pronto p/ tratar</span><span><i class="l-tratado"></i>tratado</span></div>` : '<div class="hint">Sem leques neste realce ainda.</div>'}</section>`;
  }).join('');
  root.innerHTML = `<div class="trat-topo"><h2>Tratativa dos dados</h2>${prontosTot ? `<span class="trat-badge">${prontosTot} ${prontosTot === 1 ? 'leque pronto' : 'leques prontos'} para tratar</span>` : '<span class="trat-badge nada">nada pronto agora</span>'}</div>
    ${fallback ? '<div class="hint trat-dica">Nenhum realce favoritado: mostrando o realce ativo. Toque na ⭐ na aba Realce para fixar os que você trata.</div>' : ''}${cartoes}`;
}
aoRenderizarTudo(renderTratativa);
aoRenderizarChecklist(renderTratativa);

// Número na aba Tratamento: leques prontos para tratar (perfilados + topografados, ainda não tratados)
// nos realces favoritados (ou no ativo, se não houver favoritos).
function atualizarContadorAbaTratamento(){
  const aba = document.querySelector('.tab-item[data-view="perfilagem"]'); if(!aba) return;
  let n = 0;
  try{
    const ids = new Set(realcesDaTratativa().lista.map(a=>a.id));
    n = checklistLeques.filter(c=>ids.has(c.anelId)).filter(c=>estadoTratativaLeque(c).pronto).length;
  }catch(e){}
  let sel = aba.querySelector('.tab-badge');
  if(!sel){ sel = document.createElement('span'); sel.className = 'tab-badge tab-badge-trat'; aba.querySelector('.tab-icon').appendChild(sel); }
  sel.textContent = n > 99 ? '99+' : String(n);
  sel.hidden = n === 0;
  aba.setAttribute('aria-label', n ? `Tratamento, ${n} leque(s) pronto(s) para tratar` : 'Tratamento');
}
aoRenderizarTudo(atualizarContadorAbaTratamento);
aoRenderizarChecklist(atualizarContadorAbaTratamento);

// Ao abrir a aba Tratamento, desenha na hora (sem depender de um renderAll anterior).
(function(){
  const orig = window.mostrarView;
  if(typeof orig !== 'function') return;
  window.mostrarView = function(v){ const r = orig.apply(this, arguments); if(v === 'perfilagem'){ try{ renderTratativa(); }catch(e){} } return r; };
})();
