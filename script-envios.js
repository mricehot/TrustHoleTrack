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
  const ymHoje = dataISOLocal(new Date()).slice(0,7);
  if(!enviosMesAberto.size && meses.size) enviosMesAberto.add([...meses.keys()][0]);
  const blocos = [...meses.entries()].map(([ym, es])=>{
    const tot = es.reduce((s,e)=> s + e.metragem, 0), aberto = enviosMesAberto.has(ym);
    const linhas = es.map(e=>`<li class="env-linha">
      <button type="button" class="env-info" onclick="abrirFormEnvio('${e.id}')" aria-label="Editar envio de ${fmtDiaEnvio(e.data)}">
        <b>${fmtDiaEnvio(e.data)}</b>
        <span class="env-desc">${e2(e.anelRotulo || 'Sem realce')}${e.leques ? ' · ' + e2(e.leques) : ''}${e.observacao ? '<small>' + e2(e.observacao) + '</small>' : ''}</span>
        <span class="env-m">${fmtMetEnvio(e.metragem)} m</span>
      </button>
      <button type="button" class="env-del" onclick="removerEnvio('${e.id}')" aria-label="Apagar envio" title="Apagar">✕</button></li>`).join('');
    return `<section class="env-mes ${aberto ? 'aberto' : ''}">
      <button type="button" class="env-mes-cab" onclick="alternarMesEnvio('${ym}')" aria-expanded="${aberto}">
        <span class="env-seta">${aberto ? '▾' : '▸'}</span><b>${rotuloMesEnvio(ym)}${ym === ymHoje ? ' <i>(mês atual)</i>' : ''}</b>
        <span class="env-tot">${fmtMetEnvio(tot)} m <small>· ${es.length} ${es.length === 1 ? 'envio' : 'envios'}</small></span></button>
      ${aberto ? `<ul class="env-lista">${linhas}</ul>` : ''}</section>`;
  }).join('');
  const f = envioForm, ed = f && f.id ? tratativaEnvios.find(x=>x.id === f.id) : null;
  const { lista: favs } = (typeof realcesDaTratativa === 'function') ? realcesDaTratativa() : { lista: [] };
  const ids = new Set(favs.map(a=>a.id));
  const realces = aneis.filter(a=>!configApp.projetoAtivo || !a.projeto || a.projeto === configApp.projetoAtivo)
    .sort((a,b)=> (ids.has(b.id) - ids.has(a.id)) || String(a.nome).localeCompare(String(b.nome), undefined, { numeric:true }));
  const form = f ? `<form class="env-form" onsubmit="event.preventDefault();salvarEnvio()">
      <div class="grid-2"><div class="field"><label for="env-data">Data (feita e enviada)</label><input id="env-data" type="date" value="${e2(ed ? ed.data : dataISOLocal(new Date()))}" required></div>
        <div class="field"><label for="env-met">Metragem enviada (m)</label><input id="env-met" type="text" inputmode="decimal" placeholder="ex.: 1250,5" value="${ed ? e2(String(ed.metragem).replace('.', ',')) : ''}" autocomplete="off" required></div></div>
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
  if(isNaN(met) || met < 0){ showToast('Informe a metragem enviada, ex.: 1250,5.', { tipo:'aviso' }); document.getElementById('env-met').focus(); return; }
  const anelId = document.getElementById('env-anel').value, a = anelId ? aneis.find(x=>x.id === anelId) : null;
  const livre = (document.getElementById('env-leques').value || '').trim().slice(0,100), obs = (document.getElementById('env-obs').value || '').trim().slice(0,400);
  const lequeIds = anelId ? [...envioForm.sel] : [];
  const rotulos = lequesDoRealceEnvio(anelId).filter(c=>lequeIds.includes(c.id)).map(c=>codigoLequeCk(c));
  const leques = [rotulos.join(', '), livre].filter(Boolean).join(' · ').slice(0,200);
  const campos = { data, metragem: Math.round(met*100)/100, leques, lequeIds, observacao: obs, anelId, anelRotulo: a ? a.nome : '' };
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
