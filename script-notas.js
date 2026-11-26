// ---------- Anotações de tratamento: como fazer, dúvidas tiradas e dicas (aba Anotações) ----------
const NOTAS_KEY = 'perfilagem-tratativa-notas-v1';
const CATEG_NOTA = { como_fazer: 'Como fazer', duvida: 'Dúvida', dica: 'Dica' };
let tratativaNotas = []; // { id, projeto, titulo, texto, categoria, fixada, criadoPor, ts, atualizadoEm }
let notaForm = null;     // null = fechado; { id } = editando (id vazio = nova)
let notaFiltro = 'todas', notaBusca = '';
const notasAbertas = new Set();
try{ tratativaNotas = JSON.parse(localStorage.getItem(NOTAS_KEY) || '[]') || []; }catch(e){ tratativaNotas = []; }
const salvarNotasLocal = ()=>{ try{ localStorage.setItem(NOTAS_KEY, JSON.stringify(tratativaNotas)); }catch(e){} };
function mapNota(r){ return { id:r.id, projeto:r.projeto || '', titulo:r.titulo || '', texto:r.texto || '', categoria:r.categoria || 'como_fazer', fixada:!!r.fixada, criadoPor:r.criado_por || '', ts:r.criado_em || '', atualizadoEm:r.atualizado_em || r.criado_em || '' }; }
let notaTodosProjetos = false; // mostra também as anotações de outros projetos
const notaNoEscopo = n => { if(notaTodosProjetos) return true; const pr = typeof configApp !== 'undefined' ? configApp.projetoAtivo : ''; return !pr || !n.projeto || n.projeto === pr; };
const notaSemAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtDataNota = ts => ts ? new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '';

