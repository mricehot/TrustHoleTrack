/* ================= Foto do furo (checklist) — funciona sem sinal ================= */
// A foto é reduzida, guardada no aparelho (IndexedDB) e sobe sozinha quando houver internet.
// Só depois do upload ela ganha link público (checklist_furos.foto_url), que vai no relatório do WhatsApp.
const FOTOS_DB = 'blasthole-fotos', FOTOS_STORE = 'pendentes';
const fotosPendentes = new Map();      // furoId -> { furoId, blob, criadoEm }
const fotosMiniaturas = new Map();     // furoId -> object URL (pré-visualização local)
let enviandoFotos = false;

function fotosAbrirDB(){
  return new Promise((ok, erro)=>{
    if(!window.indexedDB){ erro(new Error('sem IndexedDB')); return; }
    const rq = indexedDB.open(FOTOS_DB, 1);
    rq.onupgradeneeded = ()=> rq.result.createObjectStore(FOTOS_STORE, { keyPath:'furoId' });
    rq.onsuccess = ()=> ok(rq.result);
    rq.onerror = ()=> erro(rq.error);
  });
}
async function fotosDB(modo, fn){
  const db = await fotosAbrirDB();
  return new Promise((ok, erro)=>{
    const tx = db.transaction(FOTOS_STORE, modo), st = tx.objectStore(FOTOS_STORE);
    const r = fn(st);
    tx.oncomplete = ()=>{ db.close(); ok(r && 'result' in r ? r.result : undefined); };
    tx.onerror = tx.onabort = ()=>{ db.close(); erro(tx.error); };
  });
}
async function carregarFotosPendentes(){
  try{
    const todas = await fotosDB('readonly', st=> st.getAll());
    (todas || []).forEach(x=> fotosPendentes.set(x.furoId, x));
    if(fotosPendentes.size){ atualizarIndicadorSalvamento(); try{ renderChecklist(); }catch(e){} }
  }catch(e){}
}

// Reduz para no máximo 1280 px e JPEG ~72%: costuma ficar entre 100 e 300 KB (importa com sinal ruim).
async function reduzirFoto(arquivo){
  try{
    const bmp = await createImageBitmap(arquivo);
    const esc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r=> c.toBlob(r, 'image/jpeg', 0.72));
    return blob || arquivo;
  }catch(e){ return arquivo; }
}

function miniaturaFuro(f){
  if(fotosPendentes.has(f.id)){
    if(!fotosMiniaturas.has(f.id)) fotosMiniaturas.set(f.id, URL.createObjectURL(fotosPendentes.get(f.id).blob));
    return fotosMiniaturas.get(f.id);
  }
  return f.fotoUrl || '';
}

function tirarFotoFuro(id){
  const f = checklistFuros.find(x=>x.id===id); if(!f) return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
  inp.addEventListener('change', async ()=>{
    const arq = inp.files && inp.files[0]; if(!arq) return;
    const blob = await reduzirFoto(arq);
    const reg = { furoId: id, blob, criadoEm: Date.now() };
    try{ await fotosDB('readwrite', st=> st.put(reg)); }
    catch(e){ showToast('Não consegui guardar a foto neste aparelho.', { tipo:'erro' }); return; }
    if(fotosMiniaturas.has(id)){ URL.revokeObjectURL(fotosMiniaturas.get(id)); fotosMiniaturas.delete(id); }
    fotosPendentes.set(id, reg);
    try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}
    atualizarIndicadorSalvamento(); renderChecklist();
    showToast(navigator.onLine ? `Foto de F${f.numero} guardada, enviando…` : `Foto de F${f.numero} guardada no aparelho. Sobe sozinha quando houver sinal.`, { tipo:'ok' });
    enviarFotosPendentes();
  });
  inp.click();
}

async function enviarFotosPendentes(){
  if(enviandoFotos || !fotosPendentes.size || !navigator.onLine || typeof db === 'undefined' || !usuarioAtual) return 0;
  enviandoFotos = true; let enviadas = 0;
  try{
    for(const reg of [...fotosPendentes.values()]){
      const f = checklistFuros.find(x=>x.id===reg.furoId);
      if(!f){ // furo não existe mais (removido): descarta a foto
        fotosPendentes.delete(reg.furoId); try{ await fotosDB('readwrite', st=> st.delete(reg.furoId)); }catch(e){}
        continue;
      }
      try{
        const caminho = `furo-${reg.furoId}-${reg.criadoEm}.jpg`;
        const { error } = await db.storage.from('fotos-leque').upload(caminho, reg.blob, { contentType:'image/jpeg', upsert:false });
        if(error && !/exists|duplicate/i.test(error.message || '')) throw error;
        const { data } = db.storage.from('fotos-leque').getPublicUrl(caminho);
        f.fotoUrl = data.publicUrl;
        enfileirar('checklist_furos', 'update', { id: f.id, foto_url: f.fotoUrl });
        salvarChecklistFurosLocal();
        fotosPendentes.delete(reg.furoId);
        if(fotosMiniaturas.has(reg.furoId)){ URL.revokeObjectURL(fotosMiniaturas.get(reg.furoId)); fotosMiniaturas.delete(reg.furoId); }
        await fotosDB('readwrite', st=> st.delete(reg.furoId));
        enviadas++;
      }catch(e){ break; } // sem sinal de verdade: tenta de novo mais tarde
    }
  } finally { enviandoFotos = false; }
  if(enviadas){ renderChecklist(); showToast(`${enviadas} foto(s) enviada(s).`, { tipo:'ok' }); }
  atualizarIndicadorSalvamento();
  return enviadas;
}

