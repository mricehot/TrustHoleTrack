// ======================================================
// COLOQUE AQUI A URL E A CHAVE "anon public" DO SEU PROJETO
// (painel do Supabase → Project Settings → API)
// ======================================================
const SUPABASE_URL = 'https://yccblxqevplzjopkdryb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IFKAde28BGRHIghLcVYT0g_dpT5IBlw';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = id => document.getElementById(id);
const fmt1 = n => (Math.round(n*10)/10).toFixed(1);
const pad2 = n => String(n).padStart(2,'0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function normalizarNumero(str){
  const trimmed = String(str).trim();
  if(/^\d$/.test(trimmed)) return '0' + trimmed;
  return trimmed;
}

function situacaoLabel(s){ return { livre:'Livre', obstruido:'Obstruído', varado:'Varado' }[s] || s; }
function tipoLabel(t){ return { leque:'Leque', slot:'Slot', fill:'Face Livre' }[t] || t; }
function tipoBotaoLabel(t){ return { leque:'Criar Leque', slot:'Criar Slot', fill:'Criar Face Livre' }[t] || 'Criar Medição'; }
function diffClass(diff){ if(diff >= 0) return 'ok'; if(diff >= -0.5) return 'warn'; return 'bad'; }
function diffLabel(diff){ return (diff > 0 ? '+' : '') + fmt1(diff) + ' m'; }
function lequeCode(l){ return PREFIXO[l.tipo] + l.numero; }
function furoCode(l, f){ return lequeCode(l) + 'F' + f.numero; }

const PREFIXO = { leque:'LQ', slot:'SL', fill:'FL' };

// ---------- Tamanhos de fonte usados na geração dos PDFs ----------
// Ajuste os valores abaixo (em pt) para controlar o tamanho das letras nos PDFs exportados.
const PDF_FONT_TITULO = 13;      // título principal do relatório (ex: "STATUS TURNO...")
const PDF_FONT_SUBTITULO = 10;   // linha "Gerado em ..." abaixo do título
const PDF_FONT_INFO = 11;        // dados do turno (Data, Técnicos, Supervisor, etc)
const PDF_FONT_CABECALHO = 10;   // cabeçalho da tabela (Furo/Esperada/Real/Diferenca/Situacao)
const PDF_FONT_CORPO = 10;       // linhas de furos dentro da tabela
const PDF_FONT_LEQUE_TITULO = 12;// "Anel: X" / "Leque: LQ01" acima de cada tabela
const PDF_FONT_TOTAL = 11;       // linha de total/subtotal de cada leque
const PDF_FONT_TOTAL_GERAL = 12; // linha de total geral (PDF combinado)
const PDF_FONT_AVISO = 11;       // aviso "Nenhuma perfilagem..." / "Leques inclusos..."
const LOGO_B64 = "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";



// ---------- Feedback de rede / sincronização ----------
let syncCounter = 0;
let syncTimer = null;
function syncStart(){
  syncCounter++;
  if(syncCounter === 1){
    syncTimer = setTimeout(()=>{
      document.body.classList.add('syncing');
      const badge = document.getElementById('sync-badge');
      if(badge) badge.style.display = 'inline-flex';
    }, 300);
  }
}
function syncEnd(){
  syncCounter = Math.max(0, syncCounter - 1);
  if(syncCounter === 0){
    clearTimeout(syncTimer);
    document.body.classList.remove('syncing');
    const badge = document.getElementById('sync-badge');
    if(badge) badge.style.display = 'none';
  }
}
const _fetchOriginal = window.fetch.bind(window);
window.fetch = function(...args){
  syncStart();
  return _fetchOriginal(...args).finally(syncEnd);
};

function atualizarStatusConexao(){
  const banner = document.getElementById('offline-banner');
  if(banner) banner.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', atualizarStatusConexao);
window.addEventListener('offline', atualizarStatusConexao);
atualizarStatusConexao();

// ---------- Armazenamento local (funciona 100% sem internet) ----------
const LOCAL_KEY = 'perfilagem-local-v1';
const FILA_KEY = 'perfilagem-fila-v1';
const TURNO_LOCAL_KEY = 'perfilagem-turno-local-v1';

let aneis = [];        // { id, nome, ativo }
let leques = [];       // { id, anelId, tipo, numero, nome, status: 'aberto'|'fechado' }
let furos = [];        // { id, lequeId, numero, metragemEsperada, metragemReal, situacao, ts }
let anelAtivoId = null;
let lequesColapsados = new Set();
let lequesSelecionados = new Set();
let filaEnvio = [];     // fila de alterações feitas offline, esperando envio ao Supabase

function toggleLeque(id){
  if(lequesColapsados.has(id)) lequesColapsados.delete(id);
  else lequesColapsados.add(id);
  render();
}

function toggleSelecaoLeque(id, marcado){
  if(marcado) lequesSelecionados.add(id);
  else lequesSelecionados.delete(id);
  renderExportBar();
  // reflete o destaque visual do card sem precisar re-renderizar a lista inteira
  document.querySelectorAll('.leque-group[data-leque-id="'+id+'"]').forEach(elGroup=>{
    elGroup.classList.toggle('selecionado', marcado);
  });
}

function limparSelecaoLeques(){
  lequesSelecionados.clear();
  renderExportBar();
  render();
}

function renderExportBar(){
  const idsValidos = new Set(leques.map(l=>l.id));
  Array.from(lequesSelecionados).forEach(id=>{ if(!idsValidos.has(id)) lequesSelecionados.delete(id); });

  const bar = el('export-bar');
  const n = lequesSelecionados.size;
  if(n === 0){
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const codigos = leques.filter(l=>lequesSelecionados.has(l.id))
    .sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}))
    .map(l=>lequeCode(l)).join(', ');
  el('export-bar-count').textContent = (n===1 ? '1 leque selecionado: ' : n+' leques selecionados: ') + codigos;
}

function uuidv4(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function salvarLocal(){
  try{
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ aneis, leques, furos, anelAtivoId }));
  }catch(e){}
}
function carregarLocal(){
  try{
    const raw = localStorage.getItem(LOCAL_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      aneis = parsed.aneis || [];
      leques = parsed.leques || [];
      furos = parsed.furos || [];
      anelAtivoId = parsed.anelAtivoId || null;
    }
  }catch(e){}
  try{
    const rawFila = localStorage.getItem(FILA_KEY);
    filaEnvio = rawFila ? JSON.parse(rawFila) : [];
  }catch(e){ filaEnvio = []; }
}
function salvarFila(){
  try{ localStorage.setItem(FILA_KEY, JSON.stringify(filaEnvio)); }catch(e){}
  atualizarBotaoEnviar();
}

