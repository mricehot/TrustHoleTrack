// ---------- Envios da tratativa: data + metragem enviada, agrupado por mês (aba Tratamento) ----------
const ENVIOS_KEY = 'perfilagem-tratativa-envios-v1';
let tratativaEnvios = []; // { id, projeto, anelId, anelRotulo, data(YYYY-MM-DD), metragem, leques, observacao, criadoPor, ts }
let envioForm = null;     // null = fechado; { id?:string } = aberto (id = editando)
const enviosMesAberto = new Set();
try{ tratativaEnvios = JSON.parse(localStorage.getItem(ENVIOS_KEY) || '[]') || []; }catch(e){ tratativaEnvios = []; }
const salvarEnviosLocal = ()=>{ try{ localStorage.setItem(ENVIOS_KEY, JSON.stringify(tratativaEnvios)); }catch(e){} };
function mapEnvio(r){ return { id:r.id, projeto:r.projeto || '', anelId:r.anel_id || '', anelRotulo:r.anel_rotulo || '', data:String(r.data || '').slice(0,10), metragem:Number(r.metragem) || 0, leques:r.leques || '', lequeIds:Array.isArray(r.leque_ids) ? r.leque_ids : [], observacao:r.observacao || '', criadoPor:r.criado_por || '', ts:r.criado_em || '' }; }
const envioNoEscopo = e => { const pr = typeof configApp !== 'undefined' ? configApp.projetoAtivo : ''; return !pr || !e.projeto || e.projeto === pr; };
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const rotuloMesEnvio = ym => { const m = MESES_PT[parseInt(ym.slice(5,7),10)-1]; return m.charAt(0).toUpperCase() + m.slice(1) + ' de ' + ym.slice(0,4); };
const fmtDiaEnvio = iso => iso.slice(8,10) + '/' + iso.slice(5,7);
const fmtMetEnvio = n => (Math.round(Number(n)*10)/10).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 });

