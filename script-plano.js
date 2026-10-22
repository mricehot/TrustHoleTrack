// ---------- Plano de perfuração (PDF) no realce ----------
// O gestor anexa o PDF ao realce; todo mundo abre. O arquivo fica guardado no aparelho depois da
// primeira abertura (ou assim que o realce ativo sincroniza com sinal), então abre também no fundo da mina, sem internet.
const PLANO_BUCKET = 'planos-perfuracao';
const PLANO_MAX_BYTES = 25 * 1024 * 1024;

// ----- cache no aparelho (IndexedDB) -----
let planoDBp = null;
function planoDB(){
  if(planoDBp) return planoDBp;
  planoDBp = new Promise((ok, falha)=>{
    try{
      const rq = indexedDB.open('perfilagem-planos-v1', 1);
      rq.onupgradeneeded = ()=> rq.result.createObjectStore('planos');
      rq.onsuccess = ()=> ok(rq.result);
      rq.onerror = ()=> falha(rq.error);
    }catch(e){ falha(e); }
  });
  return planoDBp;
}
async function planoCache(op, chave, valor){
  try{
    const d = await planoDB();
    return await new Promise((ok, falha)=>{
      const tx = d.transaction('planos', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('planos');
      const rq = op === 'get' ? st.get(chave) : op === 'put' ? st.put(valor, chave) : st.delete(chave);
      rq.onsuccess = ()=> ok(rq.result);
      rq.onerror = ()=> falha(rq.error);
    });
  }catch(e){ return null; }
}
const tempoPlano = v => v ? new Date(v).getTime() : 0;

// Devolve o PDF (Blob): do aparelho se estiver em dia, senão baixa e guarda.
async function obterPlano(a){
  const guardado = await planoCache('get', a.planoPath);
  const emDia = guardado && tempoPlano(guardado.em) === tempoPlano(a.planoEm);
  if(emDia) return guardado.blob;
  if(!navigator.onLine){
    if(guardado) return guardado.blob; // sem sinal: melhor uma versão guardada do que nada
    throw new Error('Sem sinal e o plano ainda não foi baixado neste aparelho.');
  }
  const { data, error } = await db.storage.from(PLANO_BUCKET).download(a.planoPath);
  if(error || !data) throw new Error('Não foi possível baixar o plano: ' + ((error && error.message) || 'tente de novo'));
  const blob = new Blob([data], { type:'application/pdf' });
  await planoCache('put', a.planoPath, { blob, em: a.planoEm || '' });
  return blob;
}

async function abrirPlano(anelId){
  const a = aneis.find(x=>x.id === (anelId || anelAtivoId));
  if(!a || !a.planoPath){ showToast('Este realce não tem plano de perfuração anexado.', { tipo:'aviso' }); return; }
  // A janela abre já (antes do download) para o navegador não bloquear como pop-up.
  let janela = null;
  try{ janela = window.open('', '_blank'); if(janela) janela.document.write('<p style="font-family:sans-serif;padding:20px">Abrindo o plano…</p>'); }catch(e){}
  try{
    const blob = await obterPlano(a);
    const url = URL.createObjectURL(blob);
    if(janela && !janela.closed) janela.location.href = url;
    else { const l = document.createElement('a'); l.href = url; l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); }
    setTimeout(()=> URL.revokeObjectURL(url), 5 * 60 * 1000);
  }catch(e){
    if(janela) try{ janela.close(); }catch(_){}
    showToast(e.message || 'Não foi possível abrir o plano.', { erro:true });
  }
}

