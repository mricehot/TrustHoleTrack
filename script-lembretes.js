// ---------- Lembretes rápidos (pessoais) ----------
// Painel na lateral direita em tela larga; botão flutuante 📝 no celular.
// Cada pessoa vê só os seus. Funciona sem sinal: vai pela mesma fila de envio das marcações.
let lembretes = []; // { id, texto, feito, feitoEm, ts }
let lembretesAberto = false; // só vale no celular (no PC o painel fica fixo, a menos que recolhido)
let lembretesRecolhido = false;
const LEMBRETES_PREF_KEY = 'perfilagem-lembretes-recolhido-v1';
const chaveLembretes = () => 'perfilagem-lembretes-v1:' + (usuarioAtual && usuarioAtual.id || 'anon');

function mapLembrete(r){ return { id: r.id, texto: r.texto || '', feito: !!r.feito, feitoEm: r.feito_em || null, ts: r.criado_em || new Date().toISOString(), alvoTipo: r.alvo_tipo || '', alvoId: r.alvo_id || '', alvoRotulo: r.alvo_rotulo || '' }; }
function carregarLembretesLocal(){ try{ lembretes = JSON.parse(localStorage.getItem(chaveLembretes()) || '[]'); }catch(e){ lembretes = []; } }
function salvarLembretesLocal(){ try{ localStorage.setItem(chaveLembretes(), JSON.stringify(lembretes)); }catch(e){} }

function adicionarLembrete(texto, alvo){
  texto = String(texto || '').trim().slice(0, 500);
  if(!texto || !usuarioAtual) return;
  alvo = alvo || {};
  const l = { id: uuidv4(), texto, feito: false, feitoEm: null, ts: new Date().toISOString(), alvoTipo: alvo.tipo || '', alvoId: alvo.id || '', alvoRotulo: alvo.rotulo || '' };
  lembretes.push(l);
  salvarLembretesLocal();
  const reg = { id: l.id, user_id: usuarioAtual.id, texto: l.texto, feito: false, criado_em: l.ts };
  if(l.alvoTipo){ reg.alvo_tipo = l.alvoTipo; reg.alvo_id = l.alvoId; reg.alvo_rotulo = l.alvoRotulo; }
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
function editarLembrete(id){
  const l = lembretes.find(x=>x.id===id); if(!l) return;
  const novo = prompt('Editar lembrete:', l.texto);
  if(novo === null) return;
  const t = novo.trim().slice(0, 500);
  if(!t){ apagarLembrete(id); return; }
  l.texto = t; salvarLembretesLocal();
  enfileirar('lembretes', 'update', { id, texto: t });
  renderLembretes();
}

function garantirPainelLembretes(){
  let p = document.getElementById('lembretes-painel');
  if(p) return p;
  p = document.createElement('aside'); p.id = 'lembretes-painel'; p.className = 'lembretes-painel'; p.hidden = true;
  p.setAttribute('aria-label', 'Lembretes rápidos');
  p.innerHTML = `
    <div class="lb-topo"><strong>📝 Lembretes</strong><span class="lb-cont" id="lb-cont"></span>
      <button type="button" class="lb-x" id="lb-fechar" aria-label="Fechar lembretes">✕</button></div>
    <form class="lb-novo" id="lb-form" autocomplete="off">
      <input type="text" id="lb-input" maxlength="500" placeholder="Anotar para decidir depois" enterkeyhint="done" aria-label="Novo lembrete">
      <button type="submit" aria-label="Adicionar lembrete">+</button>
    </form>
    <div class="lb-alvo" id="lb-alvo-linha">
      <select id="lb-alvo-leque" aria-label="Ligar a um leque"><option value="">🔗 Sem leque</option></select>
      <select id="lb-alvo-furo" aria-label="Ligar a um furo" hidden><option value="">Leque todo</option></select>
    </div>
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
  p.querySelector('#lb-fechar').addEventListener('click', ()=>definirLembretesAberto(false));
  b.addEventListener('click', ()=>definirLembretesAberto(true));
  p.querySelector('#lb-limpar').addEventListener('click', limparLembretesFeitos);
  p.addEventListener('click', e=>{
    const alvoBtn = e.target.closest('.lb-ir'); if(alvoBtn){ irParaAlvoLembrete(alvoBtn.closest('li').dataset.id); return; }
    const li = e.target.closest('li[data-id]'); if(!li) return;
    const id = li.dataset.id;
    if(e.target.closest('.lb-chk')) alternarLembrete(id);
    else if(e.target.closest('.lb-del')) apagarLembrete(id);
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
  fab.hidden = painelVisivel;
  document.body.classList.toggle('com-lembretes', largo && painelVisivel);
  const badge = document.getElementById('lb-badge'); badge.textContent = pend.length > 99 ? '99+' : pend.length; badge.hidden = !pend.length;
  document.getElementById('lb-cont').textContent = pend.length ? pend.length + ' pendente' + (pend.length>1?'s':'') : '';
  const item = l => `<li data-id="${l.id}" class="${l.feito?'feito':''}"><button type="button" class="lb-chk" role="checkbox" aria-checked="${l.feito}" aria-label="${l.feito?'Reabrir':'Marcar como resolvido'}"></button><span class="lb-txt" title="Tocar para editar">${escapeHtml(l.texto)}</span>${l.alvoTipo ? `<button type="button" class="lb-ir" title="Ir para ${escapeHtml(l.alvoRotulo)} no checklist">↗ ${escapeHtml(l.alvoRotulo)}</button>` : ''}<button type="button" class="lb-del" aria-label="Apagar lembrete">✕</button></li>`;
  const foco = document.activeElement && p.contains(document.activeElement) && document.activeElement.id === 'lb-input';
  document.getElementById('lb-lista').innerHTML = pend.length ? pend.map(item).join('') : '<li class="lb-vazio">Nada pendente. Anote aqui o que precisa decidir depois.</li>';
  document.getElementById('lb-lista-feitos').innerHTML = feitos.map(item).join('');
  document.getElementById('lb-feitos').hidden = !feitos.length;
  document.getElementById('lb-feitos-t').textContent = `Resolvidos (${feitos.length})`;
  preencherLequesLembrete();
  if(foco) document.getElementById('lb-input').focus();
}
// ----- vínculo com leque/furo -----
function codigoLequeCk(c){ return (PREFIXO[c.tipo] || '') + c.numero; }
function preencherLequesLembrete(){
  const sel = document.getElementById('lb-alvo-leque'); if(!sel) return;
  if(sel === document.activeElement) return; // não mexe enquanto a pessoa escolhe
  const atual = sel.value;
  const itens = (typeof checklistDoAnelAtivo === 'function') ? checklistDoAnelAtivo() : [];
  const sig = itens.map(c=>c.id + codigoLequeCk(c)).join('|');
  if(sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  sel.innerHTML = '<option value="">🔗 Sem leque</option>' + itens.map(c=>`<option value="${c.id}">${escapeHtml(codigoLequeCk(c))}</option>`).join('');
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
  const cod = codigoLequeCk(c);
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
  try{ lembretesRecolhido = localStorage.getItem(LEMBRETES_PREF_KEY) === '1'; }catch(e){}
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
