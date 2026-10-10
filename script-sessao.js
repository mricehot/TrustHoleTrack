// ---------- Autenticação (Supabase Auth) ----------
// O app fica travado na tela de login até existir uma sessão válida. As contas são
// criadas direto no painel do Supabase (Authentication → Users) — não tem cadastro
// pelo próprio app, de propósito, pra não abrir conta pra qualquer um.
let appJaIniciado = false;
let usuarioAtual = null; // { id, email } — usado pra saber quem pode editar/apagar o quê

// Guarda quem logou por último nesse aparelho, pra continuar liberando o app mesmo
// se a consulta de sessão falhar por falta de rede (comum em turno de 8h no subsolo,
// sem sinal) — só é limpo num logout explícito.
const SESSAO_CACHE_KEY = 'perfilagem-sessao-cache-v1';
function salvarSessaoCache(usuario){
  try{ localStorage.setItem(SESSAO_CACHE_KEY, JSON.stringify(usuario)); }catch(e){}
}
function lerSessaoCache(){
  try{
    const raw = localStorage.getItem(SESSAO_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function limparSessaoCache(){
  try{ localStorage.removeItem(SESSAO_CACHE_KEY); }catch(e){}
}

function mostrarApp(user){
  usuarioAtual = user ? { id: user.id, email: user.email, nome: (user.user_metadata && user.user_metadata.nome) || '' } : null;
  if(usuarioAtual) salvarSessaoCache(usuarioAtual);
  restaurarFilaPersistida(); // logo ao entrar: antes de qualquer outra gravação
  el('login-screen').style.display = 'none';
  el('app-wrap').style.display = '';
  const labelUsuario = el('usuario-logado-label');
  if(labelUsuario) labelUsuario.textContent = usuarioAtual ? `logado: ${usuarioAtual.nome || usuarioAtual.email}` : '';
  try{ atualizarAvatarEMeuDia(); }catch(e){}
  try{ const u = lerUltimo(); if(u.view && u.view !== 'perfilagem' && document.getElementById('view-' + u.view)) mostrarView(u.view); }catch(e){}
  if(typeof tutorialJaVisto === 'function' && !tutorialJaVisto()) setTimeout(()=> abrirTutorial(0), 700);
}

function mostrarLogin(mensagemErro){
  if(typeof pararTempoReal === 'function') pararTempoReal();
  usuarioAtual = null;
  el('login-screen').style.display = 'flex';
  el('app-wrap').style.display = 'none';
  const erro = el('login-erro');
  if(erro) erro.textContent = mensagemErro || '';
  el('login-senha').value = '';
}

// Um leque sem dono (criado antes dessa funcionalidade existir) pode ser editado por
// qualquer autenticado — só trava quando já tem um dono definido e não é o atual.
// Antes só quem criou o leque podia editar/apagar ele e os furos dele — isso
// foi removido a pedido: agora qualquer autenticado pode, independente de
// quem criou ou de qual letra foi selecionada na abertura do leque. A função
// continua existindo (e sendo chamada nos mesmos lugares) só pra não precisar
// mexer em cada ponto individualmente — sempre libera.
function souDonoDoLeque(leque){
  return !!leque;
}

// Só executa o carregamento de dados uma vez por sessão de página — evita duplicar
// listeners/chamadas se o usuário deslogar e logar de novo sem recarregar a aba.
function iniciarApp(){
  if(appJaIniciado) return;
  appJaIniciado = true;
  carregarConfigLocal();
  renderConfig();
  renderPerfilTecnico();
  loadTurnoInfo();
  loadData();
  iniciarTempoReal();
  loadHistoricoExportacoes();
}

// Reúne num só lugar o que precisa acontecer sempre que uma sessão é confirmada
// (login normal, sessão restaurada, ou cache offline): mostrar o app, carregar a
// empresa do usuário, e só então liberar o carregamento de dados. Se a conta não
// tiver empresa vinculada (erro de configuração do administrador), não libera.
async function entrarNoApp(user){
  mostrarApp(user);
  iniciarApp();
}

async function fazerLogin(){
  const email = el('login-email').value.trim();
  const senha = el('login-senha').value;
  if(!email || !senha){
    el('login-erro').textContent = 'Preencha e-mail e senha.';
    return;
  }
  const btn = el('btn-login');
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Entrando...';
  const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
  btn.disabled = false;
  btn.textContent = textoOriginal;
  if(error){
    el('login-erro').textContent = 'E-mail ou senha incorretos.';
    return;
  }
  await entrarNoApp(data.user);
}

async function fazerLogout(){
  const pend = (typeof falhasDeEnvio !== 'undefined' ? falhasDeEnvio.size : 0) + (typeof debouncesPendentes !== 'undefined' ? debouncesPendentes.size : 0);
  const msg = pend > 0
    ? `⚠ Você tem ${pend} alteração(ões) que ainda NÃO foram enviadas. Se sair agora, elas ficam guardadas neste aparelho e só sobem quando você entrar de novo com sinal. Sair mesmo assim?`
    : 'Sair do BlastHole Manager?';
  if(!(await confirmDialog(msg, pend > 0 ? 'Sair mesmo assim' : 'Sair'))) return;
  await db.auth.signOut();
  limparSessaoCache();
  mostrarLogin();
}

el('btn-login').addEventListener('click', fazerLogin);
['login-email','login-senha'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); fazerLogin(); } });
});
el('btn-logout').addEventListener('click', fazerLogout);

// Ao carregar a página, confere se já existe uma sessão válida guardada (o próprio
// Supabase persiste o token no localStorage) — se tiver, entra direto sem pedir login
// de novo; se não tiver (ou expirou), mostra a tela de login.
async function verificarSessaoInicial(){
  const cache = lerSessaoCache();
  try{
    const { data } = await db.auth.getSession();
    if(data && data.session){
      await entrarNoApp(data.session.user);
      return;
    }
    // O SDK diz que não tem sessão. Se estiver online, confia nisso — é um
    // "deslogado" de verdade. Se estiver offline e já tinha logado antes nesse
    // aparelho, deixa continuar (pode só ser o token que não conseguiu renovar
    // sem sinal, o que é esperado num turno de horas no subsolo).
    if(navigator.onLine || !cache){
      mostrarLogin();
    }else{
      await entrarNoApp(cache);
    }
  }catch(e){
    // Erro ao consultar a sessão — bem comum sem conexão. Se já logou antes
    // nesse aparelho, deixa trabalhar localmente em vez de travar o turno inteiro.
    if(cache){
      await entrarNoApp(cache);
    }else{
      mostrarLogin();
    }
  }
}