// ----- anexar / trocar / remover (só gestor) -----
// Envia o PDF e grava no realce. Devolve true se anexou. A empresa vem do próprio realce ou de qualquer
// outro já sincronizado (é a mesma empresa), assim dá para anexar logo ao criar o realce.
async function enviarPlano(a, arq, silencioso){
  if(!/pdf$/i.test(arq.type) && !/\.pdf$/i.test(arq.name)){ showToast('O arquivo precisa ser um PDF.', { tipo:'aviso' }); return false; }
  if(arq.size > PLANO_MAX_BYTES){ showToast(`O PDF tem ${(arq.size/1048576).toFixed(1)} MB. O limite é 25 MB.`, { tipo:'aviso' }); return false; }
  if(!navigator.onLine){ showToast('Sem sinal. Para anexar o PDF é preciso internet.', { tipo:'aviso' }); return false; }
  const empresaId = a.empresaId || (aneis.find(x=>x.empresaId) || {}).empresaId;
  if(!empresaId){ showToast('Sincronize o app antes de anexar (o realce ainda não foi enviado).', { tipo:'aviso' }); return false; }
  if(!silencioso) showToast('Enviando o PDF…');
  const caminho = `${empresaId}/${a.id}.pdf`;
  const { error } = await db.storage.from(PLANO_BUCKET).upload(caminho, arq, { upsert:true, contentType:'application/pdf' });
  if(error){ showToast('Não foi possível enviar o PDF: ' + error.message, { erro:true }); return false; }
  const agora = new Date().toISOString();
  a.planoPath = caminho; a.planoNome = arq.name; a.planoEm = agora;
  await planoCache('put', caminho, { blob: new Blob([arq], { type:'application/pdf' }), em: agora });
  enfileirar('aneis', 'update', { id: a.id, plano_path: caminho, plano_nome: arq.name, plano_atualizado_em: agora });
  salvarLocal(); renderAll();
  if(!silencioso) showToast(`Plano anexado: ${arq.name}`, { tipo:'ok' });
  return true;
}
function anexarPlano(anelId){
  if(!exigirGestor('anexar o plano de perfuração')) return;
  const a = aneis.find(x=>x.id===anelId); if(!a) return;
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async ()=>{
    const arq = inp.files && inp.files[0]; if(!arq) return;
    if(await enviarPlano(a, arq) && typeof sugerirCriarLeques === 'function') sugerirCriarLeques(a.id, arq);
  };
  inp.click();
}
async function removerPlano(anelId){
  if(!exigirGestor('remover o plano de perfuração')) return;
  const a = aneis.find(x=>x.id===anelId); if(!a || !a.planoPath) return;
  if(!confirm(`Remover o PDF do plano de ${a.nome}?`)) return;
  if(!navigator.onLine){ showToast('Sem sinal. Para remover o PDF é preciso internet.', { tipo:'aviso' }); return; }
  const caminho = a.planoPath;
  const { error } = await db.storage.from(PLANO_BUCKET).remove([caminho]);
  if(error){ showToast('Não foi possível remover o PDF: ' + error.message, { erro:true }); return; }
  a.planoPath = ''; a.planoNome = ''; a.planoEm = '';
  await planoCache('del', caminho);
  enfileirar('aneis', 'update', { id: a.id, plano_path: null, plano_nome: null, plano_atualizado_em: null });
  salvarLocal(); renderAll();
  showToast('Plano removido.', { tipo:'ok' });
}
// Menu do gestor: trocar ou remover
function menuPlano(anelId){
  const a = aneis.find(x=>x.id===anelId); if(!a) return;
  if(!a.planoPath){ anexarPlano(anelId); return; }
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;">Plano de perfuração · ${escHtml(a.nome)}</p>
    <p class="hint">${escHtml(a.planoNome || 'PDF anexado')}</p>
    <div class="modal-actions" style="flex-wrap:wrap;gap:8px;">
      <button class="ghost" id="pl-fechar">Fechar</button>
      <button class="ghost" id="pl-remover">Remover</button>
      <button class="steel" id="pl-trocar">Trocar PDF</button>
    </div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('pl-fechar').onclick = fechar;
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('pl-trocar').onclick = ()=>{ fechar(); anexarPlano(anelId); };
  el('pl-remover').onclick = ()=>{ fechar(); removerPlano(anelId); };
}

// ----- botões do realce ativo (Checklist e Perfilagem) -----
function atualizarBotoesPlano(){
  const a = aneis.find(x=>x.id===anelAtivoId);
  document.querySelectorAll('.btn-plano-ativo').forEach(b=>{ b.hidden = !(a && a.planoPath); });
  // No Checklist o botão fica sempre à vista (junto do relatório em imagem); sem plano anexado ele fica apagado e avisa ao tocar.
  document.querySelectorAll('.btn-plano-checklist').forEach(b=>{ const tem = !!(a && a.planoPath); b.classList.toggle('sem-plano', !tem); b.title = tem ? 'abre o PDF do plano de perfuração deste realce' : 'este realce ainda não tem plano anexado'; });
}
// Baixa o plano do realce ativo em segundo plano (com sinal), para abrir depois sem internet.
async function guardarPlanoAtivo(){
  const a = aneis.find(x=>x.id===anelAtivoId);
  if(!a || !a.planoPath || !navigator.onLine) return;
  try{ await obterPlano(a); }catch(e){}
}
(function(){
  ['renderAll'].forEach(nome=>{
    const orig = window[nome]; if(typeof orig !== 'function') return;
    window[nome] = function(){ const r = orig.apply(this, arguments); try{ atualizarBotoesPlano(); }catch(e){} return r; };
  });
  const origAtualiza = atualizarDoServidor;
  atualizarDoServidor = async function(){ const r = await origAtualiza.apply(this, arguments); try{ atualizarBotoesPlano(); guardarPlanoAtivo(); }catch(e){} return r; };
  window.addEventListener('online', ()=> setTimeout(guardarPlanoAtivo, 2000));
})();
