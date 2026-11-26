// ---------- Tratativa dos dados: perfilagem -> topografia -> azimute -> tratado, por leque e por realce ----------
// Tudo sai do checklist: o furo obstruído/detonado não conta (100% = tudo que dava para fazer).
function estadoTratativaLeque(c){
  const fs = checklistFurosDoLeque(c.id), uteis = fs.filter(f=>!f.obstruido);
  const tem = uteis.length > 0;
  const perf = tem && uteis.every(f=>f.perfilado), topo = tem && uteis.every(f=>f.topografado);
  const semAz = uteis.filter(f=> !furoTemAzimute(f));
  const az = tem && semAz.length === 0;
  const tratado = !!c.tratado, liberado = !!c.liberado;
  const completo = tem && perf && topo;
  return { c, tem, uteis: uteis.length, perf, topo, az, semAz: semAz.length, tratado, liberado, completo, pronto: !tratado && (completo || liberado),
    feitos: { perf: uteis.filter(f=>f.perfilado).length, topo: uteis.filter(f=>f.topografado).length } };
}
// Libera o leque para tratar mesmo sem completar as etapas (furo obstruído, falta dado etc.).
function liberarLequeTratamento(id, valor){
  const c = checklistLeques.find(x=>x.id===id); if(!c) return;
  const v = valor !== false;
  c.liberado = v; c.liberadoEm = v ? new Date().toISOString() : null; c.liberadoPor = v ? nomeDoUsuario() : '';
  enfileirar('checklist_leques', 'update', { id: c.id, liberado_tratamento: v, liberado_em: c.liberadoEm, liberado_por: v ? c.liberadoPor : null });
  salvarChecklistLocal();
  if(typeof renderAll === 'function') renderAll(); else renderChecklist();
  showToast(`${codigoLequeCk(c)} ${v ? 'liberado: entrou em Prontos para tratar' : 'saiu de Prontos para tratar'}.`, { tipo:'ok', acaoLabel:'Desfazer', onAcao: ()=> liberarLequeTratamento(id, !v) });
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
  if(e.pronto) return `<div class="trat-faixa pronto"><span>● Pronto para tratar${e.liberado && !e.completo ? ' · liberado manualmente' : e.az ? '' : ' · falta azimute em ' + e.semAz}</span><button type="button" class="steel" onclick="event.stopPropagation(); marcarLequeTratado('${c.id}')">Marcar tratado</button></div>`;
  return '';
}
const TRAT_ETAPAS = [['perf','1','Perfilagem','#1f8a4c'], ['topo','2','Topografia','#1f63b0'], ['az','3','Azimute','#8a5cc2'], ['tratado','4','Tratado','#0f7d78']];
// ---- Tabela densa (computador): uma linha por leque, ordenável, com filtro por situação ----
const tratTab = { filtro:'todos', ordem:'leque', dir:1 };
const TRAT_SIT = { pendente:'Pendente', andamento:'Em andamento', pronto:'Pronto p/ tratar', tratado:'Tratado' };
const situacaoLeque = e=> e.tratado ? 'tratado' : e.pronto ? 'pronto' : (e.perf || e.topo || e.feitos.perf || e.feitos.topo) ? 'andamento' : 'pendente';
function ordenarTratativa(k){ if(tratTab.ordem === k) tratTab.dir = -tratTab.dir; else { tratTab.ordem = k; tratTab.dir = 1; } renderTratativa(); }
function filtrarTratativa(f){ tratTab.filtro = f; renderTratativa(); }
function tabelaTratativa(a, es){
  if(tratTab.filtro === 'pronto') tratTab.filtro = 'todos';
  const prontos = es.filter(e=>situacaoLeque(e) === 'pronto'), resto = es.filter(e=>situacaoLeque(e) !== 'pronto');
  const cont = { todos: resto.length }; ['andamento','pendente','tratado'].forEach(k=> cont[k] = resto.filter(e=>situacaoLeque(e) === k).length);
  const ordemSit = { andamento:1, pendente:2, tratado:3 };
  const val = {
    leque: e=> null, uteis: e=> e.uteis, perf: e=> e.feitos.perf, topo: e=> e.feitos.topo, az: e=> e.uteis - e.semAz,
    sit: e=> ordemSit[situacaoLeque(e)], data: e=> e.c.tratadoEm || ''
  }[tratTab.ordem];
  let linhas = resto.filter(e=> tratTab.filtro === 'todos' || situacaoLeque(e) === tratTab.filtro);
  if(tratTab.ordem !== 'leque') linhas = linhas.slice().sort((x,y)=>{ const p = val(x), q = val(y); return (p < q ? -1 : p > q ? 1 : 0) * tratTab.dir; });
  else if(tratTab.dir < 0) linhas = linhas.slice().reverse();
  const th = (k, rot, cls)=> `<th class="${cls || ''}" aria-sort="${tratTab.ordem === k ? (tratTab.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" onclick="ordenarTratativa('${k}')">${rot}<i>${tratTab.ordem === k ? (tratTab.dir > 0 ? '▲' : '▼') : ''}</i></button></th>`;
  const filtros = [['todos','Todos'], ['andamento','Em andamento'], ['pendente','Pendentes'], ['tratado','Tratados']]
    .map(([k, r])=> `<button type="button" class="trat-filtro ${tratTab.filtro === k ? 'on' : ''}" onclick="filtrarTratativa('${k}')">${r} <b>${cont[k]}</b></button>`).join('');
  const dt = (c)=> c.tratado && c.tratadoEm ? new Date(c.tratadoEm).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + (c.tratadoPor ? ' · ' + escHtml(c.tratadoPor) : '') : '—';
  const linha = e=>{ const sit = situacaoLeque(e), cod = escHtml(codigoLequeCk(e.c)), az = e.uteis - e.semAz;
    const dados = (e.tratado || e.pronto) ? `<button type="button" class="ghost trat-dados" onclick="abrirDadosLeque('${e.c.id}')" title="imagem, executado, desvio e observação de cada furo">📝 Dados</button> ` : '';
    const acao = dados + (e.tratado ? `<button type="button" class="ghost" onclick="marcarLequeTratado('${e.c.id}', false)">↩ Desfazer</button>`
      : e.pronto ? `${e.liberado && !e.completo ? `<button type="button" class="ghost" onclick="liberarLequeTratamento('${e.c.id}', false)" title="tira da lista de prontos">↩ Tirar</button> ` : ''}<button type="button" class="steel" onclick="marcarLequeTratado('${e.c.id}')">Tratado</button>`
      : `<button type="button" class="ghost" onclick="liberarLequeTratamento('${e.c.id}')" title="libera para tratar mesmo sem completar as etapas">Liberar p/ tratar</button>`);
    const n = (v)=> `<td class="num ${v >= e.uteis && e.uteis ? 'cheio' : ''}">${v}<small>/${e.uteis}</small></td>`;
    return `<tr class="sit-${sit}"><td><button type="button" class="trat-cod-t" onclick="abrirRealceNoChecklist('${a.id}','${e.c.id}')" title="abrir no checklist">${cod}</button></td>
      <td class="num">${e.uteis}</td>${n(e.feitos.perf)}${n(e.feitos.topo)}${n(az)}
      <td><span class="trat-sit ${sit}">${sit === 'pronto' ? (e.liberado && !e.completo ? 'Liberado (incompleto)' : e.az ? 'Azimute completo' : 'Falta azimute em ' + e.semAz) : TRAT_SIT[sit]}</span></td><td class="data">${dt(e.c)}</td><td class="acao">${acao}</td></tr>`; };
  const cab = (ordenavel)=> ordenavel ? `${th('leque','Leque')}${th('uteis','Furos','num')}${th('perf','Perfilados','num')}${th('topo','Topografados','num')}${th('az','Azimutes','num')}${th('sit','Situação')}${th('data','Tratado em')}<th></th>`
    : `<th><span>Leque</span></th><th class="num"><span>Furos</span></th><th class="num"><span>Perfilados</span></th><th class="num"><span>Topografados</span></th><th class="num"><span>Azimutes</span></th><th><span>Situação</span></th><th></th><th></th>`;
  const secProntos = prontos.length ? `<section class="trat-prontos-d" aria-label="Leques prontos para tratar"><div class="trat-prontos-d-topo"><h4>● Prontos para tratar <b>${prontos.length}</b></h4>
      <button type="button" class="steel" onclick="marcarProntosTratados('${a.id}')">Marcar ${prontos.length === 1 ? 'este leque como tratado' : 'os ' + prontos.length + ' como tratados'}</button></div>
      <div class="trat-tabela-rolagem"><table><thead><tr>${cab(false)}</tr></thead><tbody>${prontos.map(linha).join('')}</tbody></table></div></section>` : '';
  return `<div class="trat-tabela">${secProntos}<div class="trat-filtros" role="group" aria-label="Filtrar os demais leques"><span class="trat-filtros-t">Demais leques</span>${filtros}</div>
    <div class="trat-tabela-rolagem"><table><thead><tr>${cab(true)}</tr></thead>
    <tbody>${linhas.map(linha).join('') || '<tr><td colspan="8" class="vazio">Nenhum leque neste filtro.</td></tr>'}</tbody></table></div></div>`;
}
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
    const tabela = tabelaTratativa(a, es);
    const tratados = es.filter(e=>e.tratado);
    const dtTrat = c=> c.tratadoEm ? new Date(c.tratadoEm).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '';
    const listaTratados = tratados.length ? `<section class="trat-tratados" aria-label="Leques tratados"><h4>✓ Leques tratados (${tratados.length})</h4>${tratados.map(e=>`<div class="trat-linha-tr"><b>${escHtml(codigoLequeCk(e.c))}</b><span>${dtTrat(e.c)}${e.c.tratadoPor ? ' · ' + escHtml(e.c.tratadoPor) : ''}</span><button type="button" class="ghost trat-dados-m" onclick="abrirDadosLeque('${e.c.id}')" aria-label="Dados do leque" title="dados do leque">📝</button><button type="button" class="ghost" onclick="marcarLequeTratado('${e.c.id}', false)" title="tira o leque de tratado e volta para a lista de pendentes">↩ Desfazer tratado</button></div>`).join('')}</section>` : '';
    const chips = es.map(e=>{ const cod = codigoLequeCk(e.c); const cl = e.tratado ? 'tratado' : e.pronto ? 'pronto' : (e.perf || e.topo || e.feitos.perf || e.feitos.topo) ? 'parcial' : '';
      return `<button type="button" class="trat-chip ${cl}" onclick="abrirRealceNoChecklist('${a.id}','${e.c.id}')" title="${e.tratado ? 'tratado' : e.pronto ? 'pronto para tratar' : 'ver no checklist'}">${escHtml(cod)}${e.tratado ? ' ✓' : ''}</button>`; }).join('');
    const listaProntos = prontos.length ? `<div class="trat-prontos"><div class="trat-prontos-t"><b>Prontos para tratar (${prontos.length})</b><button type="button" class="ghost" onclick="marcarProntosTratados('${a.id}')">Marcar todos</button></div>${prontos.map(e=>`<div class="trat-pronto"><button type="button" class="trat-cod" onclick="abrirRealceNoChecklist('${a.id}','${e.c.id}')">${escHtml(codigoLequeCk(e.c))}</button><span>${e.uteis} furos<small class="${e.az ? 'az-ok' : 'az-falta'}">${e.liberado && !e.completo ? 'liberado · perf ' + e.feitos.perf + '/' + e.uteis + ' · topo ' + e.feitos.topo + '/' + e.uteis + ' · ' : ''}azimute ${e.uteis - e.semAz}/${e.uteis}</small></span><button type="button" class="ghost trat-dados-m" onclick="abrirDadosLeque('${e.c.id}')" aria-label="Dados do leque" title="dados do leque">📝</button><button type="button" class="steel" onclick="marcarLequeTratado('${e.c.id}')">Tratado</button></div>`).join('')}</div>` : '';
    return `<section class="trat-card"><header><div><b>${escHtml(a.nome)}</b><small>${escHtml(a.nivel || '')}${a.nivel && a.orientacao ? ' · ' : ''}${a.orientacao === 'ascendente' ? '↑ Ascendente' : a.orientacao === 'descendente' ? '↓ Descendente' : ''}</small></div><button type="button" class="ghost" onclick="abrirRealceNoChecklist('${a.id}')">Checklist ›</button></header>
      <div class="trat-corpo"><div class="trat-lado"><div class="trat-acoes-card"><button type="button" class="steel" onclick="abrirRelatorio2D('${a.id}')" title="PDF: imagem geral dos leques e, por leque, imagem + tabela de furos">📐 Relatório 2D</button><button type="button" class="ghost" onclick="abrirAndamentoRealce('${a.id}')" title="resumo do andamento deste realce para passar à equipe (PDF, texto ou WhatsApp)">📊 Andamento</button></div>
      <label class="trat-arq ${a.arquivosOk ? 'ok' : ''}"><input type="checkbox" ${a.arquivosOk ? 'checked' : ''} onchange="alternarArquivosRealce('${a.id}', this.checked)"><span><b>${a.arquivosOk ? '✓ Arquivos do realce recebidos' : 'Arquivos do realce ainda não recebidos'}</b>${a.arquivosOk && a.arquivosOkEm ? `<small>${new Date(a.arquivosOkEm).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}${a.arquivosOkPor ? ' · ' + escHtml(a.arquivosOkPor) : ''}</small>` : '<small>marque quando tiver os arquivos</small>'}</span></label>
      ${n ? `<div class="trat-linhas">${linhas}</div>` : ''}</div><div class="trat-main">${n ? `${tabela}${listaProntos}${listaTratados}<div class="trat-leques-t">Todos os leques</div><div class="trat-chips" role="group" aria-label="Leques do realce">${chips}</div><div class="trat-leg"><span><i class="l-nada"></i>pendente</span><span><i class="l-parcial"></i>em andamento</span><span><i class="l-pronto"></i>pronto p/ tratar</span><span><i class="l-tratado"></i>tratado</span></div>` : '<div class="hint">Sem leques neste realce ainda.</div>'}</div></div></section>`;
  }).join('');
  root.innerHTML = `<div class="trat-topo"><h2>Tratativa dos dados</h2><button type="button" class="ghost trat-export" onclick="abrirExportarTratativa()" title="PDF ou planilha com os leques tratados: metros e data">⬇ Exportar relatório</button>${prontosTot ? `<span class="trat-badge">${prontosTot} ${prontosTot === 1 ? 'leque pronto' : 'leques prontos'} para tratar</span>` : '<span class="trat-badge nada">nada pronto agora</span>'}</div>
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

function alternarArquivosRealce(id, valor){
  const a = aneis.find(x=>x.id === id); if(!a) return;
  a.arquivosOk = !!valor; a.arquivosOkEm = valor ? new Date().toISOString() : null; a.arquivosOkPor = valor ? nomeDoUsuario() : '';
  enfileirar('aneis', 'update', { id: a.id, arquivos_ok: a.arquivosOk, arquivos_ok_em: a.arquivosOkEm, arquivos_ok_por: valor ? a.arquivosOkPor : null });
  salvarLocal(); renderAll();
  showToast(valor ? `Arquivos de "${a.nome}" marcados como recebidos.` : `Arquivos de "${a.nome}" voltaram para não recebidos.`, { tipo:'ok' });
}