// Reage a mudanças de sessão (login em outra aba, token expirado, logout remoto etc.)
db.auth.onAuthStateChange((evento, session)=>{
  if(evento === 'SIGNED_OUT'){
    // Defesa extra: um SIGNED_OUT disparado sem sinal (renovação de token que falhou
    // por falta de rede, não por logout de verdade) não deve travar quem já estava
    // trabalhando. Só força a tela de login se estiver online ou nunca logou aqui.
    if(navigator.onLine || !lerSessaoCache()){
      mostrarLogin();
    }
  }else if(evento === 'SIGNED_IN' && session){
    entrarNoApp(session.user);
  }
});

verificarSessaoInicial();

document.addEventListener('click', (e)=>{
  const t = e.target && e.target.closest ? e.target.closest('#infografico-semana-ant, #infografico-semana-prox, #infografico-mes-ant, #infografico-mes-prox') : null;
  if(!t) return;
  if(t.id.startsWith('infografico-mes')) mudarMesInfografico(t.id === 'infografico-mes-ant' ? -1 : 1);
  else mudarSemanaInfografico(t.id === 'infografico-semana-ant' ? -1 : 1);
});

// marca que o script chegou até o fim sem erro (conferido no dash.html)

// Ao voltar para a aba/app (ex.: celular desbloqueado depois de um tempo), puxa as
// mudanças das outras equipes, mas só se não houver nada pendente de envio e se o
// usuário não estiver com uma janela de edição aberta.
let ultimoRefreshFoco = Date.now();
document.addEventListener('visibilitychange', async ()=>{
  if(document.visibilityState !== 'visible') return;
  if(!usuarioAtual || !navigator.onLine) return;
  if(Date.now() - ultimoRefreshFoco < 60000) return;
  if(falhasDeEnvio.size > 0 || enviosEmAndamento > 0) return;
  if(document.querySelector('.modal-overlay')) return;
  ultimoRefreshFoco = Date.now();
  try{ await atualizarDoServidor(); }catch(e){}
});

// ---------- Tempo real: dois técnicos no mesmo realce ----------
// O Supabase avisa quando alguém marca/desmarca algo no checklist. A tela
// atualiza sozinha e mostra quem fez, sem esperar o toque em "Atualizar".
let canalChecklist = null;
let renderChecklistPendente = false;
function renderChecklistSeguro(){
  if(arrastandoChecklist){ renderChecklistPendente = true; return; }
  // Não recria a lista enquanto a pessoa digita num campo dela (perderia o foco/texto).
  const ativo = document.activeElement;
  if(ativo && ativo.closest && ativo.closest('#checklist-grid') && /^(INPUT|SELECT|TEXTAREA)$/.test(ativo.tagName) && ativo.type !== 'checkbox'){
    renderChecklistPendente = true; return;
  }
  renderChecklistPendente = false;
  renderChecklist();
}
document.addEventListener('pointerup', ()=>{ if(renderChecklistPendente && !arrastandoChecklist) setTimeout(()=>renderChecklistSeguro(), 300); });
document.addEventListener('focusout', ()=>{ if(renderChecklistPendente) setTimeout(()=>{ if(renderChecklistPendente) renderChecklistSeguro(); }, 250); });

function tenhoEdicaoPendente(tabela, id){
  for(const k of debouncesPendentes.keys()) if(k.startsWith(tabela + ':') && k.endsWith(':' + id)) return true;
  for(const f of falhasDeEnvio.values()) if(f.tabela === tabela && f.registro && f.registro.id === id) return true;
  return false;
}
function codigoDoChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  return c ? (PREFIXO[c.tipo] || '') + c.numero : '';
}
function aoMudarFuroTempoReal(p){
  try{
    if(p.eventType === 'DELETE'){
      const id = p.old && p.old.id;
      if(id && checklistFuros.some(x=>x.id===id)){ checklistFuros = checklistFuros.filter(x=>x.id!==id); salvarChecklistFurosLocal(); renderChecklistSeguro(); }
      return;
    }
    const row = p.new; if(!row || !row.id) return;
    if(tenhoEdicaoPendente('checklist_furos', row.id)) return;
    const novo = mapChecklistFuro(row);
    const atual = checklistFuros.find(x=>x.id===row.id);
    if(!atual){
      if(checklistLeques.some(c=>c.id===novo.checklistLequeId)){ checklistFuros.push(novo); salvarChecklistFurosLocal(); renderChecklistSeguro(); }
      return;
    }
    const eu = nomeDoUsuario();
    const mudancas = [];
    if(atual.perfilado !== novo.perfilado) mudancas.push({ por: novo.perfiladoPor, txt: novo.perfilado ? 'perfilado' : 'desmarcou perfilado' });
    if(atual.topografado !== novo.topografado) mudancas.push({ por: novo.topografadoPor, txt: novo.topografado ? 'topografado' : 'desmarcou topografado' });
    if((atual.obstruido||'') !== (novo.obstruido||'')) mudancas.push({ por: novo.obstruidoPor, txt: novo.obstruido ? 'obstruído' : 'liberado' });
    const metrDiff = atual.metragem !== novo.metragem || (atual.equipePerfId||null) !== (novo.equipePerfId||null) || (atual.equipeTopoId||null) !== (novo.equipeTopoId||null);
    if(!mudancas.length && !metrDiff) return; // eco da minha própria gravação
    Object.assign(atual, novo);
    salvarChecklistFurosLocal();
    renderChecklistSeguro();
    const dosOutros = mudancas.filter(m=> m.por && m.por !== eu);
    if(dosOutros.length){
      const m = dosOutros[0];
      showToast(`${m.por}: F${atual.numero} de ${codigoDoChecklistLeque(atual.checklistLequeId)} ${m.txt}.`, { erro:false });
    }
  }catch(e){}
}
function aoMudarLequeTempoReal(p){
  try{
    if(p.eventType === 'DELETE'){
      const id = p.old && p.old.id;
      if(id && checklistLeques.some(x=>x.id===id)){ checklistLeques = checklistLeques.filter(x=>x.id!==id); checklistFuros = checklistFuros.filter(f=>f.checklistLequeId!==id); salvarChecklistLocal(); salvarChecklistFurosLocal(); renderChecklistSeguro(); }
      return;
    }
    const row = p.new; if(!row || !row.id) return;
    if(tenhoEdicaoPendente('checklist_leques', row.id)) return;
    const novo = mapChecklistLeque(row);
    const atual = checklistLeques.find(x=>x.id===row.id);
    if(!atual){ checklistLeques.push(novo); salvarChecklistLocal(); renderChecklistSeguro(); return; }
    const mudou = atual.perfilado !== novo.perfilado || atual.observacao !== novo.observacao || (atual.localizacao||'') !== (novo.localizacao||'') || atual.ordem !== novo.ordem || (atual.equipePerfId||null) !== (novo.equipePerfId||null) || (atual.equipeTopoId||null) !== (novo.equipeTopoId||null);
    if(!mudou) return;
    const perfMudou = atual.perfilado !== novo.perfilado;
    Object.assign(atual, novo);
    salvarChecklistLocal();
    renderChecklistSeguro();
    if(perfMudou && novo.perfiladoPor && novo.perfiladoPor !== nomeDoUsuario()) showToast(`${novo.perfiladoPor}: ${(PREFIXO[novo.tipo]||'')}${novo.numero} ${novo.perfilado ? 'perfilado' : 'desmarcado'}.`);
  }catch(e){}
}
// ---------- Comunicados do gestor ----------
// Avisos importantes que o gestor publica para os turnos. Aparecem numa faixa no topo de todas as
// telas (urgentes em vermelho) até vencer a validade, e chegam na hora aos outros aparelhos.
const COMUNICADOS_LOCAL_KEY = 'perfilagem-comunicados-v1';
let comunicados = [];            // { id, projeto, titulo, texto, prioridade, validoAte, criadoPor, ts }
let comunicadoPrioridade = 'normal';
let avisoGestorAberto = false;