function renderEnvios(){
  const view = document.getElementById('view-perfilagem'); if(!view) return;
  let root = document.getElementById('envios-root');
  if(!root){
    root = document.createElement('div'); root.id = 'envios-root';
    const t = document.getElementById('tratativa-root');
    if(t && t.nextSibling) view.insertBefore(root, t.nextSibling); else view.appendChild(root);
  }
  const e2 = escHtml;
  const lista = tratativaEnvios.filter(envioNoEscopo).sort((a,b)=> b.data.localeCompare(a.data) || String(b.ts).localeCompare(String(a.ts)));
  const meses = new Map();
  lista.forEach(e=>{ const ym = e.data.slice(0,7); if(!meses.has(ym)) meses.set(ym, []); meses.get(ym).push(e); });
  // Os METROS do mês vêm dos leques TRATADOS; os envios são só para consulta. Meses com tratados aparecem mesmo sem envio.
  const tratMes = new Map();
  const mesesTrat = new Set();
  if(typeof dadosFechamentoMensal === 'function'){
    const escopoIds = aneis.filter(a=> !configApp.projetoAtivo || !a.projeto || a.projeto === configApp.projetoAtivo).map(a=>a.id);
    dadosRelatorioTratativa(escopoIds).realces.forEach(r=> r.leques.forEach(l=>{ if(l.status === 'Tratado' && l.tratadoEm){ const ym = l.tratadoEm.slice(0,7); mesesTrat.add(ym);
      const o = tratMes.get(ym) || { itens:[], metros:0 }; o.itens.push({ realce:r.realce.nome, codigo:l.codigo, metros:metrosDoLeque(l), data:l.tratadoEm }); o.metros += metrosDoLeque(l); tratMes.set(ym, o); } }));
  }
  mesesTrat.forEach(ym=>{ if(!meses.has(ym)) meses.set(ym, []); });
  const mesesOrd = new Map([...meses.entries()].sort((a,b)=> b[0].localeCompare(a[0])));
  const ymHoje = dataISOLocal(new Date()).slice(0,7);
  if(!enviosMesAberto.size && mesesOrd.size) enviosMesAberto.add([...mesesOrd.keys()][0]);
  const blocos = [...mesesOrd.entries()].map(([ym, es])=>{
    const tm = tratMes.get(ym) || { itens:[], metros:0 }, aberto = enviosMesAberto.has(ym);
    const linhas = es.map(e=>`<li class="env-linha">
      <button type="button" class="env-info" onclick="abrirFormEnvio('${e.id}')" aria-label="Editar envio de ${fmtDiaEnvio(e.data)}">
        <b>${fmtDiaEnvio(e.data)}</b>
        <span class="env-desc">${e2(e.anelRotulo || 'Sem realce')}${e.leques ? ' · ' + e2(e.leques) : ''}${e.observacao ? '<small>' + e2(e.observacao) + '</small>' : ''}</span>
        ${e.metragem > 0 ? `<span class="env-m" title="informativo, não entra na soma do mês">${fmtMetEnvio(e.metragem)} m</span>` : ''}
      </button>
      <button type="button" class="env-del" onclick="removerEnvio('${e.id}')" aria-label="Apagar envio" title="Apagar">✕</button></li>`).join('');
    return `<section class="env-mes ${aberto ? 'aberto' : ''}">
      <div class="env-mes-topo">
      <button type="button" class="env-mes-cab" onclick="alternarMesEnvio('${ym}')" aria-expanded="${aberto}">
        <span class="env-seta">${aberto ? '▾' : '▸'}</span><b>${rotuloMesEnvio(ym)}${ym === ymHoje ? ' <i>(mês atual)</i>' : ''}</b>
        <span class="env-tot" title="soma dos metros dos leques tratados no mês">${fmtMetEnvio(tm.metros)} m <small>· ${tm.itens.length} ${tm.itens.length === 1 ? 'leque tratado' : 'leques tratados'}</small></span></button>
      <button type="button" class="env-exp" onclick="abrirExportarMes('${ym}')" title="exporta o fechamento de ${rotuloMesEnvio(ym)}: envios e leques tratados no mês" aria-label="Exportar ${rotuloMesEnvio(ym)}">⬇ Exportar</button></div>
      ${aberto ? `<div class="env-sub">Tratados no mês <small>(a soma vem daqui)</small></div>${tm.itens.length ? `<ul class="env-lista env-trat">${tm.itens.sort((a,b)=> String(a.data).localeCompare(String(b.data))).map(l=>`<li class="env-linha"><span class="env-info"><b>${fmtDiaEnvio(l.data.slice(0,10))}</b><span class="env-desc">${e2(l.realce)} · ${e2(l.codigo)}</span><span class="env-m">${fmtMetEnvio(l.metros)} m</span></span></li>`).join('')}</ul>` : '<div class="trat-vazio">Nenhum leque tratado neste mês.</div>'}
        <div class="env-sub">Enviados no mês <small>(só consulta)</small></div>${es.length ? `<ul class="env-lista">${linhas}</ul>` : '<div class="trat-vazio">Nenhum envio registrado.</div>'}` : ''}</section>`;
  }).join('');
  const f = envioForm, ed = f && f.id ? tratativaEnvios.find(x=>x.id === f.id) : null;
  const { lista: favs } = (typeof realcesDaTratativa === 'function') ? realcesDaTratativa() : { lista: [] };
  const ids = new Set(favs.map(a=>a.id));
  const realces = aneis.filter(a=>!configApp.projetoAtivo || !a.projeto || a.projeto === configApp.projetoAtivo)
    .sort((a,b)=> (ids.has(b.id) - ids.has(a.id)) || String(a.nome).localeCompare(String(b.nome), undefined, { numeric:true }));
  const form = f ? `<form class="env-form" onsubmit="event.preventDefault();salvarEnvio()">
      <div class="grid-2"><div class="field"><label for="env-data">Data (feita e enviada)</label><input id="env-data" type="date" value="${e2(ed ? ed.data : dataISOLocal(new Date()))}" required></div>
        <div class="field"><label for="env-met">Metragem enviada (m) <small>— opcional, só informativa</small></label><input id="env-met" type="text" inputmode="decimal" placeholder="ex.: 1250,5" value="${ed ? e2(String(ed.metragem).replace('.', ',')) : ''}" autocomplete="off"></div></div>
      <div class="field"><label for="env-anel">Realce</label><select id="env-anel" onchange="envioTrocouRealce()"><option value="">— nenhum —</option>${realces.map(a=>`<option value="${a.id}" ${ed && ed.anelId === a.id ? 'selected' : (!ed && a.id === anelAtivoId ? 'selected' : '')}>${ids.has(a.id) ? '⭐ ' : ''}${e2(a.nome)}</option>`).join('')}</select></div>
      <div class="field"><label>Leques enviados</label><div id="env-chips" class="env-chips"></div></div>
      <div class="field"><label for="env-leques">Outros leques / texto livre (opcional)</label><input id="env-leques" type="text" maxlength="200" placeholder="ex.: complemento do LQ04" value="${ed ? e2((ed.lequeIds || []).length ? (ed.leques.split(' · ')[1] || '') : ed.leques) : ''}" autocomplete="off"></div>
      <div class="field"><label for="env-obs">Observação (opcional)</label><input id="env-obs" type="text" maxlength="400" value="${ed ? e2(ed.observacao) : ''}" autocomplete="off"></div>
      <div class="env-btns"><button type="submit" class="steel">${ed ? 'Salvar alterações' : 'Registrar envio'}</button><button type="button" class="ghost" onclick="envioForm=null;renderEnvios()">Cancelar</button></div></form>`
    : `<button type="button" class="env-add" onclick="abrirFormEnvio()">＋ Registrar envio</button>`;
  root.innerHTML = `<div class="env-topo"><h2>Envios da tratativa</h2><span class="hint">data e metragem enviada, por mês</span></div>${form}${blocos || (f ? '' : '<div class="trat-vazio">Nenhum envio registrado ainda.</div>')}`;
  if(f) envioRenderChips();
}
function lequesDoRealceEnvio(anelId){
  if(!anelId || typeof checklistLeques === 'undefined') return [];
  const ord = (a,b)=> codigoLequeCk(a).localeCompare(codigoLequeCk(b), undefined, { numeric:true });
  return checklistLeques.filter(c=>c.anelId === anelId).sort(ord);
}
function lequesJaEnviados(anelId, ignorarId){
  const m = new Set();
  tratativaEnvios.forEach(e=>{ if(e.anelId === anelId && e.id !== ignorarId) (e.lequeIds || []).forEach(id=>m.add(id)); });
  return m;
}
function envioRenderChips(){
  const box = document.getElementById('env-chips'); if(!box || !envioForm) return;
  const anelId = document.getElementById('env-anel').value;
  const ls = lequesDoRealceEnvio(anelId);
  if(!anelId){ box.innerHTML = '<span class="hint">Escolha o realce para marcar os leques.</span>'; return; }
  if(!ls.length){ box.innerHTML = '<span class="hint">Este realce não tem leques no checklist.</span>'; return; }
  const ja = lequesJaEnviados(anelId, envioForm.id), sel = envioForm.sel;
  const chips = ls.map(c=>{ const on = sel.has(c.id), antes = ja.has(c.id); const t = escHtml(codigoLequeCk(c));
    return `<button type="button" class="env-chip ${on ? 'on' : ''} ${antes ? 'ja' : ''}" aria-pressed="${on}" onclick="envioAlternarLeque('${c.id}')" title="${antes ? 'já enviado em outro envio' : ''}">${on ? '✓ ' : ''}${t}${antes ? '<i>enviado</i>' : ''}</button>`; }).join('');
  const faltam = ls.filter(c=>!ja.has(c.id) && !sel.has(c.id)).length;
  box.innerHTML = `<div class="env-chips-acoes"><button type="button" class="ghost" onclick="envioSelecionarLeques('pendentes')">Marcar os ainda não enviados</button><button type="button" class="ghost" onclick="envioSelecionarLeques('nenhum')">Limpar</button></div><div class="env-chips-lista">${chips}</div><small class="hint">${sel.size} marcado(s) agora · ${ja.size} já enviado(s) antes · ${faltam} sem envio</small>`;
}
function envioAlternarLeque(id){ if(!envioForm) return; if(envioForm.sel.has(id)) envioForm.sel.delete(id); else envioForm.sel.add(id); envioRenderChips(); }
function envioSelecionarLeques(modo){
  if(!envioForm) return; const anelId = document.getElementById('env-anel').value;
  if(modo === 'nenhum') envioForm.sel.clear();
  else { const ja = lequesJaEnviados(anelId, envioForm.id); lequesDoRealceEnvio(anelId).forEach(c=>{ if(!ja.has(c.id)) envioForm.sel.add(c.id); }); }
  envioRenderChips();
}
function envioTrocouRealce(){ if(envioForm) envioForm.sel.clear(); envioRenderChips(); }
function abrirFormEnvio(id){
  const ed = id ? tratativaEnvios.find(x=>x.id === id) : null;
  envioForm = { id: id || null, sel: new Set(ed ? (ed.lequeIds || []) : []) }; renderEnvios(); envioRenderChips();
  const m = document.getElementById('env-met'); if(m){ m.scrollIntoView({ block:'center', behavior:'smooth' }); if(!id) m.focus(); }
}
function alternarMesEnvio(ym){ if(enviosMesAberto.has(ym)) enviosMesAberto.delete(ym); else enviosMesAberto.add(ym); renderEnvios(); }
function salvarEnvio(){
  const data = (document.getElementById('env-data').value || '').slice(0,10);
  const met = parseFloat(String(document.getElementById('env-met').value).trim().replace(/\./g, '').replace(',', '.')) ;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){ showToast('Informe a data.', { tipo:'aviso' }); return; }
  const metTxt = String(document.getElementById('env-met').value).trim();
  if(metTxt && (isNaN(met) || met < 0)){ showToast('Metragem inválida. Use algo como 1250,5 ou deixe vazio.', { tipo:'aviso' }); document.getElementById('env-met').focus(); return; }
  const anelId = document.getElementById('env-anel').value, a = anelId ? aneis.find(x=>x.id === anelId) : null;
  const livre = (document.getElementById('env-leques').value || '').trim().slice(0,100), obs = (document.getElementById('env-obs').value || '').trim().slice(0,400);
  const lequeIds = anelId ? [...envioForm.sel] : [];
  const rotulos = lequesDoRealceEnvio(anelId).filter(c=>lequeIds.includes(c.id)).map(c=>codigoLequeCk(c));
  const leques = [rotulos.join(', '), livre].filter(Boolean).join(' · ').slice(0,200);
  const campos = { data, metragem: metTxt ? Math.round(met*100)/100 : 0, leques, lequeIds, observacao: obs, anelId, anelRotulo: a ? a.nome : '' };
  const regCampos = { data, metragem: campos.metragem, leques, leque_ids: lequeIds, observacao: obs, anel_rotulo: campos.anelRotulo, anel_id: anelId || null };
  if(envioForm && envioForm.id){
    const e = tratativaEnvios.find(x=>x.id === envioForm.id); if(!e){ envioForm = null; renderEnvios(); return; }
    Object.assign(e, campos); enfileirar('tratativa_envios', 'update', Object.assign({ id:e.id }, regCampos));
    showToast('Envio atualizado.', { tipo:'ok' });
  }else{
    const e = Object.assign({ id: uuidv4(), projeto: (a && a.projeto) || configApp.projetoAtivo || '', criadoPor: nomeDoUsuario(), ts: new Date().toISOString() }, campos);
    tratativaEnvios.push(e);
    const reg = Object.assign({ id:e.id, projeto:e.projeto, criado_por:e.criadoPor, criado_em:e.ts }, regCampos); if(!anelId) delete reg.anel_id;
    enfileirar('tratativa_envios', 'insert', reg);
    enviosMesAberto.add(data.slice(0,7));
    showToast(`Envio de ${fmtMetEnvio(met)} m registrado.`, { tipo:'ok' });
  }
  salvarEnviosLocal(); envioForm = null; renderEnvios();
}
function removerEnvio(id){
  const e = tratativaEnvios.find(x=>x.id === id); if(!e) return;
  tratativaEnvios = tratativaEnvios.filter(x=>x.id !== id); salvarEnviosLocal();
  enfileirar('tratativa_envios', 'delete', { id });
  renderEnvios();
  showToast(`Envio de ${fmtDiaEnvio(e.data)} apagado.`, { acaoLabel:'Desfazer', onAcao: ()=>{
    tratativaEnvios.push(e); salvarEnviosLocal();
    enfileirar('tratativa_envios', 'insert', { id:e.id, projeto:e.projeto, anel_id:e.anelId || null, anel_rotulo:e.anelRotulo, data:e.data, metragem:e.metragem, leques:e.leques, leque_ids:e.lequeIds || [], observacao:e.observacao, criado_por:e.criadoPor, criado_em:e.ts });
    renderEnvios();
  } });
}

