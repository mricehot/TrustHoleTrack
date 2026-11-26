// ---------- Pendências (o que está travando) ----------
const PENDENCIAS_KEY = 'perfilagem-pendencias-v1';
const CATEG_PEND = { obstrucao: 'Obstrução', equipamento: 'Equipamento', area: 'Área', outro: 'Outro' };
const STATUS_PEND = { aberta: 'Aberta', em_resolucao: 'Em resolução', resolvida: 'Resolvida' };
let pendencias = []; // { id, projeto, anelId, anelRotulo, titulo, detalhe, categoria, status, responsavel, prazo, equipeId, criadoPor, ts, resolvidaEm, resolvidaPor }
let pendFiltro = 'aberta'; // aberta | em_resolucao | resolvida
let pendFormAberto = false;
let pendFormPre = null;
try{ pendencias = JSON.parse(localStorage.getItem(PENDENCIAS_KEY) || '[]') || []; }catch(e){ pendencias = []; }
const salvarPendenciasLocal = ()=>{ try{ localStorage.setItem(PENDENCIAS_KEY, JSON.stringify(pendencias)); }catch(e){} };
function mapPendencia(r){ return { id: r.id, projeto: r.projeto || '', anelId: r.anel_id || '', anelRotulo: r.anel_rotulo || '', titulo: r.titulo || '', detalhe: r.detalhe || '', categoria: r.categoria || 'outro', status: r.status || 'aberta', responsavel: r.responsavel || '', prazo: r.prazo ? String(r.prazo).slice(0, 10) : '', equipeId: r.equipe_id || '', criadoPor: r.criado_por || '', ts: r.criado_em, resolvidaEm: r.resolvida_em || '', resolvidaPor: r.resolvida_por || '' }; }
const pendNoEscopo = p => { const pr = typeof configApp !== 'undefined' ? configApp.projetoAtivo : ''; return !pr || !p.projeto || p.projeto === pr; };
const pendAberta = p => p.status !== 'resolvida';
function haQuantoPend(ts){
  const ms = Date.now() - new Date(ts).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if(min < 60) return 'agora há pouco';
  const h = Math.round(min / 60); if(h < 24) return `há ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}
const diasDesde = ts => (Date.now() - new Date(ts).getTime()) / 86400000;
const fmtDataBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
const pendVencida = p => pendAberta(p) && p.prazo && p.prazo < dataISOLocal(new Date());

function renderPendencias(){
  const box = document.getElementById('pendencias-corpo'); if(!box) return;
  const gestor = typeof ehGestor === 'function' && ehGestor();
  const eu = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  const todas = pendencias.filter(pendNoEscopo);
  const cont = { aberta: todas.filter(p=>p.status === 'aberta').length, em_resolucao: todas.filter(p=>p.status === 'em_resolucao').length, resolvida: todas.filter(p=>p.status === 'resolvida').length };
  const tag = document.getElementById('pendencias-cont'); if(tag) tag.textContent = cont.aberta + cont.em_resolucao;
  let lista = todas.filter(p=>p.status === pendFiltro);
  lista.sort((a,b)=> pendFiltro === 'resolvida' ? new Date(b.resolvidaEm || b.ts) - new Date(a.resolvidaEm || a.ts) : ((!!a.responsavel) - (!!b.responsavel)) || new Date(a.ts) - new Date(b.ts));
  if(pendFiltro === 'resolvida') lista = lista.slice(0, 30);
  const e2 = escHtml;
  const usuarios = (typeof usuariosEmpresa !== 'undefined' ? usuariosEmpresa : []).map(u=>u.nome || (u.email || '').split('@')[0]).filter(Boolean);
  const nomeEq = id => (typeof equipes !== 'undefined' && (equipes.find(x=>x.id === id) || {}).nome) || '';
  const cor = p => p.status === 'resolvida' ? 'var(--moss)' : p.status === 'em_resolucao' ? '#e0a21b' : 'var(--est-obs,#d6453d)';
  const chips = [['aberta', 'Abertas'], ['em_resolucao', 'Em resolução'], ['resolvida', 'Resolvidas']];
  const realces = (typeof aneis !== 'undefined' ? aneis : []).filter(a=> !configApp.projetoAtivo || a.projeto === configApp.projetoAtivo);
  const pre = pendFormPre || {};
  box.innerHTML = `
    <div class="pend-chips" role="group" aria-label="Filtrar pendências">${chips.map(([v, r])=>`<button type="button" class="pend-chip" aria-pressed="${pendFiltro === v}" onclick="pendFiltro='${v}';renderPendencias()">${r} (${cont[v]})</button>`).join('')}</div>
    ${lista.length ? lista.map(p=>`
      <article class="pend ${pendVencida(p) ? 'vencida' : ''}" style="--pc:${cor(p)}">
        <div class="pend-topo"><b>${e2(p.titulo)}</b><span class="pend-idade ${pendAberta(p) && diasDesde(p.ts) >= 2 ? 'velha' : ''}">${p.status === 'resolvida' ? 'resolvida ' + haQuantoPend(p.resolvidaEm || p.ts) : haQuantoPend(p.ts)}</span></div>
        <div class="pend-meta">${e2(CATEG_PEND[p.categoria] || 'Outro')}${p.anelRotulo ? ' · ' + e2(p.anelRotulo) : ''}${nomeEq(p.equipeId) ? ' · aberta pela ' + e2(nomeEq(p.equipeId)) : (p.criadoPor ? ' · aberta por ' + e2(p.criadoPor) : '')}</div>
        ${p.detalhe ? `<div class="pend-det">${e2(p.detalhe)}</div>` : ''}
        <div class="pend-status" role="group" aria-label="Situação da pendência">${Object.entries(STATUS_PEND).map(([v, r])=>`<button type="button" class="${p.status === v ? 'on s-' + v : ''}" aria-pressed="${p.status === v}" onclick="mudarStatusPendencia('${p.id}','${v}')">${r}</button>`).join('')}</div>
        <div class="pend-dono">
          ${gestor
            ? `<label>Responsável <select onchange="definirResponsavelPendencia('${p.id}', this.value)" aria-label="Responsável pela pendência"><option value="">sem dono</option>${[...new Set([...usuarios, p.responsavel].filter(Boolean))].map(n=>`<option value="${e2(n)}" ${n === p.responsavel ? 'selected' : ''}>${e2(n)}</option>`).join('')}</select></label>
               <label>Prazo <input type="date" value="${p.prazo}" onchange="definirPrazoPendencia('${p.id}', this.value)" aria-label="Prazo da pendência"></label>`
            : `<span>Responsável: <i class="${p.responsavel ? '' : 'sem'}">${p.responsavel ? e2(p.responsavel) : 'sem dono'}</i></span>${p.prazo ? `<span>Prazo: <i class="${pendVencida(p) ? 'sem' : ''}">${fmtDataBR(p.prazo)}</i></span>` : ''}`}
          ${gestor || p.criadoPor === eu ? `<button type="button" class="icon icon-remover" aria-label="apagar pendência ${e2(p.titulo)}" onclick="apagarPendencia('${p.id}')">✕</button>` : ''}
        </div>
      </article>`).join('') : `<div class="hint" style="margin:10px 0;">${pendFiltro === 'aberta' ? 'Nenhuma pendência aberta. 👍' : 'Nada por aqui.'}</div>`}
    ${pendFormAberto
      ? `<form class="pend-form" onsubmit="criarPendencia();return false;">
          <div class="field"><label for="pend-titulo">O que está travando?</label><input id="pend-titulo" type="text" maxlength="120" placeholder="ex.: Acesso bloqueado — N16" value="${e2(pre.titulo || '')}" autocomplete="off"></div>
          <div class="grid-2"><div class="field"><label for="pend-cat">Tipo</label><select id="pend-cat">${Object.entries(CATEG_PEND).map(([v, r])=>`<option value="${v}" ${v === (pre.categoria || 'obstrucao') ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
            <div class="field"><label for="pend-anel">Realce</label><select id="pend-anel"><option value="">— nenhum —</option>${realces.map(a=>`<option value="${a.id}" ${a.id === (pre.anelId || '') ? 'selected' : ''}>${e2(a.nome)}</option>`).join('')}</select></div></div>
          <div class="field"><label for="pend-det">Detalhe (opcional)</label><textarea id="pend-det" rows="2" maxlength="600" placeholder="ex.: 3 furos com rocha no fundo">${e2(pre.detalhe || '')}</textarea></div>
          <div class="pend-form-btns"><button type="submit">Abrir pendência</button><button type="button" class="ghost" onclick="pendFormAberto=false;pendFormPre=null;renderPendencias()">Cancelar</button></div>
        </form>`
      : `<button type="button" class="pend-add" onclick="abrirFormPendencia()">＋ Nova pendência</button>`}`;
  atualizarContadorPendencias();
}
function abrirFormPendencia(pre){
  pendFormAberto = true; pendFormPre = pre || null;
  renderPendencias();
  const t = document.getElementById('pend-titulo'); if(t){ t.focus(); t.scrollIntoView({ block:'center', behavior:'smooth' }); }
}
function criarPendencia(){
  const titulo = (document.getElementById('pend-titulo').value || '').trim().slice(0, 120);
  if(!titulo){ document.getElementById('pend-titulo').focus(); showToast('Escreva o que está travando.', { erro:false }); return; }
  const anelId = document.getElementById('pend-anel').value;
  const a = anelId ? aneis.find(x=>x.id === anelId) : null;
  const eq = typeof minhaEquipeId === 'function' ? minhaEquipeId() : null;
  const p = { id: uuidv4(), projeto: (a && a.projeto) || configApp.projetoAtivo || '', anelId, anelRotulo: a ? a.nome : '', titulo, detalhe: (document.getElementById('pend-det').value || '').trim().slice(0, 600),
    categoria: document.getElementById('pend-cat').value, status: 'aberta', responsavel: '', prazo: '', equipeId: eq || '', criadoPor: nomeDoUsuario(), ts: new Date().toISOString(), resolvidaEm: '', resolvidaPor: '' };
  pendencias.push(p); salvarPendenciasLocal();
  const reg = { id: p.id, projeto: p.projeto, anel_rotulo: p.anelRotulo, titulo, detalhe: p.detalhe, categoria: p.categoria, status: 'aberta', criado_por: p.criadoPor, criado_em: p.ts };
  if(anelId) reg.anel_id = anelId; if(eq) reg.equipe_id = eq;
  enfileirar('pendencias', 'insert', reg);
  pendFormAberto = false; pendFormPre = null; pendFiltro = 'aberta';
  showToast('Pendência aberta.', { tipo:'ok' });
  renderPendencias();
}
function mudarStatusPendencia(id, status){
  const p = pendencias.find(x=>x.id === id); if(!p || p.status === status) return;
  const antes = p.status; p.status = status;
  p.resolvidaEm = status === 'resolvida' ? new Date().toISOString() : ''; p.resolvidaPor = status === 'resolvida' ? nomeDoUsuario() : '';
  salvarPendenciasLocal();
  enfileirar('pendencias', 'update', { id, status, resolvida_em: p.resolvidaEm || null, resolvida_por: p.resolvidaPor || null });
  if(typeof vibrarCurto === 'function') vibrarCurto(10);
  renderPendencias();
  showToast(`"${p.titulo}": ${STATUS_PEND[status].toLowerCase()}.`, { acaoLabel: 'Desfazer', onAcao: ()=>{ mudarStatusPendencia(id, antes); } });
}
function definirResponsavelPendencia(id, nome){
  const p = pendencias.find(x=>x.id === id); if(!p) return;
  p.responsavel = nome; salvarPendenciasLocal();
  enfileirar('pendencias', 'update', { id, responsavel: nome });
  renderPendencias();
}
function definirPrazoPendencia(id, iso){
  const p = pendencias.find(x=>x.id === id); if(!p) return;
  p.prazo = iso || ''; salvarPendenciasLocal();
  enfileirar('pendencias', 'update', { id, prazo: iso || null });
  renderPendencias();
}
function apagarPendencia(id){
  const p = pendencias.find(x=>x.id === id); if(!p) return;
  pendencias = pendencias.filter(x=>x.id !== id); salvarPendenciasLocal();
  enfileirar('pendencias', 'delete', { id });
  renderPendencias();
  showToast(`Pendência "${p.titulo}" apagada.`, { acaoLabel: 'Desfazer', onAcao: ()=>{
    pendencias.push(p); salvarPendenciasLocal();
    const reg = { id: p.id, projeto: p.projeto, anel_rotulo: p.anelRotulo, titulo: p.titulo, detalhe: p.detalhe, categoria: p.categoria, status: p.status, responsavel: p.responsavel, criado_por: p.criadoPor, criado_em: p.ts };
    if(p.anelId) reg.anel_id = p.anelId; if(p.equipeId) reg.equipe_id = p.equipeId; if(p.prazo) reg.prazo = p.prazo;
    enfileirar('pendencias', 'insert', reg); renderPendencias();
  }});
}
// Atalho no leque: abre a pendência já com o realce e os furos obstruídos preenchidos.
function novaPendenciaDoLeque(leId){
  const c = checklistLeques.find(x=>x.id === leId); if(!c) return;
  const furos = checklistFurosDoLeque(c.id).filter(f=>f.obstruido);
  const cod = PREFIXO[c.tipo] + c.numero;
  const motivos = [...new Set(furos.map(f=>f.obstruido))].join(' / ');
  mostrarView('pendencias');
  abrirFormPendencia({ titulo: `${cod} obstruído`, categoria: 'obstrucao', anelId: c.anelId, detalhe: `${furos.length} furo(s) obstruído(s)${motivos ? ' (' + motivos + ')' : ''}: ${furos.map(f=>'F' + f.numero).join(', ')}` });
}
function atualizarContadorPendencias(){
  const n = pendencias.filter(p=>pendNoEscopo(p) && pendAberta(p)).length;
  document.querySelectorAll('button[data-view="pendencias"] .tab-label, .sheet-item[data-view="pendencias"] > span:last-child').forEach(l=>{ l.dataset.n = n ? String(n) : ''; });
  const mais = document.getElementById('tab-mais'); if(mais) mais.dataset.pend = n ? '1' : '';
}

// ---------- servidor ----------
async function carregarPendenciasServidor(){
  if(!navigator.onLine || typeof buscarTudo !== 'function') return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return;
  try{
    const r = await buscarTudo('pendencias'); if(r.error) return;
    pendencias = r.data.map(mapPendencia); salvarPendenciasLocal();
    renderPendencias();
  }catch(e){}
}
(function(){
  if(typeof atualizarDoServidor === 'function'){
    const orig = atualizarDoServidor;
    atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); carregarPendenciasServidor(); return r; };
  }
  let t = null, canal = null;
  const agendar = ()=>{ clearTimeout(t); t = setTimeout(carregarPendenciasServidor, 500); };
  setInterval(()=>{
    if(canal || typeof db.channel !== 'function' || typeof usuarioAtual === 'undefined' || !usuarioAtual) return;
    try{ canal = db.channel('pendencias').on('postgres_changes', { event:'*', schema:'public', table:'pendencias' }, agendar).subscribe(); }catch(e){ canal = null; }
  }, 4000);
  window.addEventListener('load', ()=>{ renderPendencias(); carregarPendenciasServidor(); });
  const om = mostrarView;
  mostrarView = function(v){ const r = om.apply(this, arguments); if(v === 'pendencias') renderPendencias(); return r; };
})();