async function verFotoFuro(id){
  const f = checklistFuros.find(x=>x.id===id); if(!f) return;
  const src = miniaturaFuro(f); if(!src){ tirarFotoFuro(id); return; }
  const pend = fotosPendentes.has(id);
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga">
    <p style="font-weight:700;">Foto do F${escHtml(String(f.numero))}${pend ? ' <span class="hint">· aguardando sinal para enviar</span>' : ''}</p>
    <img src="${src}" alt="foto do furo ${escHtml(String(f.numero))}" style="max-width:100%;max-height:60vh;border-radius:8px;display:block;margin:8px auto;">
    <div class="modal-actions"><button class="ghost perigo" id="foto-remover">Remover</button><button class="ghost" id="foto-trocar">Trocar</button><button class="steel" id="modal-fechar">Fechar</button></div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('modal-fechar').onclick = fechar;
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('foto-trocar').onclick = ()=>{ fechar(); tirarFotoFuro(id); };
  el('foto-remover').onclick = async ()=>{
    fechar();
    if(pend){ fotosPendentes.delete(id); try{ await fotosDB('readwrite', st=> st.delete(id)); }catch(e){} }
    if(f.fotoUrl){ f.fotoUrl = ''; enfileirar('checklist_furos', 'update', { id: f.id, foto_url: null }); salvarChecklistFurosLocal(); }
    atualizarIndicadorSalvamento(); renderChecklist(); showToast('Foto removida.');
  };
}

// Relatório do WhatsApp: link de cada foto já enviada; as que ainda estão no aparelho são avisadas.
function blocoFotosFurosWhatsApp(itens){
  const linhas = [];
  itens.forEach(c=> checklistFurosDoLeque(c.id).forEach(f=>{
    const cod = `${PREFIXO[c.tipo]}${c.numero} F${f.numero}`;
    if(f.fotoUrl && !fotosPendentes.has(f.id)) linhas.push(`${cod}: ${f.fotoUrl}`);
    else if(fotosPendentes.has(f.id)) linhas.push(`${cod}: foto ainda nao enviada (sem sinal)`);
  }));
  return linhas.length ? `📷 *FOTOS*\n${linhas.join('\n')}` : '';
}
// Antes de montar o relatório, dá uma chance de as fotos pendentes subirem (com sinal, leva poucos segundos).
async function fotosEmDiaParaRelatorio(){
  if(!fotosPendentes.size || !navigator.onLine) return;
  showToast(`Enviando ${fotosPendentes.size} foto(s) antes do relatório…`);
  await Promise.race([enviarFotosPendentes(), new Promise(r=> setTimeout(r, 20000))]);
}

// Envia as fotos como IMAGENS (o texto do WhatsApp só leva link). Usa o compartilhamento do celular:
// abre a lista de apps, a pessoa escolhe o WhatsApp e o contato/grupo.
async function enviarFotosWhatsApp(idsLeques){
  const lista = [];
  idsLeques.forEach(lid=>{
    const c = checklistLeques.find(x=>x.id===lid); if(!c) return;
    checklistFurosDoLeque(lid).forEach(f=>{ if(f.fotoUrl || fotosPendentes.has(f.id)) lista.push({ f, nome: `${PREFIXO[c.tipo]}${c.numero}-F${f.numero}` }); });
  });
  if(!lista.length){ showToast('Nenhuma foto de furo neste envio.', { tipo:'aviso' }); return; }
  showToast(`Preparando ${lista.length} foto(s)…`);
  const arquivos = [];
  for(const it of lista){
    try{
      let blob = fotosPendentes.has(it.f.id) ? fotosPendentes.get(it.f.id).blob : null;
      if(!blob){ const r = await fetch(it.f.fotoUrl); if(!r.ok) throw new Error('http ' + r.status); blob = await r.blob(); }
      arquivos.push(new File([blob], it.nome + '.jpg', { type: blob.type || 'image/jpeg' }));
    }catch(e){ /* sem sinal para baixar essa: segue com as outras */ }
  }
  if(!arquivos.length){ showToast('Não consegui carregar as fotos (sem sinal?). Tente de novo com internet.', { tipo:'aviso' }); return; }
  if(!(navigator.canShare && navigator.canShare({ files: arquivos }))){
    showToast('Este aparelho não envia fotos pelo app. Use os links que vão no relatório.', { tipo:'aviso' }); return;
  }
  try{ await navigator.share({ files: arquivos, text: 'Fotos: ' + lista.map(x=>x.nome).join(', ') }); }
  catch(e){ if(e && e.name !== 'AbortError') showToast('Não foi possível abrir o compartilhamento.', { tipo:'aviso' }); }
}

window.addEventListener('online', ()=> setTimeout(enviarFotosPendentes, 800));
setInterval(enviarFotosPendentes, 30000);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') setTimeout(enviarFotosPendentes, 1000); });
window.addEventListener('load', ()=> setTimeout(carregarFotosPendentes, 600));
