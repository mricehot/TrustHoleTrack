// ---------- Lembretes rápidos (pessoais) ----------
// Painel na lateral direita em tela larga; botão flutuante 📝 no celular.
// Cada pessoa vê só os seus. Funciona sem sinal: vai pela mesma fila de envio das marcações.
let lembretes = []; // { id, texto, feito, feitoEm, ts }
let lembretesAberto = false; // só vale no celular (no PC o painel fica fixo, a menos que recolhido)
let lembretesRecolhido = false;
let lembreteEditando = null, lembretesBusca = '', lembretesLargo2 = false;
const LEMBRETES_LARG_KEY = 'perfilagem-lembretes-largo-v1';
const LEMBRETES_PREF_KEY = 'perfilagem-lembretes-recolhido-v1';
const chaveLembretes = () => 'perfilagem-lembretes-v1:' + (usuarioAtual && usuarioAtual.id || 'anon');

function mapLembrete(r){ return { id: r.id, texto: r.texto || '', feito: !!r.feito, feitoEm: r.feito_em || null, ts: r.criado_em || new Date().toISOString(), alvoTipo: r.alvo_tipo || '', alvoId: r.alvo_id || '', alvoRotulo: r.alvo_rotulo || '', titulo: r.titulo || '', prioridade: r.prioridade || 'normal', prazo: r.prazo || '' }; }
function carregarLembretesLocal(){ try{ lembretes = JSON.parse(localStorage.getItem(chaveLembretes()) || '[]'); }catch(e){ lembretes = []; } }
function salvarLembretesLocal(){ try{ localStorage.setItem(chaveLembretes(), JSON.stringify(lembretes)); }catch(e){} }