function renderNotas(){
  const view = document.getElementById('view-notas'); if(!view) return;
  let root = document.getElementById('notas-root');
  if(!root){ root = document.createElement('div'); root.id = 'notas-root'; view.appendChild(root); }
  const e2 = escHtml;
  const todas = tratativaNotas.filter(notaNoEscopo);
  const foraEscopo = notaTodosProjetos ? 0 : tratativaNotas.length - todas.length;
  const q = notaSemAcento(notaBusca.trim());
  const lista = todas.filter(n=> (notaFiltro === 'todas' || n.categoria === notaFiltro) && (!q || notaSemAcento(n.titulo + ' ' + n.texto).includes(q)))
    .sort((a,b)=> (b.fixada - a.fixada) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
  const cont = c => c === 'todas' ? todas.length : todas.filter(n=>n.categoria === c).length;
  const chips = [['todas','Todas'], ...Object.entries(CATEG_NOTA).map(([k,v])=>[k, v === 'Dúvida' ? 'Dúvidas' : v === 'Dica' ? 'Dicas' : v])]
    .map(([k,r])=>`<button type="button" class="nota-chip ${notaFiltro === k ? 'on' : ''}" aria-pressed="${notaFiltro === k}" onclick="notaFiltro='${k}';renderNotas()">${r} <small>${cont(k)}</small></button>`).join('');
  const ed = notaForm && notaForm.id ? tratativaNotas.find(x=>x.id === notaForm.id) : null;
  const cat = notaForm ? (notaForm.categoria || (ed ? ed.categoria : 'como_fazer')) : 'como_fazer';
  const form = notaForm ? `<form class="nota-form" onsubmit="event.preventDefault();salvarNota()">
      <div class="field"><label for="nota-titulo">Título</label><input id="nota-titulo" type="text" maxlength="120" placeholder="ex.: Como tratar o azimute no Leica" value="${ed ? e2(ed.titulo) : ''}" autocomplete="off" required></div>
      <div class="field"><label>Tipo</label><div class="nota-tipos" role="group">${Object.entries(CATEG_NOTA).map(([k,v])=>`<button type="button" class="nota-chip ${cat === k ? 'on' : ''}" aria-pressed="${cat === k}" onclick="notaEscolherTipo('${k}')">${v}</button>`).join('')}</div></div>
      <div class="field"><label for="nota-texto">Anotação</label><textarea id="nota-texto" rows="7" maxlength="4000" placeholder="Passo a passo, dúvida e a resposta, o que lembrar...">${ed ? e2(ed.texto) : ''}</textarea></div>
      <div class="nota-btns"><button type="submit" class="steel">${ed ? 'Salvar alterações' : 'Salvar anotação'}</button><button type="button" class="ghost" onclick="notaForm=null;renderNotas()">Cancelar</button></div></form>`
    : `<button type="button" class="nota-add" onclick="abrirFormNota()">＋ Nova anotação</button>`;
  const cartoes = lista.map(n=>{
    const aberta = notasAbertas.has(n.id);
    return `<article class="nota ${n.fixada ? 'fixada' : ''} ${aberta ? 'aberta' : ''}">
      <button type="button" class="nota-cab" onclick="alternarNota('${n.id}')" aria-expanded="${aberta}">
        <span class="nota-tag t-${n.categoria}">${CATEG_NOTA[n.categoria] || ''}</span>
        <b>${n.fixada ? '📌 ' : ''}${e2(n.titulo)}</b><span class="nota-seta">${aberta ? '▾' : '▸'}</span></button>
      ${aberta ? `<div class="nota-corpo"><div class="nota-texto">${e2(n.texto) || '<i>Sem texto.</i>'}</div>
        <div class="nota-meta">${n.criadoPor ? e2(n.criadoPor) + ' · ' : ''}${fmtDataNota(n.atualizadoEm)}</div>
        <div class="nota-acoes"><button type="button" class="ghost" onclick="abrirFormNota('${n.id}')">Editar</button><button type="button" class="ghost" onclick="fixarNota('${n.id}')">${n.fixada ? 'Desafixar' : 'Fixar no topo'}</button><button type="button" class="ghost perigo" onclick="removerNota('${n.id}')">Apagar</button></div></div>` : ''}</article>`;
  }).join('');
  const vazio = !todas.length && foraEscopo ? 'Nenhuma anotação neste projeto.' : !todas.length ? 'Nenhuma anotação ainda. Registre aqui como fazer cada passo e as dúvidas que forem tiradas.' : (!lista.length ? 'Nada encontrado com esse filtro.' : '');
  const buscaVal = e2(notaBusca);
  root.innerHTML = `<div class="nota-topo"><h2>Anotações de tratamento</h2><span class="hint">como fazer, dúvidas tiradas e dicas</span></div>${form}
    ${todas.length ? `<input id="nota-busca" type="search" class="nota-busca" placeholder="Buscar nas anotações" value="${buscaVal}" autocomplete="off" aria-label="buscar nas anotações"><div class="nota-chips" role="group" aria-label="filtrar por tipo">${chips}</div>` : ''}
    ${foraEscopo ? `<div class="nota-fora"><span>${foraEscopo} ${foraEscopo === 1 ? 'anotação de outro projeto está oculta' : 'anotações de outros projetos estão ocultas'} (projeto ativo: ${e2((typeof configApp !== 'undefined' && configApp.projetoAtivo) || '—')}).</span><button type="button" class="ghost" onclick="notaTodosProjetos=true;renderNotas()">Mostrar todas</button></div>` : (notaTodosProjetos && tratativaNotas.some(n=>!(typeof configApp !== 'undefined' && (!configApp.projetoAtivo || !n.projeto || n.projeto === configApp.projetoAtivo))) ? '<div class="nota-fora"><span>Mostrando anotações de todos os projetos.</span><button type="button" class="ghost" onclick="notaTodosProjetos=false;renderNotas()">Só do projeto ativo</button></div>' : '')}
    ${cartoes}${vazio ? `<div class="trat-vazio">${vazio}</div>` : ''}`;
  const b = document.getElementById('nota-busca');
  if(b) b.addEventListener('input', ()=>{ notaBusca = b.value; const pos = b.selectionStart; renderNotas(); const n = document.getElementById('nota-busca'); if(n){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} } });
}
function abrirFormNota(id){
  notaForm = { id: id || '', categoria: null }; renderNotas();
  const t = document.getElementById('nota-titulo'); if(t){ t.scrollIntoView({ block:'center', behavior:'smooth' }); if(!id) t.focus(); }
}
function notaEscolherTipo(k){
  if(!notaForm) return;
  const t = document.getElementById('nota-titulo').value, x = document.getElementById('nota-texto').value;
  notaForm.categoria = k; notaForm.rascunho = { t, x };
  const ed = notaForm.id ? tratativaNotas.find(n=>n.id === notaForm.id) : null;
  renderNotas();
  document.getElementById('nota-titulo').value = t; document.getElementById('nota-texto').value = x;
}
function alternarNota(id){ if(notasAbertas.has(id)) notasAbertas.delete(id); else notasAbertas.add(id); renderNotas(); }
function salvarNota(){
  const titulo = (document.getElementById('nota-titulo').value || '').trim().slice(0,120);
  const texto = (document.getElementById('nota-texto').value || '').trim().slice(0,4000);
  if(!titulo){ showToast('Escreva um título.', { tipo:'aviso' }); return; }
  const ed = notaForm.id ? tratativaNotas.find(x=>x.id === notaForm.id) : null;
  const categoria = notaForm.categoria || (ed ? ed.categoria : 'como_fazer');
  const agora = new Date().toISOString();
  if(ed){
    Object.assign(ed, { titulo, texto, categoria, atualizadoEm:agora });
    enfileirar('tratativa_notas', 'update', { id:ed.id, titulo, texto, categoria, atualizado_em:agora });
    showToast('Anotação atualizada.', { tipo:'ok' });
  }else{
    const n = { id: uuidv4(), projeto: configApp.projetoAtivo || '', titulo, texto, categoria, fixada:false, criadoPor: nomeDoUsuario(), ts:agora, atualizadoEm:agora };
    tratativaNotas.push(n); notasAbertas.add(n.id);
    enfileirar('tratativa_notas', 'insert', { id:n.id, projeto:n.projeto, titulo, texto, categoria, fixada:false, criado_por:n.criadoPor, criado_em:agora, atualizado_em:agora });
    showToast('Anotação salva.', { tipo:'ok' });
  }
  salvarNotasLocal(); notaForm = null; renderNotas();
}
function fixarNota(id){
  const n = tratativaNotas.find(x=>x.id === id); if(!n) return;
  n.fixada = !n.fixada; salvarNotasLocal();
  enfileirar('tratativa_notas', 'update', { id, fixada:n.fixada });
  renderNotas();
}
function removerNota(id){
  const n = tratativaNotas.find(x=>x.id === id); if(!n) return;
  tratativaNotas = tratativaNotas.filter(x=>x.id !== id); salvarNotasLocal();
  enfileirar('tratativa_notas', 'delete', { id });
  renderNotas();
  showToast(`Anotação "${n.titulo.slice(0,30)}" apagada.`, { acaoLabel:'Desfazer', onAcao: ()=>{
    tratativaNotas.push(n); salvarNotasLocal();
    enfileirar('tratativa_notas', 'insert', { id:n.id, projeto:n.projeto, titulo:n.titulo, texto:n.texto, categoria:n.categoria, fixada:n.fixada, criado_por:n.criadoPor, criado_em:n.ts, atualizado_em:n.atualizadoEm });
    renderNotas();
  } });
}