function atualizarBotaoEnviar(){
  const btn = document.getElementById('btn-enviar');
  if(!btn) return;
  const n = filaEnvio.length;
  if(n === 0){
    btn.textContent = '✓ Tudo sincronizado';
    btn.classList.add('ghost');
    btn.classList.remove('steel');
  }else{
    btn.textContent = `📤 Enviar Medições (${n} pendente${n>1?'s':''})`;
    btn.classList.remove('ghost');
    btn.classList.add('steel');
  }
}

// Remove qualquer entrada pendente pra esse registro nessa tabela (usado antes de
// enfileirar algo novo, pra fila nunca acumular ações redundantes/contraditórias).
function removerDaFila(tabela, id){
  filaEnvio = filaEnvio.filter(item => !(item.tabela===tabela && item.registro.id===id));
}

function enfileirar(tabela, acao, registro){
  if(acao === 'delete'){
    const tinhaInsertPendente = filaEnvio.some(item=>item.tabela===tabela && item.acao==='insert' && item.registro.id===registro.id);
    removerDaFila(tabela, registro.id);
    if(tinhaInsertPendente){ salvarFila(); return; } // nunca chegou a existir no servidor
    filaEnvio.push({ id: uid(), tabela, acao, registro });
    salvarFila();
    return;
  }
  if(acao === 'update' || acao === 'upsert'){
    const idxInsert = filaEnvio.findIndex(item=>item.tabela===tabela && item.acao==='insert' && item.registro.id===registro.id);
    if(idxInsert !== -1){
      filaEnvio[idxInsert].registro = { ...filaEnvio[idxInsert].registro, ...registro };
      salvarFila();
      return;
    }
    const idxExistente = filaEnvio.findIndex(item=>item.tabela===tabela && item.acao===acao && item.registro.id===registro.id);
    if(idxExistente !== -1){
      filaEnvio[idxExistente].registro = { ...filaEnvio[idxExistente].registro, ...registro };
      salvarFila();
      return;
    }
    filaEnvio.push({ id: uid(), tabela, acao, registro });
    salvarFila();
    return;
  }
  // insert
  filaEnvio.push({ id: uid(), tabela, acao, registro });
  salvarFila();
}

function definirAnelAtivo(novoId){
  aneis.forEach(a=>{
    const novoAtivo = a.id === novoId;
    if(a.ativo !== novoAtivo){
      a.ativo = novoAtivo;
      enfileirar('aneis', 'update', { id: a.id, ativo: novoAtivo });
    }
  });
  anelAtivoId = novoId;
}

// ---------- Envio manual da fila (quando voltar o sinal) ----------
async function enviarMedicoes(){
  if(filaEnvio.length === 0){ showToast('Nada pendente para enviar.'); return; }
  if(!navigator.onLine){ showToast('Sem conexão agora. Tente de novo quando tiver sinal.'); return; }

  const btn = el('btn-enviar');
  btn.disabled = true;
  const totalInicial = filaEnvio.length;
  let enviados = 0;

  while(filaEnvio.length > 0){
    const item = filaEnvio[0];
    try{
      let error;
      if(item.acao === 'insert'){
        ({ error } = await db.from(item.tabela).insert(item.registro));
      }else if(item.acao === 'update'){
        const { id, ...resto } = item.registro;
        ({ error } = await db.from(item.tabela).update(resto).eq('id', id));
      }else if(item.acao === 'upsert'){
        ({ error } = await db.from(item.tabela).upsert(item.registro));
      }else if(item.acao === 'delete'){
        ({ error } = await db.from(item.tabela).delete().eq('id', item.registro.id));
      }
      if(error) throw error;
      filaEnvio.shift();
      salvarFila();
      enviados++;
    }catch(err){
      btn.disabled = false;
      showToast(`Enviado ${enviados} de ${totalInicial}. Parou em: ${err && err.message ? err.message : err}`);
      return;
    }
  }
  btn.disabled = false;
  showToast(`Tudo enviado! (${totalInicial} alteração${totalInicial>1?'ões':''})`);
  await atualizarDoServidor();
}

// Busca a versão mais recente do servidor. Só sobrescreve o que está local
// se não houver nada pendente (pra nunca perder alterações ainda não enviadas).
async function atualizarDoServidor(){
  if(!navigator.onLine || filaEnvio.length > 0) return false;
  try{
    const [{ data: aneisData, error: e1 }, { data: lequesData, error: e2 }, { data: furosData, error: e3 }] = await Promise.all([
      db.from('aneis').select('*').order('criado_em'),
      db.from('leques').select('*').order('criado_em'),
      db.from('furos').select('*').order('criado_em')
    ]);
    if(e1 || e2 || e3) throw (e1 || e2 || e3);
    aneis = (aneisData || []).map(mapAnel);
    leques = (lequesData || []).map(mapLeque);
    furos = (furosData || []).map(mapFuro);
    const ativo = aneis.find(a=>a.ativo);
    anelAtivoId = ativo ? ativo.id : (aneis[0] ? aneis[0].id : null);
    salvarLocal();
    renderAll();
    return true;
  }catch(e){
    return false;
  }
}

async function sincronizarDoServidor(){
  if(!navigator.onLine){
    showToast('Sem conexão agora. Tente de novo quando tiver sinal.');
    return;
  }
  if(filaEnvio.length > 0){
    showToast('Você tem alterações pendentes para enviar. Envie-as antes de atualizar, pra não perder nada.');
    return;
  }
  const btn = el('btn-atualizar');
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = '🔄 Atualizando...';
  const ok = await atualizarDoServidor();
  btn.disabled = false;
  btn.textContent = textoOriginal;
  showToast(ok ? 'Dados atualizados a partir do servidor.' : 'Não foi possível atualizar agora. Tente de novo.');
}

el('btn-atualizar').addEventListener('click', sincronizarDoServidor);