// ---------- servidor ----------
async function carregarEnviosServidor(){
  if(!navigator.onLine || typeof buscarTudo !== 'function') return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return;
  try{
    const r = await buscarTudo('tratativa_envios'); if(r.error) return;
    tratativaEnvios = r.data.map(mapEnvio); salvarEnviosLocal();
    if(!envioForm) renderEnvios();
  }catch(e){}
}
(function(){
  if(typeof atualizarDoServidor === 'function'){
    const orig = atualizarDoServidor;
    atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); carregarEnviosServidor(); return r; };
  }
  let t = null, canal = null;
  const agendar = ()=>{ clearTimeout(t); t = setTimeout(carregarEnviosServidor, 500); };
  setInterval(()=>{
    if(canal || typeof db.channel !== 'function' || typeof usuarioAtual === 'undefined' || !usuarioAtual) return;
    try{ canal = db.channel('tratativa_envios').on('postgres_changes', { event:'*', schema:'public', table:'tratativa_envios' }, agendar).subscribe(); }catch(e){ canal = null; }
  }, 4000);
  window.addEventListener('load', ()=>{ renderEnvios(); carregarEnviosServidor(); });
  aoRenderizarTudo(()=>{ if(!envioForm) renderEnvios(); });
})();

// leque (id do checklist) -> último envio em que ele foi marcado
function enviosPorLeque(anelId){
  const m = new Map();
  tratativaEnvios.filter(e=> e.anelId === anelId && envioNoEscopo(e)).sort((a,b)=> a.data.localeCompare(b.data)).forEach(e=> (e.lequeIds || []).forEach(id=> m.set(id, { id:e.id, data:e.data, metragem:e.metragem })));
  return m;
}
function abrirEnvioDoLeque(envioId){
  abrirFormEnvio(envioId);
  const r = document.getElementById('envios-root'); if(r) r.scrollIntoView({ behavior:'smooth', block:'start' });
}