// ---------- servidor ----------
async function carregarNotasServidor(){
  if(!navigator.onLine || typeof buscarTudo !== 'function') return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return;
  try{
    const r = await buscarTudo('tratativa_notas'); if(r.error) return;
    tratativaNotas = r.data.map(mapNota); salvarNotasLocal();
    if(!notaForm) renderNotas();
  }catch(e){}
}
(function(){
  if(typeof atualizarDoServidor === 'function'){
    const orig = atualizarDoServidor;
    atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); carregarNotasServidor(); return r; };
  }
  let t = null, canal = null;
  const agendar = ()=>{ clearTimeout(t); t = setTimeout(carregarNotasServidor, 500); };
  setInterval(()=>{
    if(canal || typeof db.channel !== 'function' || typeof usuarioAtual === 'undefined' || !usuarioAtual) return;
    try{ canal = db.channel('tratativa_notas').on('postgres_changes', { event:'*', schema:'public', table:'tratativa_notas' }, agendar).subscribe(); }catch(e){ canal = null; }
  }, 4000);
  window.addEventListener('load', ()=>{ renderNotas(); carregarNotasServidor(); });
  const omv = mostrarView; mostrarView = function(v){ const r = omv.apply(this, arguments); if(v === 'notas') renderNotas(); return r; };
  aoRenderizarTudo(()=>{ if(!notaForm && document.activeElement !== document.getElementById('nota-busca')) renderNotas(); });
})();