async function loadData(){
  carregarLocal();
  if(!anelAtivoId && aneis[0]) anelAtivoId = aneis[0].id;
  renderAll();
  atualizarBotaoEnviar();
  await atualizarDoServidor();
}

function showToast(msg){
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function confirmDialog(mensagem, textoConfirmar){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p>${mensagem}</p>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="danger" id="modal-confirmar">${textoConfirmar || 'Confirmar'}</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(false));
    el('modal-confirmar').addEventListener('click', ()=> fechar(true));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(false); });
  });
}

function editFuroModal(furo){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Editar furo</p>
          <div class="grid-3" style="margin-bottom:14px;">
            <div class="field">
              <label for="edit-furo-numero">Número</label>
              <input id="edit-furo-numero" type="text" value="${furo.numero}">
            </div>
            <div class="field">
              <label for="edit-furo-esperada">Esperada (m)</label>
              <input id="edit-furo-esperada" type="number" step="0.1" min="0" value="${furo.metragemEsperada}">
            </div>
            <div class="field">
              <label for="edit-furo-real">Real (m)</label>
              <input id="edit-furo-real" type="number" step="0.1" min="0" value="${furo.metragemReal}">
            </div>
          </div>
          <div class="field" style="margin-bottom:16px;">
            <label for="edit-furo-situacao">Situação</label>
            <select id="edit-furo-situacao">
              <option value="livre" ${furo.situacao==='livre'?'selected':''}>Livre</option>
              <option value="obstruido" ${furo.situacao==='obstruido'?'selected':''}>Obstruído</option>
              <option value="varado" ${furo.situacao==='varado'?'selected':''}>Varado</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="steel" id="modal-salvar">Salvar</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(null));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(null); });
    const salvar = ()=>{
      const numero = normalizarNumero(el('edit-furo-numero').value.trim());
      const metragemEsperada = parseFloat(el('edit-furo-esperada').value);
      const metragemReal = parseFloat(el('edit-furo-real').value);
      const situacao = el('edit-furo-situacao').value;
      if(!numero || isNaN(metragemEsperada) || isNaN(metragemReal)){
        showToast('Preencha número, esperada e real corretamente.');
        return;
      }
      fechar({ numero, metragemEsperada, metragemReal, situacao });
    };
    el('modal-salvar').addEventListener('click', salvar);
    ['edit-furo-numero','edit-furo-esperada','edit-furo-real'].forEach(id=>{
      el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    });
  });
}

function editarFuro(id){
  const f = furos.find(x=>x.id===id);
  if(!f) return;
  const l = leques.find(x=>x.id===f.lequeId);
  editFuroModal(f).then(resultado=>{
    if(!resultado) return;
    if(resultado.numero !== f.numero){
      const duplicado = furos.some(x=>x.lequeId===f.lequeId && x.numero===resultado.numero && x.id!==f.id);
      if(duplicado){
        showToast(`Já existe o furo ${l ? lequeCode(l) : ''}F${resultado.numero} neste leque.`);
        return;
      }
    }
    f.numero = resultado.numero;
    f.metragemEsperada = resultado.metragemEsperada;
    f.metragemReal = resultado.metragemReal;
    f.situacao = resultado.situacao;
    enfileirar('furos', 'update', {
      id: f.id, numero: f.numero, metragem_esperada: f.metragemEsperada, metragem_real: f.metragemReal, situacao: f.situacao
    });
    salvarLocal();
    renderAll();
    showToast('Furo atualizado.');
  });
}

function fanSVG(furosDoLeque){
  const n = Math.max(furosDoLeque.length, 1);
  const w = 34, h = 26, cx = 6, cy = h - 3;
  const spread = Math.PI * 0.62;
  const start = -Math.PI/2 - spread/2;
  let lines = '';
  furosDoLeque.forEach((f, i) => {
    const t = n === 1 ? 0.5 : i/(n-1);
    const angle = start + spread * t;
    const x2 = cx + Math.cos(angle) * 18, y2 = cy + Math.sin(angle) * 18;
    const color = f.situacao === 'obstruido' ? 'var(--amber)' : f.situacao === 'varado' ? 'var(--steel)' : 'var(--moss)';
    lines += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--muted)"/>${lines}</svg>`;
}

function lequeAbertoDoAnel(anelId){
  return leques.find(l=>l.anelId===anelId && l.status==='aberto');
}

// ---------- Anéis (menu separado) ----------
function renderAneisMenu(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  el('anel-menu-current').textContent = anelAtivo ? `ativo: ${anelAtivo.nome}` : 'nenhum anel ativo';
  if(!anelAtivo) el('anel-menu').setAttribute('open', '');

  const lista = el('anel-list');
  if(aneis.length === 0){
    lista.innerHTML = `<div class="hint">Nenhum anel criado. Crie o primeiro acima.</div>`;
    return;
  }
  lista.innerHTML = aneis.map(a=>{
    const ativo = a.id === anelAtivoId;
    return `
      <div class="anel-row ${ativo?'ativo':''}">
        <span class="nome">${a.nome}</span>
        ${ativo ? '<span class="badge-ativo">ativo</span>' : ''}
        <span class="spacer"></span>
        ${!ativo ? `<button class="ghost" onclick="usarAnel('${a.id}')">Usar este anel</button>` : ''}
        <button class="icon" onclick="removerAnel('${a.id}')" title="remover anel">✕</button>
      </div>
    `;
  }).join('');
}

function usarAnel(id){
  definirAnelAtivo(id);
  salvarLocal();
  renderAll();
  showToast('Anel ativo alterado.');
  el('anel-menu').removeAttribute('open');
}

async function removerAnel(id){
  const a = aneis.find(x=>x.id===id);
  if(!a) return;
  const lequesDoAnel = leques.filter(l=>l.anelId===id).map(l=>l.id);
  const furoIds = furos.filter(f=>lequesDoAnel.includes(f.lequeId)).map(f=>f.id);
  const msg = `Remover o anel "${a.nome}", ${lequesDoAnel.length} leque(s) e ${furoIds.length} furo(s)? Esta ação não pode ser desfeita.`;
  if(!(await confirmDialog(msg, 'Remover'))) return;

  aneis = aneis.filter(x=>x.id!==id);
  leques = leques.filter(l=>l.anelId!==id);
  furos = furos.filter(f=>!lequesDoAnel.includes(f.lequeId));

  lequesDoAnel.forEach(lid=> removerDaFila('leques', lid));
  furoIds.forEach(fid=> removerDaFila('furos', fid));
  enfileirar('aneis', 'delete', { id });

  if(anelAtivoId === id){
    const restante = aneis[0];
    if(restante) definirAnelAtivo(restante.id);
    else anelAtivoId = null;
  }
  salvarLocal();
  renderAll();
  showToast('Anel removido.');
}

function criarAnel(){
  const campoNome = el('anel-nome');
  const nome = campoNome.value.trim();
  campoNome.style.borderColor = '';
  el('anel-erro').textContent = '';
  if(!nome) return;
  if(aneis.some(a=>a.nome.toLowerCase() === nome.toLowerCase())){
    campoNome.style.borderColor = 'var(--rust)';
    el('anel-erro').textContent = `Já existe um anel chamado "${nome}". Escolha outro nome ou use o existente na lista abaixo.`;
    showToast('Já existe um anel com esse nome.');
    return;
  }
  const novoId = uuidv4();
  aneis.forEach(a=>{
    if(a.ativo){
      a.ativo = false;
      enfileirar('aneis', 'update', { id: a.id, ativo: false });
    }
  });
  aneis.push({ id: novoId, nome, ativo: true });
  anelAtivoId = novoId;
  enfileirar('aneis', 'insert', { id: novoId, nome, ativo: true });
  campoNome.value = '';
  salvarLocal();
  renderAll();
  showToast('Anel criado e definido como ativo.');
}
el('btn-criar-anel').addEventListener('click', criarAnel);
el('anel-nome').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarAnel(); } });