// Marca um leque TRATADO como enviado com um toque: usa o envio de hoje do mesmo realce (ou cria um).
function marcarLequeEnviado(lequeId, marcar){
  const c = checklistLeques.find(x=>x.id === lequeId); if(!c) return;
  const a = aneis.find(x=>x.id === c.anelId), cod = codigoLequeCk(c);
  const refazTexto = env=>{ const rest = (env.leques || '').split(' · ').slice(1).join(' · ');
    env.leques = [lequesDoRealceEnvio(env.anelId).filter(x=>env.lequeIds.includes(x.id)).map(x=>codigoLequeCk(x)).join(', '), rest].filter(Boolean).join(' · ').slice(0,200); };
  if(marcar){
    const hoje = dataISOLocal(new Date());
    let env = tratativaEnvios.find(x=> x.anelId === c.anelId && x.data === hoje && envioNoEscopo(x));
    if(env){
      if(!(env.lequeIds || []).includes(lequeId)) env.lequeIds = [...(env.lequeIds || []), lequeId];
      refazTexto(env); enfileirar('tratativa_envios', 'update', { id:env.id, leque_ids:env.lequeIds, leques:env.leques });
    }else{
      env = { id: uuidv4(), projeto: (a && a.projeto) || configApp.projetoAtivo || '', criadoPor: nomeDoUsuario(), ts: new Date().toISOString(), data: hoje, metragem: 0, leques: cod, lequeIds:[lequeId], observacao:'', anelId: c.anelId, anelRotulo: a ? a.nome : '' };
      tratativaEnvios.push(env);
      enfileirar('tratativa_envios', 'insert', { id:env.id, projeto:env.projeto, criado_por:env.criadoPor, criado_em:env.ts, data:hoje, metragem:0, leques:cod, leque_ids:[lequeId], observacao:'', anel_rotulo:env.anelRotulo, anel_id:c.anelId });
    }
    enviosMesAberto.add(hoje.slice(0,7));
    showToast(`${cod} marcado como enviado.`, { tipo:'ok', acaoLabel:'Desfazer', onAcao:()=> marcarLequeEnviado(lequeId, false) });
  }else{
    const env = tratativaEnvios.find(x=> (x.lequeIds || []).includes(lequeId)); if(!env) return;
    env.lequeIds = env.lequeIds.filter(i=>i !== lequeId); refazTexto(env);
    if(!env.lequeIds.length && !env.leques && !env.observacao && !(env.metragem > 0)){
      tratativaEnvios = tratativaEnvios.filter(x=>x.id !== env.id); enfileirar('tratativa_envios', 'delete', { id:env.id });
    }else enfileirar('tratativa_envios', 'update', { id:env.id, leque_ids:env.lequeIds, leques:env.leques });
    showToast(`${cod} voltou para não enviado.`, { tipo:'ok' });
  }
  salvarEnviosLocal(); renderAll();
}