function adicionarLembrete(texto, alvo, extra){
  texto = String(texto || '').trim().slice(0, 2000);
  extra = extra || {};
  const titulo = String(extra.titulo || '').trim().slice(0, 200);
  if(!texto) texto = titulo;
  if(!texto || !usuarioAtual) return;
  alvo = alvo || {};
  const l = { id: uuidv4(), texto, feito: false, feitoEm: null, ts: new Date().toISOString(), alvoTipo: alvo.tipo || '', alvoId: alvo.id || '', alvoRotulo: alvo.rotulo || '', titulo, prioridade: extra.prioridade || 'normal', prazo: extra.prazo || '' };
  lembretes.push(l);
  salvarLembretesLocal();
  const reg = { id: l.id, user_id: usuarioAtual.id, texto: l.texto, feito: false, criado_em: l.ts };
  if(l.alvoTipo){ reg.alvo_tipo = l.alvoTipo; reg.alvo_id = l.alvoId; reg.alvo_rotulo = l.alvoRotulo; }
  if(titulo) reg.titulo = titulo; if(l.prioridade !== 'normal') reg.prioridade = l.prioridade; if(l.prazo) reg.prazo = l.prazo;
  enfileirar('lembretes', 'insert', reg);
  renderLembretes();
}
function alternarLembrete(id){
  const l = lembretes.find(x=>x.id===id); if(!l) return;
  l.feito = !l.feito; l.feitoEm = l.feito ? new Date().toISOString() : null;
  salvarLembretesLocal();
  enfileirar('lembretes', 'update', { id, feito: l.feito, feito_em: l.feitoEm });
  renderLembretes();
}
function apagarLembrete(id){
  lembretes = lembretes.filter(x=>x.id!==id);
  salvarLembretesLocal();
  enfileirar('lembretes', 'delete', { id });
  renderLembretes();
}
function limparLembretesFeitos(){
  const feitos = lembretes.filter(x=>x.feito);
  if(!feitos.length) return;
  if(!confirm(`Apagar ${feitos.length} lembrete(s) resolvido(s)?`)) return;
  feitos.forEach(x=>apagarLembrete(x.id));
}
function editarLembrete(id){ lembreteEditando = id; renderLembretes(); const t = document.getElementById('lb-edit-' + id); if(t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
function salvarEdicaoLembrete(id){
  const t = document.getElementById('lb-edit-' + id); const l = lembretes.find(x=>x.id===id);
  lembreteEditando = null; if(!t || !l){ renderLembretes(); return; }
  const novo = t.value.trim().slice(0, 2000);
  if(!novo){ apagarLembrete(id); return; }
  if(novo !== l.texto){ l.texto = novo; salvarLembretesLocal(); enfileirar('lembretes', 'update', { id, texto: novo }); }
  renderLembretes();
}
function atualizarLembreteCompleto(id, c){
  const l = lembretes.find(x=>x.id===id); if(!l) return;
  const titulo = String(c.titulo || '').trim().slice(0, 200), texto = (String(c.texto || '').trim().slice(0, 2000)) || titulo;
  if(!texto) return;
  Object.assign(l, { titulo, texto, prioridade: c.prioridade || 'normal', prazo: c.prazo || '' });
  if(c.alvo){ l.alvoTipo = c.alvo.tipo || ''; l.alvoId = c.alvo.id || ''; l.alvoRotulo = c.alvo.rotulo || ''; }
  salvarLembretesLocal();
  const reg = { id, texto, titulo: titulo || null, prioridade: l.prioridade, prazo: l.prazo || null };
  if(c.alvo){ reg.alvo_tipo = l.alvoTipo || null; reg.alvo_id = l.alvoId || null; reg.alvo_rotulo = l.alvoRotulo || null; }
  enfileirar('lembretes', 'update', reg);
  renderLembretes();
}
function cancelarEdicaoLembrete(){ lembreteEditando = null; renderLembretes(); }
function alternarLarguraLembretes(){ lembretesLargo2 = !lembretesLargo2; try{ localStorage.setItem(LEMBRETES_LARG_KEY, lembretesLargo2 ? '1' : '0'); }catch(e){} renderLembretes(); }
function dataCurtaLembrete(ts){ try{ const d = new Date(ts); return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }catch(e){ return ''; } }

function garantirPainelLembretes(){
  let p = document.getElementById('lembretes-painel');
  if(p) return p;
  p = document.createElement('aside'); p.id = 'lembretes-painel'; p.className = 'lembretes-painel'; p.hidden = true;
  p.setAttribute('aria-label', 'Lembretes rápidos');
  p.innerHTML = `
    <div class="lb-topo"><strong>📝 Lembretes</strong><span class="lb-cont" id="lb-cont"></span>
      <button type="button" class="lb-x" id="lb-tela" aria-label="Abrir em tela cheia" title="Abrir em tela cheia">⤢</button>
      <button type="button" class="lb-x" id="lb-largura" aria-label="Alargar painel" title="Alargar / estreitar">⇔</button>
      <button type="button" class="lb-x" id="lb-fechar" aria-label="Fechar lembretes">✕</button></div>
    <form class="lb-novo" id="lb-form" autocomplete="off">
      <textarea id="lb-input" rows="3" maxlength="2000" placeholder="Anotar para decidir depois (Enter salva · Shift+Enter nova linha)" aria-label="Novo lembrete"></textarea>
      <button type="submit" aria-label="Adicionar lembrete">+</button>
    </form>
    <div class="lb-alvo" id="lb-alvo-linha">
      <select id="lb-alvo-leque" aria-label="Ligar a um leque"><option value="">🔗 Sem leque</option></select>
      <select id="lb-alvo-furo" aria-label="Ligar a um furo" hidden><option value="">Leque todo</option></select>
    </div>
    <input type="search" class="lb-busca" id="lb-busca" placeholder="Buscar nos lembretes…" aria-label="Buscar lembretes">
    <ul class="lb-lista" id="lb-lista"></ul>
    <details class="lb-feitos" id="lb-feitos"><summary id="lb-feitos-t">Resolvidos</summary>
      <ul class="lb-lista" id="lb-lista-feitos"></ul>
      <button type="button" class="lb-limpar" id="lb-limpar">Apagar resolvidos</button></details>`;
  document.body.appendChild(p);
  const b = document.createElement('button'); b.type = 'button'; b.id = 'lembretes-fab'; b.className = 'lembretes-fab'; b.hidden = true;
  b.setAttribute('aria-label', 'Abrir lembretes');
  b.innerHTML = '<span aria-hidden="true">📝</span><i id="lb-badge" hidden>0</i>';
  document.body.appendChild(b);
  const form = p.querySelector('#lb-form'), inp = p.querySelector('#lb-input');
  form.addEventListener('submit', e=>{ e.preventDefault(); adicionarLembrete(inp.value, lerAlvoLembrete()); inp.value = ''; zerarAlvoLembrete(); inp.focus(); });
  p.querySelector('#lb-alvo-leque').addEventListener('change', ()=>preencherFurosLembrete());
  inp.addEventListener('keydown', e=>{ if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); form.requestSubmit(); } });
  p.querySelector('#lb-busca').addEventListener('input', e=>{ lembretesBusca = e.target.value; renderLembretes(); });
  p.querySelector('#lb-tela').addEventListener('click', ()=>{ mostrarView('lembretes'); });
  p.querySelector('#lb-largura').addEventListener('click', alternarLarguraLembretes);
  p.addEventListener('keydown', e=>{ const t = e.target; if(!t.classList || !t.classList.contains('lb-edit')) return; const id = t.closest('li').dataset.id;
    if(e.key === 'Escape'){ e.preventDefault(); cancelarEdicaoLembrete(); } else if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); salvarEdicaoLembrete(id); } });
  p.querySelector('#lb-fechar').addEventListener('click', ()=>definirLembretesAberto(false));
  b.addEventListener('click', ()=>definirLembretesAberto(true));
  p.querySelector('#lb-limpar').addEventListener('click', limparLembretesFeitos);
  p.addEventListener('click', e=>{
    const alvoBtn = e.target.closest('.lb-ir'); if(alvoBtn){ irParaAlvoLembrete(alvoBtn.closest('li').dataset.id); return; }
    const li = e.target.closest('li[data-id]'); if(!li) return;
    const id = li.dataset.id;
    if(e.target.closest('.lb-chk')) alternarLembrete(id);
    else if(e.target.closest('.lb-del')) apagarLembrete(id);
    else if(e.target.closest('.lb-salvar')) salvarEdicaoLembrete(id);
    else if(e.target.closest('.lb-cancelar')) cancelarEdicaoLembrete();
    else if(e.target.closest('.lb-txt')) editarLembrete(id);
  });
  return p;
}
const lembretesEhLargo = () => window.matchMedia('(min-width:1101px)').matches;
function definirLembretesAberto(on){
  if(lembretesEhLargo()){ lembretesRecolhido = !on; try{ localStorage.setItem(LEMBRETES_PREF_KEY, lembretesRecolhido ? '1' : '0'); }catch(e){} }
  else lembretesAberto = !!on;
  renderLembretes();
  if(on){ const i = document.getElementById('lb-input'); if(i && !lembretesEhLargo()) setTimeout(()=>i.focus(), 50); }
}
function renderLembretes(){
  if(!usuarioAtual) return;
  const p = garantirPainelLembretes(), fab = document.getElementById('lembretes-fab');
  const pend = lembretes.filter(x=>!x.feito), feitos = lembretes.filter(x=>x.feito);
  const largo = lembretesEhLargo();
  const painelVisivel = largo ? !lembretesRecolhido : lembretesAberto;
  p.hidden = !painelVisivel;
  p.classList.toggle('lb-largo', lembretesLargo2); document.body.classList.toggle('lembretes-largo', lembretesLargo2 && largo && painelVisivel);
  fab.hidden = painelVisivel;
  document.body.classList.toggle('com-lembretes', largo && painelVisivel);
  const badge = document.getElementById('lb-badge'); badge.textContent = pend.length > 99 ? '99+' : pend.length; badge.hidden = !pend.length;
  try{ if(typeof renderLembretesTela === 'function') renderLembretesTela(); }catch(e){}
  document.getElementById('lb-cont').textContent = pend.length ? pend.length + ' pendente' + (pend.length>1?'s':'') : '';
  const q = lembretesBusca.trim().toLowerCase();
  const filtra = l => !q || (l.texto + ' ' + l.alvoRotulo).toLowerCase().includes(q);
  const item = l => `<li data-id="${l.id}" class="${l.feito?'feito':''}${lembreteEditando===l.id?' editando':''}"><button type="button" class="lb-chk" role="checkbox" aria-checked="${l.feito}" aria-label="${l.feito?'Reabrir':'Marcar como resolvido'}"></button>
    <div class="lb-corpo">${lembreteEditando===l.id
      ? `<textarea class="lb-edit" id="lb-edit-${l.id}" rows="4" maxlength="2000">${escapeHtml(l.texto)}</textarea><div class="lb-edit-btns"><button type="button" class="lb-salvar">Salvar</button><button type="button" class="lb-cancelar">Cancelar</button></div>`
      : `${l.titulo ? `<div class="lb-tit">${escapeHtml(l.titulo)}</div>` : ''}<div class="lb-txt" title="Clique para editar">${escapeHtml(l.texto)}</div>`}
      <div class="lb-meta"><span>${dataCurtaLembrete(l.ts)}${l.feito && l.feitoEm ? ' · resolvido ' + dataCurtaLembrete(l.feitoEm) : ''}</span>${l.alvoTipo ? `<button type="button" class="lb-ir" title="Ir para ${escapeHtml(l.alvoRotulo)} no checklist">↗ ${escapeHtml(l.alvoRotulo)}</button>` : ''}</div></div>
    <button type="button" class="lb-del" aria-label="Apagar lembrete">✕</button></li>`;
  const foco = document.activeElement && p.contains(document.activeElement) && document.activeElement.id === 'lb-input';
  const pendF = pend.filter(filtra), feitosF = feitos.filter(filtra);
  document.getElementById('lb-lista').innerHTML = pendF.length ? pendF.slice().reverse().map(item).join('') : `<li class="lb-vazio">${q ? 'Nenhum lembrete encontrado.' : 'Nada pendente. Anote aqui o que precisa decidir depois.'}</li>`;
  document.getElementById('lb-lista-feitos').innerHTML = feitosF.map(item).join('');
  document.getElementById('lb-feitos').hidden = !feitos.length;
  document.getElementById('lb-feitos-t').textContent = `Resolvidos (${feitos.length})`;
  preencherLequesLembrete();
  if(foco) document.getElementById('lb-input').focus();
}
// ----- vínculo com leque/furo -----
function codigoLequeCk(c){ return (PREFIXO[c.tipo] || '') + c.numero; }
// Opções de leque de TODOS os realces, agrupadas por realce (lembretes são gerais).
function lequesTodosRealces(){
  const grupos = [];
  (aneis || []).forEach(a=>{ const its = checklistLeques.filter(c=>c.anelId === a.id); if(its.length) grupos.push({ anel:a, itens:its }); });
  return grupos;
}
function opcoesLequesLembrete(sel){
  return '<option value="">🔗 Sem vínculo (geral)</option>' + lequesTodosRealces().map(g=>`<optgroup label="${escapeHtml(g.anel.nome)}">${g.itens.map(c=>`<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${escapeHtml(codigoLequeCk(c))}</option>`).join('')}</optgroup>`).join('');
}
function rotuloLequeLembrete(c){ const a = (aneis || []).find(x=>x.id === c.anelId); return (a ? a.nome + ' · ' : '') + codigoLequeCk(c); }
function preencherLequesLembrete(){
  const sel = document.getElementById('lb-alvo-leque'); if(!sel) return;
  if(sel === document.activeElement) return; // não mexe enquanto a pessoa escolhe
  const atual = sel.value;
  const itens = checklistLeques.slice();
  const sig = itens.map(c=>c.id + codigoLequeCk(c) + c.anelId).join('|') + (aneis || []).map(x=>x.nome).join('|');
  if(sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  sel.innerHTML = opcoesLequesLembrete('');
  sel.value = itens.some(c=>c.id===atual) ? atual : '';
  preencherFurosLembrete();
}
function preencherFurosLembrete(){
  const lq = document.getElementById('lb-alvo-leque'), fu = document.getElementById('lb-alvo-furo'); if(!lq || !fu) return;
  const id = lq.value;
  fu.hidden = !id;
  const atual = fu.value;
  const furosL = id ? checklistFurosDoLeque(id) : [];
  fu.innerHTML = '<option value="">Leque todo</option>' + furosL.map(f=>`<option value="${f.id}">F${escapeHtml(String(f.numero))}</option>`).join('');
  fu.value = furosL.some(f=>f.id===atual) ? atual : '';
}
function lerAlvoLembrete(){
  const lq = document.getElementById('lb-alvo-leque'), fu = document.getElementById('lb-alvo-furo');
  if(!lq || !lq.value) return null;
  const c = checklistLeques.find(x=>x.id===lq.value); if(!c) return null;
  const cod = rotuloLequeLembrete(c);
  if(fu && fu.value){ const f = checklistFuros.find(x=>x.id===fu.value); if(f) return { tipo:'furo', id:f.id, rotulo: cod + ' F' + f.numero }; }
  return { tipo:'leque', id:c.id, rotulo: cod };
}
function zerarAlvoLembrete(){
  const lq = document.getElementById('lb-alvo-leque'), fu = document.getElementById('lb-alvo-furo');
  if(lq) lq.value = ''; if(fu){ fu.value = ''; fu.hidden = true; }
}
function irParaAlvoLembrete(id){
  const l = lembretes.find(x=>x.id===id); if(!l || !l.alvoTipo) return;
  const furo = l.alvoTipo === 'furo' ? checklistFuros.find(x=>x.id===l.alvoId) : null;
  const lequeId = furo ? furo.checklistLequeId : l.alvoId;
  const c = checklistLeques.find(x=>x.id===lequeId);
  if(!c){ showToast(`${l.alvoRotulo} não existe mais no checklist.`, { tipo:'aviso' }); return; }
  if(c.anelId !== anelAtivoId && typeof definirAnelAtivo === 'function') definirAnelAtivo(c.anelId);
  if(!lembretesEhLargo()) definirLembretesAberto(false);
  mostrarView('checklist');
  checklistExpandido.add(c.id);
  renderChecklist();
  setTimeout(()=>{
    if(furo) destacarLinhaFuro(furo.id);
    else { const card = document.getElementById('ck-card-' + c.id); if(card) card.scrollIntoView({ block:'center', behavior:'smooth' }); }
  }, 80);
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function sincronizarLembretes(){
  if(!usuarioAtual || !navigator.onLine) return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return;
  const { data, error } = await buscarTudo('lembretes');
  if(error || !data) return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return; // algo foi anotado durante a busca
  const novo = data.map(mapLembrete);
  if(JSON.stringify(novo) === JSON.stringify(lembretes)) return;
  lembretes = novo; salvarLembretesLocal(); renderLembretes();
}
function iniciarLembretes(){
  try{ lembretesRecolhido = localStorage.getItem(LEMBRETES_PREF_KEY) === '1'; lembretesLargo2 = localStorage.getItem(LEMBRETES_LARG_KEY) === '1'; }catch(e){}
  carregarLembretesLocal(); renderLembretes();
  sincronizarLembretes();
}
// Depois de cada atualização do servidor, atualiza também os lembretes.
(function(){
  const orig = atualizarDoServidor;
  atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); try{ await sincronizarLembretes(); }catch(e){} return r; };
})();
window.addEventListener('resize', ()=>{ if(usuarioAtual) renderLembretes(); });
window.addEventListener('online', ()=>{ setTimeout(sincronizarLembretes, 1500); });
// Entra em cena quando a pessoa loga (usuarioAtual definido).
let _lbPronto = false;
setInterval(()=>{ if(usuarioAtual && !_lbPronto){ _lbPronto = true; iniciarLembretes(); } else if(!usuarioAtual && _lbPronto){ _lbPronto = false; lembretes = []; const p = document.getElementById('lembretes-painel'), f = document.getElementById('lembretes-fab'); if(p) p.hidden = true; if(f) f.hidden = true; document.body.classList.remove('com-lembretes'); } }, 500);