// ---------- Breadcrumb + painel de trabalho ----------
function renderBreadcrumb(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const bc = el('breadcrumb');
  if(!anelAtivo){
    bc.innerHTML = `<span class="warn">Nenhum anel ativo — abra o menu "Anéis / Galerias" acima e crie ou selecione um.</span>`;
    return;
  }
  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
  bc.innerHTML = `Anel <b>${anelAtivo.nome}</b>` +
    (lequeAberto
      ? ` <span class="arrow">›</span> leque aberto <b>${lequeCode(lequeAberto)}</b> (${tipoLabel(lequeAberto.tipo)})`
      : ` <span class="arrow">›</span> <span class="warn">nenhum leque aberto</span>`);
}

function renderPainelTrabalho(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const painel = el('painel-trabalho');

  if(!anelAtivo){
    painel.style.display = 'none';
    return;
  }
  painel.style.display = '';

  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);

  const formLeque = el('form-leque');
  const boxAtual = el('leque-atual-box');
  if(lequeAberto){
    formLeque.style.display = 'none';
    el('leque-panel-title').textContent = 'Medição em andamento';
    const furosDoLeque = furos.filter(f=>f.lequeId===lequeAberto.id);
    boxAtual.innerHTML = `
      <div class="leque-atual">
        <span class="code">${lequeCode(lequeAberto)}</span>
        <span>${tipoLabel(lequeAberto.tipo)}${lequeAberto.nome ? ' · '+lequeAberto.nome : ''}</span>
        <span class="hint">${furosDoLeque.length} furo(s) registrados</span>
        <span class="spacer"></span>
        <button class="danger" onclick="finalizarLeque('${lequeAberto.id}')">Finalizar leque</button>
      </div>
    `;
  }else{
    formLeque.style.display = '';
    el('leque-panel-title').textContent = 'Criar Medição';
    el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value);
    boxAtual.innerHTML = '';
  }

  const semLeque = !lequeAberto;
  ['furo-numero','furo-esperada','furo-real','furo-situacao','btn-add-furo'].forEach(id=> el(id).disabled = semLeque);
  el('furo-hint').style.display = semLeque ? 'block' : 'none';
}

function criarLeque(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo) return;
  const tipo = el('leque-tipo').value;
  const numero = normalizarNumero(el('leque-numero').value.trim());
  if(!numero) return;
  const duplicado = leques.some(l=>l.anelId===anelAtivo.id && l.tipo===tipo && l.numero===numero);
  if(duplicado){
    showToast(`Já existe ${PREFIXO[tipo]}${numero} neste anel.`);
    return;
  }
  const novoId = uuidv4();
  const nome = el('leque-nome').value.trim() || null;
  const novoLeque = { id: novoId, anelId: anelAtivo.id, tipo, numero, nome, status: 'aberto' };
  leques.push(novoLeque);
  enfileirar('leques', 'insert', { id: novoId, anel_id: anelAtivo.id, tipo, numero, nome, status: 'aberto' });
  el('leque-numero').value = '';
  el('leque-nome').value = '';
  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(novoLeque)} criado e aberto.`);
}
el('btn-add-leque').addEventListener('click', criarLeque);
el('leque-tipo').addEventListener('change', ()=>{ el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value); });
['leque-numero','leque-nome'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarLeque(); } });
});

async function finalizarLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const qtd = furos.filter(f=>f.lequeId===id).length;
  if(!(await confirmDialog(`Finalizar o leque ${lequeCode(l)}${qtd ? ' com '+qtd+' furo(s)' : ' sem nenhum furo'}? Você poderá reabri-lo depois se precisar.`, 'Finalizar'))) return;
  l.status = 'fechado';
  enfileirar('leques', 'update', { id: l.id, status: 'fechado' });
  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(l)} finalizado.`);
}