function mapComunicado(row){ return { id: row.id, projeto: row.projeto || '', titulo: row.titulo || '', texto: row.texto || '', prioridade: row.prioridade === 'urgente' ? 'urgente' : 'normal', validoAte: row.valido_ate, criadoPor: row.criado_por || '', ts: row.criado_em }; }
function carregarComunicadosLocal(){ try{ comunicados = JSON.parse(localStorage.getItem(COMUNICADOS_LOCAL_KEY) || '[]'); }catch(e){ comunicados = []; } }
function salvarComunicadosLocal(){ try{ localStorage.setItem(COMUNICADOS_LOCAL_KEY, JSON.stringify(comunicados)); }catch(e){} }
carregarComunicadosLocal();

function comunicadoVigente(c){ return new Date(c.validoAte).getTime() > Date.now(); }
// Sem projeto escolhido vê tudo; com projeto, vê os de "todos os projetos" e os dele.
function comunicadoDoEscopo(c){ const p = configApp.projetoAtivo; return !c.projeto || !p || c.projeto === p; }
function comunicadosVigentesNoEscopo(){
  return comunicados.filter(c=> comunicadoVigente(c) && comunicadoDoEscopo(c))
    .sort((a,b)=> (b.prioridade==='urgente') - (a.prioridade==='urgente') || new Date(b.ts) - new Date(a.ts));
}
function textoRestanteComunicado(c){
  const ms = new Date(c.validoAte).getTime() - Date.now();
  if(ms <= 0) return 'encerrado';
  const dias = Math.ceil(ms / 86400000);
  return dias <= 1 ? 'vence em até 1 dia' : `vence em ${dias} dias`;
}
function htmlCartaoComunicado(c, podeApagar){
  const quando = c.ts ? new Date(c.ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
  return `<article class="com ${c.prioridade==='urgente' ? 'urgente' : ''}">
    <div class="com-topo">${c.prioridade==='urgente' ? '<span class="com-etq u">⚠ URGENTE</span>' : ''}<span class="com-etq">${c.projeto ? escHtml(c.projeto) : 'Todos os projetos'}</span></div>
    <h3>${escHtml(c.titulo)}</h3>
    ${c.texto ? `<p>${escHtml(c.texto)}</p>` : ''}
    <div class="com-meta"><span>${escHtml(c.criadoPor || 'gestor')}${quando ? ' · ' + quando : ''} · ${textoRestanteComunicado(c)}</span>${podeApagar ? `<button type="button" class="com-apagar" onclick="apagarComunicado('${c.id}')" aria-label="apagar comunicado ${escHtml(c.titulo)}">Apagar</button>` : ''}</div>
  </article>`;
}
function renderAvisoGestor(){
  const box = el('aviso-gestor'); if(!box) return;
  const ativos = comunicadosVigentesNoEscopo();
  if(!ativos.length){ box.style.display = 'none'; box.innerHTML = ''; return; }
  const urg = ativos.some(c=>c.prioridade==='urgente');
  box.style.display = 'block';
  box.className = 'aviso-gestor' + (urg ? ' urgente' : '');
  box.innerHTML = `<button type="button" class="aviso-gestor-cab" onclick="alternarAvisoGestor()" aria-expanded="${avisoGestorAberto}">
      <span class="rot">${urg ? '⚠ Urgente' : 'Gestor'}</span><span class="ult">${escHtml(ativos[0].titulo)}</span>
      <span class="mais">${ativos.length > 1 ? '+' + (ativos.length - 1) + ' ' : ''}${avisoGestorAberto ? '▴' : '▾'}</span></button>
    ${avisoGestorAberto ? `<div class="aviso-gestor-corpo">${ativos.map(c=>htmlCartaoComunicado(c, false)).join('')}</div>` : ''}`;
}
function alternarAvisoGestor(){ avisoGestorAberto = !avisoGestorAberto; renderAvisoGestor(); }

function renderComunicados(){
  renderAvisoGestor();
  const lista = el('comunicados-lista'); if(!lista) return;
  const ativos = comunicadosVigentesNoEscopo();
  const enc = comunicados.filter(c=> !comunicadoVigente(c) && comunicadoDoEscopo(c)).sort((a,b)=> new Date(b.validoAte) - new Date(a.validoAte)).slice(0, 10);
  el('comunicados-cont').textContent = ativos.length;
  if(typeof aplicarSecoesTurno === 'function' && !('comunicados' in turnoSecoes)) aplicarSecoesTurno();
  lista.innerHTML = (ativos.length ? ativos.map(c=>htmlCartaoComunicado(c, true)).join('') : '<div class="hint">Nenhum comunicado em vigor.</div>')
    + (enc.length ? `<details class="com-enc"><summary>Encerrados (${enc.length})</summary>${enc.map(c=>htmlCartaoComunicado(c, true)).join('')}</details>` : '');
  const sel = el('com-projeto');
  if(sel){
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todos os projetos</option>' + projetos.map(p=>`<option value="${escHtml(p.nome)}">${escHtml(p.nome)}</option>`).join('');
    sel.value = atual && projetos.some(p=>p.nome===atual) ? atual : (configApp.projetoAtivo || '');
  }
}
function definirPrioridadeComunicado(v){
  comunicadoPrioridade = v === 'urgente' ? 'urgente' : 'normal';
  document.querySelectorAll('#com-prioridade button').forEach(b=> b.setAttribute('aria-pressed', String(b.dataset.p === comunicadoPrioridade)));
}
function publicarComunicado(){
  const titulo = el('com-titulo').value.trim(), texto = el('com-texto').value.trim();
  if(!titulo){ showToast('Escreva um título para o comunicado.', { erro:false }); el('com-titulo').focus(); return; }
  const dias = Math.min(60, Math.max(1, parseInt(el('com-dias').value, 10) || 7));
  const c = { id: uuidv4(), projeto: el('com-projeto').value || '', titulo, texto, prioridade: comunicadoPrioridade,
    validoAte: new Date(Date.now() + dias * 86400000).toISOString(), criadoPor: nomeDoUsuario(), ts: new Date().toISOString() };
  comunicados.push(c);
  salvarComunicadosLocal();
  enfileirar('comunicados', 'insert', { id: c.id, projeto: c.projeto, titulo: c.titulo, texto: c.texto, prioridade: c.prioridade, valido_ate: c.validoAte, criado_por: c.criadoPor });
  el('com-titulo').value = ''; el('com-texto').value = '';
  definirPrioridadeComunicado('normal');
  avisoGestorAberto = true;
  renderComunicados();
  showToast('Comunicado publicado para os turnos.');
}
function apagarComunicado(id){
  const c = comunicados.find(x=>x.id===id); if(!c) return;
  comunicados = comunicados.filter(x=>x.id!==id);
  salvarComunicadosLocal();
  enfileirar('comunicados', 'delete', { id });
  renderComunicados();
  showToast('Comunicado apagado.', { acaoLabel:'Desfazer', onAcao: ()=>{
    comunicados.push(c); salvarComunicadosLocal();
    enfileirar('comunicados', 'insert', { id: c.id, projeto: c.projeto, titulo: c.titulo, texto: c.texto, prioridade: c.prioridade, valido_ate: c.validoAte, criado_por: c.criadoPor });
    renderComunicados();
  }});
}
function aoMudarComunicadoTempoReal(p){
  try{
    if(p.eventType === 'DELETE'){
      const id = p.old && p.old.id;
      if(id && comunicados.some(x=>x.id===id)){ comunicados = comunicados.filter(x=>x.id!==id); salvarComunicadosLocal(); renderComunicados(); }
      return;
    }
    const row = p.new; if(!row || !row.id) return;
    const novo = mapComunicado(row);
    const i = comunicados.findIndex(x=>x.id===row.id);
    if(i >= 0) comunicados[i] = novo; else comunicados.push(novo);
    salvarComunicadosLocal();
    renderComunicados();
    if(i < 0 && novo.criadoPor !== nomeDoUsuario() && comunicadoVigente(novo) && comunicadoDoEscopo(novo)){
      showToast(`${novo.prioridade==='urgente' ? '⚠ URGENTE: ' : 'Comunicado: '}${novo.titulo}`, { erro:false });
    }
  }catch(e){}
}

function iniciarTempoReal(){
  if(canalChecklist || typeof db.channel !== 'function') return;
  try{
    canalChecklist = db.channel('checklist-tempo-real')
      .on('postgres_changes', { event:'*', schema:'public', table:'checklist_furos' }, aoMudarFuroTempoReal)
      .on('postgres_changes', { event:'*', schema:'public', table:'checklist_leques' }, aoMudarLequeTempoReal)
      .on('postgres_changes', { event:'*', schema:'public', table:'comunicados' }, aoMudarComunicadoTempoReal)
      .subscribe();
  }catch(e){ canalChecklist = null; }
}
function pararTempoReal(){
  try{ if(canalChecklist && typeof db.removeChannel === 'function') db.removeChannel(canalChecklist); }catch(e){}
  canalChecklist = null;
}

window.__appCarregado = true;



/* ================= Fila offline visível ================= */
function descreverItemFila(it){
  const r = it.registro || {};
  const nome = NOME_TABELA_FILA[it.tabela] || it.tabela;
  const acao = { insert:'novo', update:'alterado', delete:'removido', upsert:'salvo' }[it.acao] || it.acao;
  let det = '';
  if(it.tabela === 'checklist_furos'){
    const f = checklistFuros.find(x=>x.id===r.id);
    const c = f && checklistLeques.find(x=>x.id===f.checklistLequeId);
    const campos = [];
    if('perfilado' in r) campos.push(r.perfilado ? 'perfilado' : 'perfilado desmarcado');
    if('topografado' in r) campos.push(r.topografado ? 'topografado' : 'topografado desmarcado');
    if('obstruido' in r) campos.push(r.obstruido ? 'obstruído' : 'liberado');
    det = [f ? `${c ? PREFIXO[c.tipo] + c.numero + ' · ' : ''}F${f.numero}` : '', campos.join(', ')].filter(Boolean).join(' — ');
  }else if(it.tabela === 'checklist_leques'){
    const c = checklistLeques.find(x=>x.id===r.id);
    det = [c ? PREFIXO[c.tipo] + c.numero : '', ('perfilado' in r) ? (r.perfilado ? 'perfilado' : 'desmarcado') : ('observacao' in r ? 'observação' : '')].filter(Boolean).join(' — ');
  }
  return { nome, acao, det, desde: it.desde };
}
function abrirFilaOffline(){
  const root = el('modal-root'); if(!root) return;
  const itens = itensDaFila();
  const falhas = falhasDeEnvio.size;
  const linhas = itens.map(it=>{
    const d = descreverItemFila(it);
    return `<li><b>${escHtml(d.nome)}</b> <small>(${escHtml(d.acao)})</small>${d.det ? `<div>${escHtml(d.det)}</div>` : ''}<small>${d.desde ? 'parado ' + tempoRelativo(d.desde) : 'enviando agora'}</small></li>`;
  }).join('');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga">
    <h3 style="margin:0 0 6px">${itens.length ? `${itens.length} alteração(ões) ainda não enviadas` : 'Tudo salvo ✓'}</h3>
    <p class="hint" style="margin:0 0 10px">${itens.length ? 'Estão guardadas neste aparelho e sobem sozinhas quando houver sinal. Não feche o navegador limpando os dados antes disso.' : 'Nada pendente: o gestor e o próximo turno já veem o que você marcou.'}</p>
    ${itens.length ? `<ul class="fila-lista">${linhas}</ul>` : ''}
    <div class="modal-actions"><button class="ghost" id="fila-fechar">Fechar</button>${falhas ? '<button id="fila-tentar">Tentar agora</button>' : ''}</div></div></div>`;
  el('fila-fechar').onclick = ()=>{ root.innerHTML = ''; };
  const t = el('fila-tentar');
  if(t) t.onclick = async ()=>{ t.disabled = true; t.textContent = 'Enviando...'; await reenviarFalhas(); abrirFilaOffline(); };
}
(function(){
  const pill = document.getElementById('status-salvamento');
  if(pill){ pill.setAttribute('role','button'); pill.tabIndex = 0; pill.addEventListener('click', abrirFilaOffline); pill.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); abrirFilaOffline(); } }); }
  const btn = document.getElementById('btn-ver-fila');
  if(btn) btn.addEventListener('click', abrirFilaOffline);
  window.addEventListener('beforeunload', e=>{ if(falhasDeEnvio.size > 0){ e.preventDefault(); e.returnValue = ''; } });
})();

/* ================= Tutorial do primeiro uso ================= */
const TUTORIAL_KEY = 'perfilagem-tutorial-v1';
function tutorialJaVisto(){ try{ return localStorage.getItem(TUTORIAL_KEY) === '1'; }catch(e){ return true; } }
const TUTORIAL_PASSOS = [
  { icone:'📍', titulo:'1. Realce e leques', texto:'Na aba <b>Realce</b>, crie ou escolha o realce em que você está. Depois, no <b>Checklist</b>, toque em “Adicionar leques” e informe os números e os furos de cada um.' },
  { icone:'✅', titulo:'2. Marcar furos', texto:'Abra o leque e toque na célula do furo: <b>Perf.</b> (perfilado), <b>Topo</b> (topografado) ou <b>Obstr.</b>. Marcou errado? Toque em <b>Desfazer</b> no aviso que aparece embaixo.' },
  { icone:'🎨', titulo:'3. Cores e ícones', texto:'Cada leque mostra o estado: ✓ completo (verde), ◐ em andamento (amarelo), ⚠ obstrução alta (vermelho) e ○ não iniciado (cinza). A barra fixa no topo mostra o andamento do realce.' },
  { icone:'📶', titulo:'4. Sem sinal e WhatsApp', texto:'Sem internet, continue marcando: tudo fica guardado no aparelho e sobe sozinho. Toque no aviso <b>salvo / sem salvar</b> no canto para ver o que falta. Ao fim do turno, use <b>Enviar no WhatsApp</b> na aba Turno.' }
];
function fecharTutorial(){ try{ localStorage.setItem(TUTORIAL_KEY, '1'); }catch(e){} const r = el('modal-root'); if(r) r.innerHTML = ''; }
function abrirTutorial(i){
  const root = el('modal-root'); if(!root) return;
  const p = TUTORIAL_PASSOS[i]; const ultimo = i === TUTORIAL_PASSOS.length - 1;
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga tutorial-box">
    <div class="tut-icone" aria-hidden="true">${p.icone}</div><h3 style="margin:0 0 8px">${p.titulo}</h3><p>${p.texto}</p>
    <div class="tut-pontos" aria-hidden="true">${TUTORIAL_PASSOS.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
    <div class="modal-actions"><button class="ghost" id="tut-pular">${ultimo ? 'Fechar' : 'Pular'}</button>${i>0 ? '<button class="ghost" id="tut-ant">Voltar</button>' : ''}${ultimo ? '' : '<button id="tut-prox">Próximo</button>'}</div></div></div>`;
  el('tut-pular').onclick = fecharTutorial;
  if(i>0) el('tut-ant').onclick = ()=> abrirTutorial(i-1);
  if(!ultimo) el('tut-prox').onclick = ()=> abrirTutorial(i+1);
}


/* ================= Esqueletos de carregamento ================= */
function htmlEsqueleto(n){
  return Array.from({length:n}, ()=> `<div class="esqueleto-card" aria-hidden="true"><i class="esq-linha l1"></i><i class="esq-linha l2"></i><i class="esq-linha l3"></i></div>`).join('');
}
function mostrarEsqueletos(on){
  document.body.classList.toggle('carregando-dados', on);
  ['lista','checklist-grid'].forEach(id=>{
    const c = el(id); if(!c) return;
    if(on && !c.children.length) c.innerHTML = htmlEsqueleto(3);
    if(!on) c.querySelectorAll('.esqueleto-card').forEach(n=> n.remove());
  });
}
(function(){
  const original = atualizarDoServidor;
  atualizarDoServidor = async function(){
    const semDados = !aneis.length && !checklistLeques.length && !leques.length;
    if(semDados && navigator.onLine) mostrarEsqueletos(true);
    try{ return await original.apply(this, arguments); }
    finally{ if(document.body.classList.contains('carregando-dados')){ mostrarEsqueletos(false); try{ renderAll(); }catch(e){} } }
  };
})();

/* ================= Puxar para atualizar ================= */
(function(){
  const LIMITE = 90;
  let y0 = null, dy = 0, ativo = false;
  const ind = document.createElement('div');
  ind.id = 'ptr'; ind.setAttribute('aria-hidden','true');
  ind.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  document.body.appendChild(ind);
  const mover = v => { ind.style.transform = `translate(-50%, ${v - 56}px) rotate(${v * 3}deg)`; ind.style.opacity = Math.min(1, v / LIMITE); ind.classList.toggle('pronto', v >= LIMITE); };
  document.addEventListener('touchstart', e=>{
    y0 = null; dy = 0; ativo = false;
    if(window.scrollY > 0 || !usuarioAtual || document.querySelector('.modal-overlay') || (typeof arrastandoChecklist !== 'undefined' && arrastandoChecklist)) return;
    if(e.target.closest && e.target.closest('.tabela-wrap, input, select, textarea, .ck-arrastar, .tabbar')) return;
    y0 = e.touches[0].clientY;
  }, { passive:true });
  document.addEventListener('touchmove', e=>{
    if(y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if(dy <= 0 || window.scrollY > 0){ if(ativo){ ativo = false; ind.style.opacity = 0; } return; }
    ativo = true; ind.classList.remove('girando'); mover(Math.min(dy * 0.55, 120));
  }, { passive:true });
  document.addEventListener('touchend', async ()=>{
    if(!ativo){ y0 = null; return; }
    const ok = Math.min(dy * 0.55, 120) >= LIMITE;
    y0 = null; ativo = false;
    if(!ok){ ind.style.opacity = 0; return; }
    ind.classList.add('girando'); ind.style.transform = 'translate(-50%, 16px)'; ind.style.opacity = 1; vibrarCurto(15);
    try{ await sincronizarDoServidor(); }catch(e){}
    ind.classList.remove('girando'); ind.style.opacity = 0;
  });
})();

(function(){
  const b = document.getElementById('btn-ver-senha'), i = document.getElementById('login-senha');
  if(!b || !i) return;
  b.addEventListener('click', ()=>{ const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; b.textContent = ver ? 'Ocultar' : 'Mostrar'; b.setAttribute('aria-pressed', ver); b.setAttribute('aria-label', ver ? 'ocultar senha' : 'mostrar senha'); i.focus(); });
})();


/* ================= Componentes: Esc fecha janelas, dicas (?) em janelinha, toque com ondinha ================= */
document.addEventListener('keydown', e=>{
  if(e.key !== 'Escape') return;
  const ov = document.querySelector('.modal-overlay'); if(!ov) return;
  const c = ov.querySelector('#modal-cancelar, #fila-fechar, #tut-pular, .modal-fechar, button.ghost');
  if(c){ e.preventDefault(); c.click(); }
});

// "?" abre uma janelinha curta no lugar de expandir o texto no meio do formulário.
document.addEventListener('click', e=>{
  const sum = e.target.closest && e.target.closest('.ajuda > summary');
  if(!sum) return;
  e.preventDefault();
  const det = sum.parentElement, hint = det.querySelector('.hint');
  const root = el('modal-root'); if(!root || !hint) return;
  const titulo = (det.closest('.view-card, .panel') && (det.closest('.view-card, .panel').querySelector('.view-card-label, h2') || {}).textContent) || 'Ajuda';
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-ajuda" role="dialog" aria-modal="true">
    <div class="modal-ico" aria-hidden="true">?</div><h3>${escHtml(String(titulo).trim().replace(/\s+/g,' ').slice(0,60))}</h3>
    <div class="modal-ajuda-txt">${hint.innerHTML}</div>
    <div class="modal-actions"><button class="steel modal-fechar" id="ajuda-ok">Entendi</button></div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('ajuda-ok').onclick = fechar; el('ajuda-ok').focus();
  el('modal-overlay').addEventListener('click', ev=>{ if(ev.target.id === 'modal-overlay') fechar(); });
});

// Ondinha no toque: confirma que o dedo (de luva) acertou.
document.addEventListener('pointerdown', e=>{
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const alvo = e.target.closest && e.target.closest('button:not(.tab-item):not(.ck-furo-num):not(.ck-arrastar):not(:disabled), .ck-chip, .ck-cab, .sit-botoes button, .menu-mais button');
  if(!alvo || alvo.closest('.tabbar')) return;
  const r = alvo.getBoundingClientRect();
  if(r.width > 520 || r.height > 140) return; // não em cartões enormes
  const pos = getComputedStyle(alvo).position;
  const marcou = pos === 'static';
  if(marcou) alvo.style.position = 'relative';
  const antes = alvo.style.overflow; alvo.style.overflow = 'hidden';
  const d = Math.max(r.width, r.height) * 2;
  const o = document.createElement('span'); o.className = 'ondinha';
  o.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d/2}px;top:${e.clientY - r.top - d/2}px`;
  alvo.appendChild(o);
  setTimeout(()=>{ o.remove(); alvo.style.overflow = antes; if(marcou) alvo.style.position = ''; }, 520);
}, { passive:true });


/* ================= Mapa do realce e atividade recente (aba Checklist) ================= */
function renderMapaRealce(){
  const box = el('ck-mapa'); if(!box) return;
  const itens = checklistDoAnelAtivo();
  const ord = [...itens].sort((a,b)=> (PREFIXO[a.tipo]+a.numero).localeCompare(PREFIXO[b.tipo]+b.numero, undefined, {numeric:true}));
  let tot = 0, ok = 0;
  box.innerHTML = ord.length ? ord.map(c=>{
    const fl = checklistFurosDoLeque(c.id).slice().sort((a,b)=> String(a.numero).localeCompare(String(b.numero), undefined, {numeric:true}));
    const cel = fl.map(f=>{
      tot++;
      const cl = f.obstruido ? 'm-obs' : (f.perfilado && f.topografado) ? (ok++, 'm-ok') : f.perfilado ? 'm-perf' : f.topografado ? 'm-topo' : 'm-nada';
      const rot = f.obstruido ? 'obstruído' : f.perfilado && f.topografado ? 'perfilado e topografado' : f.perfilado ? 'só perfilado' : f.topografado ? 'só topografado' : 'pendente';
      return `<i class="${cl}" title="F${escHtml(f.numero)} — ${rot}"></i>`;
    }).join('');
    return `<button type="button" class="mapa-linha" onclick="irParaFuroBuscado('${PREFIXO[c.tipo]}${c.numero}')"><b>${PREFIXO[c.tipo]}${escHtml(c.numero)}</b><span class="mapa-cels">${cel || '<em>sem furos</em>'}</span></button>`;
  }).join('') : '<div class="hint">Nenhum leque neste realce ainda.</div>';
  const r = el('ck-mapa-resumo'); if(r) r.textContent = tot ? `${ok}/${tot} completos` : '';
}
function renderAtividadeRecente(){
  const box = el('ck-ativ'); if(!box) return;
  const ids = new Set(checklistDoAnelAtivo().map(c=>c.id));
  const ev = [];
  checklistFuros.forEach(f=>{
    if(!ids.has(f.checklistLequeId)) return;
    const c = checklistLeques.find(x=>x.id===f.checklistLequeId); const cod = c ? PREFIXO[c.tipo]+c.numero : '';
    if(f.perfilado && f.perfiladoEm) ev.push({ t:f.perfiladoEm, txt:`${cod} F${f.numero} perfilado`, por:f.perfiladoPor, k:'perf' });
    if(f.topografado && f.topografadoEm) ev.push({ t:f.topografadoEm, txt:`${cod} F${f.numero} topografado`, por:f.topografadoPor, k:'topo' });
  });
  ev.sort((a,b)=> new Date(b.t) - new Date(a.t));
  const rec = ev.slice(0, 15);
  const r = el('ck-ativ-resumo'); if(r) r.textContent = ev.length ? `${ev.length}` : '';
  box.innerHTML = rec.length ? rec.map(e=>`<div class="ativ-linha ${e.k}"><span class="ativ-hora">${tempoRelativo(new Date(e.t).getTime())}</span><span class="ativ-txt">${escHtml(e.txt)}</span>${e.por ? `<span class="ativ-por">${escHtml(e.por)}</span>` : ''}</div>`).join('') : '<div class="hint">Nenhuma marcação ainda neste realce.</div>';
}
(function(){
  const orig = renderChecklist;
  renderChecklist = function(){ const r = orig.apply(this, arguments); try{ renderMapaRealce(); renderAtividadeRecente(); }catch(e){} return r; };
})();


/* ================= Passagem de turno ================= */
function pendenciasPassagem(){
  const itens = checklistDoAnelAtivo();
  const linhas = [];
  let nPerf = 0, nTopo = 0, nObs = 0;
  itens.forEach(c=>{
    const fl = checklistFurosDoLeque(c.id);
    const perf = fl.filter(f=>!f.perfilado && !f.obstruido).map(f=>'F'+f.numero);
    const topo = fl.filter(f=>f.perfilado && !f.topografado && !f.obstruido).map(f=>'F'+f.numero);
    const obs = fl.filter(f=>f.obstruido).map(f=>'F'+f.numero);
    nPerf += perf.length; nTopo += topo.length; nObs += obs.length;
    if(perf.length || topo.length || obs.length || !fl.length) linhas.push({ cod: PREFIXO[c.tipo] + c.numero, perf, topo, obs, vazio: !fl.length });
  });
  return { linhas, nPerf, nTopo, nObs, total: itens.length };
}
function renderPassagemTurno(){
  const box = el('passagem-lista'); if(!box) return;
  const d = pendenciasPassagem();
  const r = el('passagem-resumo');
  if(r) r.textContent = d.total ? `${d.nPerf} a perfilar · ${d.nTopo} a topografar` : '';
  const lista = (rot, arr)=> arr.length ? `<span class="pass-grupo"><em>${rot}</em> ${arr.slice(0,10).join(', ')}${arr.length>10 ? ` +${arr.length-10}` : ''}</span>` : '';
  box.innerHTML = !d.total ? '<div class="hint">Nenhum leque no checklist deste realce.</div>'
    : (d.linhas.length ? d.linhas.slice(0,12).map(l=>`<div class="pass-linha"><b>${escHtml(l.cod)}</b><div>${l.vazio ? '<span class="pass-grupo"><em>sem furos lançados</em></span>' : lista('perfilar', l.perf) + lista('topografar', l.topo) + lista('obstruído', l.obs)}</div></div>`).join('') + (d.linhas.length > 12 ? `<div class="hint">+${d.linhas.length-12} leques com pendência</div>` : '')
      : '<div class="passagem-ok">✓ Nada pendente: tudo perfilado e topografado.</div>');
}
(function(){
  const b = el('passagem-obs');
  if(b) b.addEventListener('click', ()=>{
    const d = pendenciasPassagem();
    if(!d.linhas.length){ showToast('Nada pendente para registrar.'); return; }
    const txt = 'Passagem: ' + d.linhas.slice(0,6).map(l=> l.cod + (l.perf.length ? ' perf. ' + l.perf.slice(0,6).join(',') : '') + (l.topo.length ? ' topo ' + l.topo.slice(0,6).join(',') : '') + (l.obs.length ? ' obstr. ' + l.obs.join(',') : '')).join(' | ');
    adicionarObservacaoTurno(txt.slice(0, 290), true);
  });
  const orig = renderResumoTurno;
  renderResumoTurno = function(){ const r = orig.apply(this, arguments); try{ renderPassagemTurno(); }catch(e){} return r; };
})();

/* ================= Encerrar turno (conferência antes de sair da mina) ================= */
function dadosFimDeTurno(){
  const dia = (typeof dataBRParaISO === 'function' && dataBRParaISO(turnoInfo.data)) || chaveDia(new Date());
  const noDia = iso => iso && chaveDia(iso) === dia;
  const escopo = new Set(aneisNoEscopoAtual().map(a=>a.id));
  const leques = new Set(checklistLeques.filter(c=>escopo.has(c.anelId)).map(c=>c.id));
  const furos = checklistFuros.filter(f=>leques.has(f.checklistLequeId));
  const perf = furos.filter(f=>f.perfilado && noDia(f.perfiladoEm)).length;
  const topo = furos.filter(f=>f.topografado && noDia(f.topografadoEm)).length;
  const notas = furos.filter(f=>(f.observacao||'').trim()).length;
  const pend = pendenciasPassagem();
  return { perf, topo, notas, pend, obs: observacoesDoTurnoAtual().length, fila: itensDaFila().length };
}
function abrirEncerrarTurno(){
  const root = el('modal-root'); if(!root) return;
  const d = dadosFimDeTurno();
  const sinc = d.fila
    ? `<div class="fim-aviso" role="alert">⚠ ${d.fila} alteração(ões) ainda não sincronizada(s). Salvas no aparelho, mas o gestor só vê quando houver sinal. Não limpe os dados do navegador.</div>`
    : '<div class="fim-ok">✓ Tudo sincronizado.</div>';
  const kpi = (n, r)=> `<div class="fim-kpi"><b>${n}</b><span>${r}</span></div>`;
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga">
    <h3 style="margin:0 0 10px">🏁 Encerrar turno</h3>
    <div class="fim-kpis">${kpi(d.perf,'perfilados hoje')}${kpi(d.topo,'topografados hoje')}${kpi(d.pend.nPerf,'a perfilar')}${kpi(d.pend.nTopo,'a topografar')}${kpi(d.pend.nObs,'obstruídos')}${kpi(d.notas + d.obs,'notas e obs.')}</div>
    ${sinc}
    ${d.pend.linhas.length ? '<label class="fim-check"><input type="checkbox" id="fim-registrar" checked> Registrar a passagem nas observações do turno</label>' : ''}
    <div class="modal-actions" style="flex-wrap:wrap">
      <button class="ghost" id="fim-fechar">Fechar</button>
      <button class="ghost" id="fim-copiar">Copiar</button>
      <button id="fim-enviar">Enviar no WhatsApp</button>
    </div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  const registrar = ()=>{
    const c = el('fim-registrar');
    if(c && c.checked && pendenciasPassagem().linhas.length){ const b = el('passagem-obs'); if(b) b.click(); }
  };
  el('fim-fechar').onclick = fechar;
  el('fim-copiar').onclick = async ()=>{ registrar(); const ok = await copiarTextoResumo(montarResumoTurnoWhatsApp()); fechar(); showToast(ok ? 'Resumo copiado. É só colar onde quiser.' : 'Não foi possível copiar.', { tipo: ok ? 'ok' : 'erro' }); };
  el('fim-enviar').onclick = ()=>{ registrar(); const t = montarResumoTurnoWhatsApp(); const n = configApp.whatsapp; window.open(n ? `https://wa.me/${n}?text=${encodeURIComponent(t)}` : `https://wa.me/?text=${encodeURIComponent(t)}`, '_blank'); fechar(); };
}
(function(){ const b = el('btn-encerrar-turno'); if(b) b.addEventListener('click', abrirEncerrarTurno); })();

/* ================= Usuários travados em equipes ================= */
const USUARIOS_KEY = 'perfilagem-usuarios-v1';
let usuariosEmpresa = []; // { id, email, nome, equipeId }
try{ usuariosEmpresa = JSON.parse(localStorage.getItem(USUARIOS_KEY) || '[]') || []; }catch(e){ usuariosEmpresa = []; }
function minhaEquipeId(){
  if(!usuarioAtual) return null;
  const u = usuariosEmpresa.find(x=>x.id === usuarioAtual.id);
  if(!u || !u.equipeId) return null;
  // se as equipes já carregaram e esta não existe mais, não carimba
  if(equipes.length && !equipes.some(e=>e.id === u.equipeId)) return null;
  return u.equipeId;
}
async function carregarUsuariosEmpresa(){
  if(!usuarioAtual || !navigator.onLine) return;
  try{
    const { data, error } = await db.rpc('listar_usuarios_empresa');
    if(error || !Array.isArray(data)) return;
    usuariosEmpresa = data.map(r=>({ id: r.id, email: r.email, nome: r.nome || '', equipeId: r.equipe_id || null }));
    try{ localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuariosEmpresa)); }catch(e){}
    if(el('eq-usuarios')) renderUsuariosEquipes();
  }catch(e){}
}
function renderUsuariosEquipes(){
  const box = el('eq-usuarios'); if(!box) return;
  if(!usuariosEmpresa.length){ box.innerHTML = ''; carregarUsuariosEmpresa(); return; }
  const opcoes = id => '<option value="">Sem equipe</option>' + equipes.slice().sort((a,b)=> a.nome.localeCompare(b.nome,'pt-BR')).map(e=>`<option value="${e.id}" ${e.id===id?'selected':''}>${escHtml(e.nome)}${e.projeto ? ' · ' + escHtml(e.projeto) : ''}</option>`).join('');
  box.innerHTML = `<div class="equipe-edit-item"><p style="font-weight:700;margin:0 0 4px">Usuários nas equipes</p>
    <p class="hint" style="margin:0 0 8px">Quem está vinculado marca perfilado/topografado e a equipe entra sozinha. Ao vincular, marcações antigas dessa pessoa sem equipe são preenchidas.</p>
    ${usuariosEmpresa.map(u=>`<div class="field"><label>${escHtml(u.nome || u.email.split('@')[0])} <small>${escHtml(u.email)}</small></label><select class="eq-usuario" data-uid="${u.id}">${opcoes(u.equipeId)}</select></div>`).join('')}</div>`;
  box.querySelectorAll('.eq-usuario').forEach(sel=> sel.addEventListener('change', async ()=>{
    if(!navigator.onLine){ showToast('Sem sinal: vincular usuário precisa de internet.', { tipo:'aviso' }); renderUsuariosEquipes(); return; }
    sel.disabled = true;
    const { data, error } = await db.rpc('definir_equipe_usuario', { p_usuario: sel.dataset.uid, p_equipe: sel.value || null });
    sel.disabled = false;
    if(error){ showToast('Não foi possível vincular: ' + error.message, { tipo:'erro' }); renderUsuariosEquipes(); return; }
    const u = usuariosEmpresa.find(x=>x.id === sel.dataset.uid); if(u) u.equipeId = sel.value || null;
    try{ localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuariosEmpresa)); }catch(e){}
    showToast(data > 0 ? `Vinculado. ${data} marcação(ões) antiga(s) atribuída(s) à equipe.` : 'Vinculado.', { tipo:'ok' });
    if(data > 0 && typeof atualizarDoServidor === 'function') atualizarDoServidor();
  }));
}
(function(){
  const orig = atualizarDoServidor;
  atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); carregarUsuariosEmpresa(); return r; };
  window.addEventListener('load', ()=> setTimeout(carregarUsuariosEmpresa, 1500));
})();
