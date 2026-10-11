// ---------- Lembretes rápidos (pessoais) ----------
// Painel na lateral direita em tela larga; botão flutuante 📝 no celular.
// Cada pessoa vê só os seus. Funciona sem sinal: vai pela mesma fila de envio das marcações.
let lembretes = []; // { id, texto, feito, feitoEm, ts }
let lembretesAberto = false; // só vale no celular (no PC o painel fica fixo, a menos que recolhido)
let lembretesRecolhido = false;
const LEMBRETES_PREF_KEY = 'perfilagem-lembretes-recolhido-v1';
const chaveLembretes = () => 'perfilagem-lembretes-v1:' + (usuarioAtual && usuarioAtual.id || 'anon');

function mapLembrete(r){ return { id: r.id, texto: r.texto || '', feito: !!r.feito, feitoEm: r.feito_em || null, ts: r.criado_em || new Date().toISOString() }; }
function carregarLembretesLocal(){ try{ lembretes = JSON.parse(localStorage.getItem(chaveLembretes()) || '[]'); }catch(e){ lembretes = []; } }
function salvarLembretesLocal(){ try{ localStorage.setItem(chaveLembretes(), JSON.stringify(lembretes)); }catch(e){} }

function adicionarLembrete(texto){
  texto = String(texto || '').trim().slice(0, 500);
  if(!texto || !usuarioAtual) return;
  const l = { id: uuidv4(), texto, feito: false, feitoEm: null, ts: new Date().toISOString() };
  lembretes.push(l);
  salvarLembretesLocal();
  enfileirar('lembretes', 'insert', { id: l.id, user_id: usuarioAtual.id, texto: l.texto, feito: false, criado_em: l.ts });
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
  form.addEventListener('submit', e=>{ e.preventDefault(); adicionarLembrete(inp.value); inp.value = ''; inp.focus(); });
  p.querySelector('#lb-fechar').addEventListener('click', ()=>definirLembretesAberto(false));
  b.addEventListener('click', ()=>definirLembretesAberto(true));
  p.querySelector('#lb-limpar').addEventListener('click', limparLembretesFeitos);
  p.addEventListener('click', e=>{
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
  const item = l => `<li data-id="${l.id}" class="${l.feito?'feito':''}"><button type="button" class="lb-chk" role="checkbox" aria-checked="${l.feito}" aria-label="${l.feito?'Reabrir':'Marcar como resolvido'}"></button><span class="lb-txt" title="Tocar para editar">${escapeHtml(l.texto)}</span><button type="button" class="lb-del" aria-label="Apagar lembrete">✕</button></li>`;
  const foco = document.activeElement && p.contains(document.activeElement) && document.activeElement.id === 'lb-input';
  document.getElementById('lb-lista').innerHTML = pend.length ? pend.map(item).join('') : '<li class="lb-vazio">Nada pendente. Anote aqui o que precisa decidir depois.</li>';
  document.getElementById('lb-lista-feitos').innerHTML = feitos.map(item).join('');
  document.getElementById('lb-feitos').hidden = !feitos.length;
  document.getElementById('lb-feitos-t').textContent = `Resolvidos (${feitos.length})`;
  if(foco) document.getElementById('lb-input').focus();
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