async function reabrirLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const outroAberto = lequeAbertoDoAnel(l.anelId);
  if(outroAberto && outroAberto.id !== l.id){
    if(!(await confirmDialog(`O leque ${lequeCode(outroAberto)} está aberto neste anel. Finalizá-lo e reabrir ${lequeCode(l)}?`, 'Reabrir'))) return;
    outroAberto.status = 'fechado';
    enfileirar('leques', 'update', { id: outroAberto.id, status: 'fechado' });
  }
  l.status = 'aberto';
  enfileirar('leques', 'update', { id: l.id, status: 'aberto' });
  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(l)} reaberto.`);
}

function adicionarFuro(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo) return;
  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
  if(!lequeAberto) return;
  const numero = normalizarNumero(el('furo-numero').value.trim());
  if(!numero) return;
  const duplicado = furos.some(f=>f.lequeId===lequeAberto.id && f.numero===numero);
  if(duplicado){
    showToast(`Já existe o furo ${lequeCode(lequeAberto)}F${numero} neste leque.`);
    return;
  }
  const metragemEsperada = parseFloat(el('furo-esperada').value);
  const metragemReal = parseFloat(el('furo-real').value);
  if(isNaN(metragemEsperada) || isNaN(metragemReal)) return;
  const situacao = el('furo-situacao').value;

  const novoId = uuidv4();
  const novoFuro = { id: novoId, lequeId: lequeAberto.id, numero, metragemEsperada, metragemReal, situacao, ts: new Date().toISOString() };
  furos.push(novoFuro);
  enfileirar('furos', 'insert', {
    id: novoId, leque_id: lequeAberto.id, numero, metragem_esperada: metragemEsperada, metragem_real: metragemReal, situacao
  });

  el('furo-numero').value = '';
  el('furo-esperada').value = '';
  el('furo-real').value = '';
  el('furo-numero').focus();
  salvarLocal();
  renderAll();
  showToast(`Furo ${furoCode(lequeAberto, novoFuro)} registrado.`);
}
el('btn-add-furo').addEventListener('click', adicionarFuro);
['furo-numero','furo-esperada','furo-real'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); adicionarFuro(); } });
});

function removerFuro(id){
  furos = furos.filter(f=>f.id!==id);
  enfileirar('furos', 'delete', { id });
  salvarLocal();
  renderAll();
  showToast('Furo removido.');
}

async function removerLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const furosDoLeque = furos.filter(f=>f.lequeId===id);
  const qtd = furosDoLeque.length;
  if(!(await confirmDialog(`Remover o leque ${lequeCode(l)} e seus ${qtd} furo(s)?`, 'Remover'))) return;

  leques = leques.filter(x=>x.id!==id);
  furos = furos.filter(f=>f.lequeId!==id);
  furosDoLeque.forEach(f=> removerDaFila('furos', f.id));
  enfileirar('leques', 'delete', { id });

  salvarLocal();
  renderAll();
  showToast('Leque removido.');
}

function mapAnel(row){ return { id: row.id, nome: row.nome, ativo: row.ativo }; }
function mapLeque(row){ return { id: row.id, anelId: row.anel_id, tipo: row.tipo, numero: row.numero, nome: row.nome, status: row.status }; }
function mapFuro(row){ return { id: row.id, lequeId: row.leque_id, numero: row.numero, metragemEsperada: row.metragem_esperada, metragemReal: row.metragem_real, situacao: row.situacao, ts: row.criado_em }; }

// ---------- Dados do turno (também local, com fila própria) ----------
const TURNO_ROW_ID = 'current';
const SUPERVISOR_CONST = 'Talles da Silveira';
const PROJETO_CONST = 'Ero - Pilar';
let turnoInfo = { data:'', turnoNumero:'', turnoLetra:'', tecnicos:'', supervisor:SUPERVISOR_CONST, projeto:PROJETO_CONST, local:'' };

function selecionarChip(grupoId, valor){
  document.querySelectorAll('#'+grupoId+' .chip').forEach(chip=>{
    chip.classList.toggle('active', chip.dataset.val === valor);
  });
}

function carregarTurnoLocal(){
  try{
    const raw = localStorage.getItem(TURNO_LOCAL_KEY);
    if(raw) turnoInfo = { ...turnoInfo, ...JSON.parse(raw) };
  }catch(e){}
}
function salvarTurnoLocal(){
  try{ localStorage.setItem(TURNO_LOCAL_KEY, JSON.stringify(turnoInfo)); }catch(e){}
}

async function loadTurnoInfo(){
  carregarTurnoLocal();

  if(navigator.onLine && !filaEnvio.some(item=>item.tabela==='turno_info')){
    try{
      const { data, error } = await db.from('turno_info').select('*').eq('id', TURNO_ROW_ID).maybeSingle();
      if(error) throw error;
      if(data){
        turnoInfo.tecnicos = data.tecnicos || '';
        turnoInfo.local = data.local || '';
        turnoInfo.turnoNumero = data.turno_numero || '';
        turnoInfo.turnoLetra = data.turno_letra || '';
      }
    }catch(e){
      // sem sinal — segue com o que já está salvo localmente
    }
  }

  turnoInfo.data = new Date().toLocaleDateString('pt-BR');
  turnoInfo.supervisor = SUPERVISOR_CONST;
  turnoInfo.projeto = PROJETO_CONST;

  el('turno-data').value = turnoInfo.data;
  el('turno-tecnicos').value = turnoInfo.tecnicos || '';
  el('turno-local').value = turnoInfo.local || '';
  el('turno-supervisor').value = turnoInfo.supervisor;
  el('turno-projeto').value = turnoInfo.projeto;
  selecionarChip('turno-numero-group', turnoInfo.turnoNumero);
  selecionarChip('turno-letra-group', turnoInfo.turnoLetra);

  salvarTurnoLocal();
}

function saveTurnoInfo(){
  turnoInfo.data = el('turno-data').value;
  turnoInfo.tecnicos = el('turno-tecnicos').value;
  turnoInfo.local = el('turno-local').value;
  turnoInfo.supervisor = SUPERVISOR_CONST;
  turnoInfo.projeto = PROJETO_CONST;
  const chipNumero = document.querySelector('#turno-numero-group .chip.active');
  const chipLetra = document.querySelector('#turno-letra-group .chip.active');
  turnoInfo.turnoNumero = chipNumero ? chipNumero.dataset.val : '';
  turnoInfo.turnoLetra = chipLetra ? chipLetra.dataset.val : '';
  salvarTurnoLocal();
  enfileirar('turno_info', 'upsert', {
    id: TURNO_ROW_ID,
    data: turnoInfo.data,
    turno_numero: turnoInfo.turnoNumero,
    turno_letra: turnoInfo.turnoLetra,
    tecnicos: turnoInfo.tecnicos,
    supervisor: turnoInfo.supervisor,
    projeto: turnoInfo.projeto,
    local: turnoInfo.local
  });
}

function drawHeaderTabelaPDF(doc, y){
  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(PDF_FONT_CABECALHO); doc.setFont(undefined,'bold');
  doc.text('Furo', 17, y);
  doc.text('Esperada', 62, y);
  doc.text('Real', 97, y);
  doc.text('Diferenca', 127, y);
  doc.text('Situacao', 162, y);
  doc.setTextColor(0,0,0);
  return y+8;
}

// Desenha o cabeçalho comum de qualquer relatório em PDF (logo + título + dados do turno).
// Devolve a coordenada Y onde o conteúdo específico do relatório deve começar.
function desenharCabecalhoTurnoPDF(doc){
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64, 'JPEG', 15, 8, 20, 19.6); }catch(e){}

  doc.setFontSize(PDF_FONT_TITULO); doc.setFont(undefined,'bold');
  doc.text('STATUS TURNO PERFILAGEM DE LAVRA/TOPOGRAFIA', 40, 15);
  doc.setFontSize(PDF_FONT_SUBTITULO); doc.setFont(undefined,'normal'); doc.setTextColor(120);
  doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), 40, 21);
  doc.setTextColor(0);
  doc.setDrawColor(180); doc.line(15, 30, 195, 30);

  doc.setFontSize(PDF_FONT_INFO);
  let y = 38;
  const turnoDisplay = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `${turnoInfo.turnoNumero || '-'}º Turno - Letra ${turnoInfo.turnoLetra || '-'}`
    : '-';
  const campos = [
    ['Data:', turnoInfo.data],
    ['Turno:', turnoDisplay],
    ['Tecnicos:', turnoInfo.tecnicos],
    ['Supervisor:', turnoInfo.supervisor],
    ['Projeto:', turnoInfo.projeto],
    ['Local:', turnoInfo.local],
  ];
  campos.forEach(([label,val])=>{
    doc.setFont(undefined,'bold'); doc.text(label, 15, y);
    doc.setFont(undefined,'normal'); doc.text(String(val||'-'), 42, y);
    y += 7;
  });

  y += 4;
  doc.setDrawColor(180); doc.line(15, y, 195, y); y += 10;
  return y;
}

// Compartilha o PDF como arquivo de verdade (evita cair um link "blob:" no WhatsApp/redes sociais).
// Quando o navegador suporta Web Share API com arquivos, abre o menu nativo de compartilhamento.
// Caso contrário, cai no download tradicional (o arquivo vai para a pasta de Downloads do aparelho).
async function baixarOuCompartilharPDF(doc, nomeArquivo){
  const blob = doc.output('blob');

  try{
    const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
    if(navigator.canShare && navigator.canShare({ files: [arquivo] })){
      await navigator.share({ files: [arquivo], title: nomeArquivo });
      return;
    }
  }catch(err){
    if(err && err.name === 'AbortError') return; // usuário cancelou o compartilhamento, não é erro
    // se o compartilhamento falhar por outro motivo, cai no download normal abaixo
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// ---------- Histórico de exportações ----------
let historicoExportacoes = [];

async function registrarExportacao({ tipo, leques, qtdLeques, qtdFuros, nomeArquivo }){
  try{
    const { error } = await db.from('export_historico').insert({
      tipo,
      turno_data: turnoInfo.data,
      turno_numero: turnoInfo.turnoNumero,
      turno_letra: turnoInfo.turnoLetra,
      leques: leques || null,
      qtd_leques: qtdLeques || 0,
      qtd_furos: qtdFuros || 0,
      nome_arquivo: nomeArquivo
    });
    if(error) throw error;
    await loadHistoricoExportacoes();
    return true;
  }catch(e){
    // histórico é auxiliar: não trava a exportação, mas registra o erro real no console para diagnóstico
    console.error('Falha ao registrar no histórico de exportações:', e);
    return false;
  }
}

async function loadHistoricoExportacoes(){
  if(!navigator.onLine) return;
  try{
    const { data, error } = await db.from('export_historico').select('*').order('criado_em', { ascending:false }).limit(50);
    if(error) throw error;
    historicoExportacoes = data || [];
  }catch(e){
    historicoExportacoes = [];
  }
  renderHistoricoExportacoes();
}

function renderHistoricoExportacoes(){
  const lista = el('historico-list');
  const vazio = el('historico-vazio');
  if(!lista) return;
  if(historicoExportacoes.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';

  const TIPO_LABEL = { turno:'Só turno', leque:'1 leque', combinado:'Combinado' };

  lista.innerHTML = historicoExportacoes.map(reg=>{
    const quando = reg.criado_em ? new Date(reg.criado_em).toLocaleString('pt-BR') : '-';
    const turnoLabelReg = [reg.turno_numero, reg.turno_letra].filter(Boolean).join('');
    const detalhe = reg.tipo === 'turno'
      ? 'Sem perfilagem de furos'
      : `${reg.leques || '-'} · ${reg.qtd_furos || 0} furo(s)`;
    return `
      <div class="historico-row">
        <span class="quando">${quando}</span>
        <span class="tipo ${reg.tipo}">${TIPO_LABEL[reg.tipo] || reg.tipo}</span>
        <span>${reg.turno_data || '-'}${turnoLabelReg ? ' · Turno '+turnoLabelReg : ''}</span>
        <span class="detalhe">${detalhe}</span>
        <span class="arquivo">${reg.nome_arquivo || ''}</span>
      </div>
    `;
  }).join('');
}

// ---------- Exportação de PDF: turno só, leque único, e combinado ----------
async function exportarTurnoPDF(){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_AVISO); doc.setFont(undefined,'italic'); doc.setTextColor(120);
  doc.text('Nenhuma perfilagem de furos vinculada a este relatório.', 15, y);
  doc.setTextColor(0); doc.setFont(undefined,'normal');

  const dataArquivo = (turnoInfo.data || '').replace(/\//g,'-') || 'sem-data';
  const sufixoTurno = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `_${turnoInfo.turnoNumero || ''}${turnoInfo.turnoLetra || ''}`
    : '';
  const nomeArquivo = ('Turno_' + dataArquivo + sufixoTurno).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';

  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'turno', leques:null, qtdLeques:0, qtdFuros:0, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF do turno exportado.'
    : 'PDF do turno exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
}

async function exportarLequePDF(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const a = aneis.find(x=>x.id===l.anelId);
  let furosDoLeque = furos.filter(f=>f.lequeId===id);
  furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
  doc.text('Anel: ' + (a ? a.nome : '-'), 15, y); y += 7;
  doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 10;

  y = drawHeaderTabelaPDF(doc, y);
  doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

  furosDoLeque.forEach(f=>{
    if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    doc.text(furoCode(l,f), 17, y);
    doc.text(fmt1(Number(f.metragemEsperada))+' m', 62, y);
    doc.text(fmt1(Number(f.metragemReal))+' m', 97, y);
    doc.text(diffLabel(diff), 127, y);
    doc.text(situacaoLabel(f.situacao), 162, y);
    doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
    y += 8;
  });

  y += 6;
  if(y > 268){ doc.addPage(); y = 20; }
  const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const varTotal = totalReal - totalEsp;
  const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

  doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
  doc.text('Total: ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);

  const nomeArquivo = (lequeCode(l) + '_' + (a?a.nome:'anel')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'leque', leques: lequeCode(l), qtdLeques:1, qtdFuros: furosDoLeque.length, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF de ' + lequeCode(l) + ' exportado.'
    : 'PDF de ' + lequeCode(l) + ' exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
}

async function exportarLequesPDF(ids){
  if(!ids || ids.length === 0){ showToast('Selecione ao menos um leque para exportar.'); return; }
  let selecionados = leques.filter(l=>ids.includes(l.id));
  if(selecionados.length === 0){ showToast('Nenhum leque válido selecionado.'); return; }
  selecionados = [...selecionados].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_AVISO); doc.setFont(undefined,'bold');
  const linhasInclusos = doc.splitTextToSize(
    'Leques inclusos (' + selecionados.length + '): ' + selecionados.map(l=>lequeCode(l)).join(', '),
    180
  );
  doc.text(linhasInclusos, 15, y);
  y += linhasInclusos.length * 7 + 6;

  let totalGeralEsp = 0, totalGeralReal = 0, totalGeralFuros = 0, alertasGeral = 0;

  selecionados.forEach((l, idx)=>{
    const a = aneis.find(x=>x.id===l.anelId);
    let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
    furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));

    if(y > 250){ doc.addPage(); y = 20; }

    doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
    doc.text('Anel: ' + (a ? a.nome : '-'), 15, y); y += 7;
    doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 10;

    y = drawHeaderTabelaPDF(doc, y);
    doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

    furosDoLeque.forEach(f=>{
      if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
      const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
      doc.text(furoCode(l,f), 17, y);
      doc.text(fmt1(Number(f.metragemEsperada))+' m', 62, y);
      doc.text(fmt1(Number(f.metragemReal))+' m', 97, y);
      doc.text(diffLabel(diff), 127, y);
      doc.text(situacaoLabel(f.situacao), 162, y);
      doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
      y += 8;
    });

    const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
    const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
    const varTotal = totalReal - totalEsp;
    const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

    totalGeralEsp += totalEsp;
    totalGeralReal += totalReal;
    totalGeralFuros += furosDoLeque.length;
    alertasGeral += alertas;

    y += 6;
    if(y > 268){ doc.addPage(); y = 20; }
    doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
    doc.text('Subtotal ' + lequeCode(l) + ': ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);
    y += 10;

    if(idx < selecionados.length - 1){
      doc.setDrawColor(200); doc.line(15, y, 195, y);
      y += 8;
    }
  });

  if(y > 255){ doc.addPage(); y = 20; }
  y += 2;
  doc.setDrawColor(25,18,49); doc.setLineWidth(0.6); doc.line(15, y, 195, y); doc.setLineWidth(0.2); y += 9;
  const varGeral = totalGeralReal - totalGeralEsp;
  doc.setFontSize(PDF_FONT_TOTAL_GERAL); doc.setFont(undefined,'bold');
  const linhasTotal = doc.splitTextToSize(
    'TOTAL GERAL (' + selecionados.length + ' leque(s)): ' + totalGeralFuros + ' furo(s)  |  Esperada: ' + fmt1(totalGeralEsp) + ' m  |  Real: ' + fmt1(totalGeralReal) + ' m  |  Variacao: ' + diffLabel(varGeral) + '  |  Alertas: ' + alertasGeral,
    180
  );
  doc.text(linhasTotal, 15, y);

  const nomeArquivo = ('Turno_' + selecionados.map(l=>lequeCode(l)).join('-')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({
    tipo:'combinado',
    leques: selecionados.map(l=>lequeCode(l)).join(', '),
    qtdLeques: selecionados.length,
    qtdFuros: totalGeralFuros,
    nomeArquivo
  });
  showToast(salvoNoHistorico
    ? 'PDF combinado com ' + selecionados.length + ' leque(s) exportado.'
    : 'PDF combinado exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
  limparSelecaoLeques();
}

// ---------- Filtros + lista/histórico ----------
function render(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const lequesDoAtivo = anelAtivo ? leques.filter(l=>l.anelId===anelAtivo.id) : [];
  const idsLequesAtivo = new Set(lequesDoAtivo.map(l=>l.id));
  const furosDoAtivo = furos.filter(f=>idsLequesAtivo.has(f.lequeId));

  const totalReal = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const totalEsperada = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const variacao = totalReal - totalEsperada;

  el('readout-label').textContent = anelAtivo ? `anel ativo: ${anelAtivo.nome}` : 'nenhum anel ativo';
  el('stat-leques').textContent = lequesDoAtivo.length;
  el('stat-furos').textContent = furosDoAtivo.length;
  el('stat-metros').textContent = fmt1(totalReal);
  el('stat-variacao').textContent = diffLabel(variacao);
  el('stat-var-wrap').className = variacao < 0 ? 'neg' : (variacao > 0 ? 'pos' : '');
  el('stat-alertas').textContent = furosDoAtivo.filter(f=>f.situacao!=='livre').length;

  const tipoFiltro = el('f-tipo').value;
  const situacaoFiltro = el('f-situacao').value;
  const busca = el('f-busca').value.trim().toUpperCase();

  const lista = el('lista');

  if(aneis.length === 0){
    lista.innerHTML = `<div class="empty">Nenhum anel criado ainda.<br>Abra o menu "Anéis / Galerias" no topo para começar.</div>`;
    return;
  }

  if(!anelAtivo){
    lista.innerHTML = `<div class="empty">Nenhum anel ativo.<br>Abra o menu "Anéis / Galerias" no topo e selecione um.</div>`;
    return;
  }

  const aneisParaMostrar = [anelAtivo];
  let algumConteudo = false;
  let html = '';

  aneisParaMostrar.forEach(a=>{
    let lequesDoAnel = leques.filter(l=>l.anelId===a.id);
    if(tipoFiltro) lequesDoAnel = lequesDoAnel.filter(l=>l.tipo===tipoFiltro);
    lequesDoAnel = [...lequesDoAnel].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

    const gruposHTML = lequesDoAnel.map(l=>{
      let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
      furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));
      if(situacaoFiltro) furosDoLeque = furosDoLeque.filter(f=>f.situacao===situacaoFiltro);
      if(busca) furosDoLeque = furosDoLeque.filter(f=>furoCode(l,f).includes(busca) || lequeCode(l).includes(busca));

      const semFurosPorFiltro = furosDoLeque.length === 0 && (situacaoFiltro || busca);
      if(semFurosPorFiltro) return '';

      const totalRealL = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
      const totalEspL = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
      const varL = totalRealL - totalEspL;
      const alertasL = furosDoLeque.filter(f=>f.situacao!=='livre').length;

      const rows = furosDoLeque.map(f=>{
        const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
        return `
        <tr>
          <td><span class="status-dot ${f.situacao}"></span>${furoCode(l,f)}</td>
          <td>${fmt1(Number(f.metragemEsperada))} m</td>
          <td>${fmt1(Number(f.metragemReal))} m</td>
          <td class="diff ${diffClass(diff)}">${diffLabel(diff)}</td>
          <td>${situacaoLabel(f.situacao)}</td>
          <td class="actions">
            <button class="icon" onclick="editarFuro('${f.id}')" title="editar">✎</button>
            <button class="icon" onclick="removerFuro('${f.id}')" title="remover">✕</button>
          </td>
        </tr>`;
      }).join('');

      const colapsado = lequesColapsados.has(l.id);
      const selecionado = lequesSelecionados.has(l.id);

      return `
        <div class="leque-group ${l.status === 'aberto' ? 'aberto' : ''} ${selecionado ? 'selecionado' : ''}" data-leque-id="${l.id}">
          <div class="leque-head">
              <label class="leque-select-wrap" title="selecionar para exportação combinada">
                <input type="checkbox" class="leque-select" data-id="${l.id}" ${selecionado ? 'checked' : ''}>
              </label>
              <button class="icon toggle-leque" onclick="toggleLeque('${l.id}')" title="${colapsado ? 'expandir' : 'minimizar'}">${colapsado ? '▸' : '▾'}</button>
              <div class="fan">${fanSVG(furosDoLeque)}</div>
              <span class="code">${lequeCode(l)}</span>
              <span class="badge-tipo ${l.tipo}">${tipoLabel(l.tipo)}</span>
              <span class="status ${l.status}">${l.status === 'aberto' ? 'aberto' : 'fechado'}</span>
              ${l.nome ? `<span class="hint">${l.nome}</span>` : ''}
            <div class="stats">
              <div><b>${furosDoLeque.length}</b> furos</div>
              <div><b>${fmt1(totalEspL)}</b> m esp.</div>
              <div><b>${fmt1(totalRealL)}</b> m real</div>
              <div class="${varL < 0 ? 'neg' : (varL > 0 ? 'pos' : '')}"><b>${diffLabel(varL)}</b> var.</div>
              ${alertasL ? `<div><b>${alertasL}</b> alertas</div>` : ''}
              ${l.status === 'fechado' ? `<button class="icon" onclick="reabrirLeque('${l.id}')" title="reabrir">↺ reabrir</button>` : ''}
              <button class="icon" onclick="exportarLequePDF('${l.id}')" title="exportar PDF deste leque sozinho">⬇ PDF</button>
              <button class="icon" onclick="removerLeque('${l.id}')" title="remover leque">✕</button>
            </div>
          </div>
          ${colapsado ? '' : (furosDoLeque.length ? `
<div class="tabela-wrap">
<table>
            <thead><tr><th>Furo</th><th>Esperada</th><th>Real</th><th>Variação</th><th>Situação</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div> ` : `<div class="sem-furos">Nenhum furo registrado neste leque ainda.</div>`)}
        </div>
      `;
    }).join('');

    if(gruposHTML.trim()){
      algumConteudo = true;
      html += `
        <div class="anel-section">
          <div class="anel-section-head"><b>${a.nome}</b></div>
          ${gruposHTML}
        </div>
      `;
    }
  });

  lista.innerHTML = algumConteudo ? html : `<div class="empty">Nenhum registro corresponde aos filtros.</div>`;
}

function renderAll(){
  renderAneisMenu();
  renderBreadcrumb();
  renderPainelTrabalho();
  render();
  atualizarBotaoEnviar();
  renderExportBar();
}

['f-tipo','f-situacao','f-busca'].forEach(id=> el(id).addEventListener('input', render));

el('btn-enviar').addEventListener('click', enviarMedicoes);

el('btn-csv').addEventListener('click', ()=>{
  if(furos.length === 0) return;
  const header = 'anel,codigo_furo,tipo,metragem_esperada,metragem_real,diferenca,situacao,timestamp\n';
  const rows = furos.map(f=>{
    const l = leques.find(x=>x.id===f.lequeId) || {};
    const a = aneis.find(x=>x.id===l.anelId) || {};
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    return [a.nome||'', furoCode(l,f), l.tipo||'', f.metragemEsperada, f.metragemReal, fmt1(diff), f.situacao, f.ts].join(',');
  }).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'perfilagem-furos.csv';
  a.click();
  URL.revokeObjectURL(url);
});

['data','tecnicos','local'].forEach(k=>{
  const campo = document.getElementById('turno-'+k);
  if(campo) campo.addEventListener('input', saveTurnoInfo);
});
document.querySelectorAll('#turno-numero-group .chip, #turno-letra-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
    saveTurnoInfo();
  });
});

el('lista').addEventListener('change', (e)=>{
  const chk = e.target.closest('.leque-select');
  if(!chk) return;
  toggleSelecaoLeque(chk.dataset.id, chk.checked);
});
el('btn-limpar-selecao').addEventListener('click', limparSelecaoLeques);
el('btn-exportar-selecionados').addEventListener('click', ()=>{
  exportarLequesPDF(Array.from(lequesSelecionados));
});
el('btn-exportar-turno').addEventListener('click', exportarTurnoPDF);

loadTurnoInfo();
loadData();
loadHistoricoExportacoes();
