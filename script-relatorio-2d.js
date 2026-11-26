// ---------- Relatório 2D da tratativa ----------
// Modelo: 1ª página = imagem geral dos leques do realce (planejado azul × executado vermelho);
// depois uma página por leque = imagem do leque + tabela FURO / PLANEJADO / EXECUTADO / DESVIO (cm) / OBSERVAÇÃO.
// As imagens vêm do software de topografia (print/exportação) e ficam guardadas neste aparelho (IndexedDB).
let r2dDBp = null;
function r2dDB(){
  if(r2dDBp) return r2dDBp;
  r2dDBp = new Promise((ok, falha)=>{ try{ const rq = indexedDB.open('relatorio2d-imagens-v1', 1);
    rq.onupgradeneeded = ()=> rq.result.createObjectStore('img'); rq.onsuccess = ()=> ok(rq.result); rq.onerror = ()=> falha(rq.error); }catch(e){ falha(e); } });
  return r2dDBp;
}
async function r2dImg(op, chave, valor){
  try{ const d = await r2dDB();
    return await new Promise((ok, falha)=>{ const tx = d.transaction('img', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('img');
      const rq = op === 'get' ? st.get(chave) : op === 'put' ? st.put(valor, chave) : st.delete(chave); rq.onsuccess = ()=> ok(rq.result); rq.onerror = ()=> falha(rq.error); });
  }catch(e){ return null; }
}
// Reduz a imagem (máx. 1800 px no maior lado, JPEG) para não pesar no aparelho nem no PDF.
function r2dReduzir(arq){
  return new Promise((ok, falha)=>{
    const url = URL.createObjectURL(arq), im = new Image();
    im.onload = ()=>{ const k = Math.min(1, 1800 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); cv.toBlob(b=> b ? ok({ blob:b, w:cv.width, h:cv.height }) : falha(new Error('imagem inválida')), 'image/jpeg', 0.88); };
    im.onerror = ()=>{ URL.revokeObjectURL(url); falha(new Error('Não consegui ler essa imagem.')); };
    im.src = url;
  });
}
const r2dParaDataURL = blob => new Promise(ok=>{ const r = new FileReader(); r.onload = ()=> ok(r.result); r.readAsDataURL(blob); });

function r2dLequesDoRealce(anelId){
  return checklistLeques.filter(c=>c.anelId === anelId).map(estadoTratativaLeque)
    .sort((x,y)=> codigoLequeCk(x.c).localeCompare(codigoLequeCk(y.c), undefined, { numeric:true }));
}
function r2dObsAuto(f){ return f.obsTratamento || (f.obstruido ? (furoDetonado(f) ? 'Detonado' : 'Obstruído') : ''); }
const r2dNum = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ',');
const r2dLer = s => { const t = String(s).trim().replace(',', '.'); return t === '' || isNaN(Number(t)) ? null : Number(t); };

let r2dEstado = null; // { anelId, incluir:Set(lequeId), aberto:lequeId|null, urls:{chave:url} }

async function abrirRelatorio2D(anelId){
  const a = aneis.find(x=>x.id === (anelId || anelAtivoId)); if(!a){ showToast('Nenhum realce ativo.'); return; }
  const lista = r2dLequesDoRealce(a.id);
  if(!lista.length){ showToast('Esse realce não tem leques no checklist.', { tipo:'aviso' }); return; }
  r2dEstado = { anelId: a.id, incluir: new Set(lista.filter(e=>e.tratado).map(e=>e.c.id)), aberto: null, urls: {} };
  if(!r2dEstado.incluir.size) lista.forEach(e=> r2dEstado.incluir.add(e.c.id));
  await r2dRender();
}

async function r2dUrl(chave){
  if(r2dEstado.urls[chave] !== undefined) return r2dEstado.urls[chave];
  const v = await r2dImg('get', chave); r2dEstado.urls[chave] = v && v.blob ? URL.createObjectURL(v.blob) : null; return r2dEstado.urls[chave];
}

async function r2dRender(){
  const st = r2dEstado; if(!st) return; const a = aneis.find(x=>x.id === st.anelId); const lista = r2dLequesDoRealce(a.id);
  const geral = await r2dUrl('geral:' + a.id);
  const linhas = [];
  for(const e of lista){
    const id = e.c.id, cod = codigoLequeCk(e.c), url = await r2dUrl('leque:' + id), aberto = st.aberto === id, fs = checklistFurosDoLeque(id).slice().sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, { numeric:true }));
    linhas.push(`<div class="r2d-leque ${aberto ? 'aberto' : ''}">
      <div class="r2d-l1">
        <label class="r2d-inc"><input type="checkbox" data-r2d-inc="${id}" ${st.incluir.has(id) ? 'checked' : ''}><b>${escHtml(cod)}</b></label>
        <span class="r2d-sit ${e.tratado ? 'ok' : ''}">${e.tratado ? 'tratado' : e.pronto ? 'pronto' : ''}</span>
        <span class="r2d-img-st">${url ? '🖼 imagem ✓' : 'sem imagem'}</span>
        <button type="button" class="ghost" data-r2d-abrir="${id}" aria-expanded="${aberto}">${aberto ? 'Fechar ▲' : 'Imagem e tabela ▼'}</button>
      </div>
      ${aberto ? `<div class="r2d-corpo">
        <div class="r2d-img-linha">${url ? `<img src="${url}" alt="imagem do ${escHtml(cod)}">` : '<div class="r2d-img-vazia">Anexe a imagem deste leque</div>'}
          <div class="r2d-img-acoes"><button type="button" class="steel" data-r2d-anexar="leque:${id}">${url ? 'Trocar imagem' : 'Anexar imagem'}</button>${url ? `<button type="button" class="ghost" data-r2d-remover="leque:${id}">Remover</button>` : ''}</div></div>
        <div class="r2d-tab-scroll"><table class="r2d-tab"><thead><tr><th>Furo</th><th>Planejado (m)</th><th>Executado (m)</th><th>Desvio (cm)</th><th>Observação</th></tr></thead><tbody>
          ${fs.map(f=>`<tr data-furo="${f.id}"><td><b>${escHtml(String(f.numero))}</b></td><td>${r2dNum(f.metragemEsperada)}</td>
            <td><input inputmode="decimal" data-r2d-campo="metragem" value="${r2dNum(f.metragem > 0 ? f.metragem : '')}" aria-label="Executado do furo ${escHtml(String(f.numero))}"></td>
            <td><input inputmode="decimal" data-r2d-campo="desvioCm" value="${r2dNum(f.desvioCm)}" aria-label="Desvio em cm do furo ${escHtml(String(f.numero))}"></td>
            <td><input type="text" data-r2d-campo="obsTratamento" maxlength="60" value="${escHtml(r2dObsAuto(f))}" placeholder="Obstruído, Varado…" aria-label="Observação do furo ${escHtml(String(f.numero))}"></td></tr>`).join('') || '<tr><td colspan="5">Sem furos.</td></tr>'}
        </tbody></table></div></div>` : ''}
    </div>`);
  }
  el('modal-root').innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga r2d-box">
    <p style="font-weight:700;margin:0 0 4px;">Relatório 2D · ${escHtml(a.nome)}</p>
    <div class="hint" style="margin-bottom:10px;">Página 1: imagem geral dos leques. Depois, uma página por leque marcado, com a imagem e a tabela. As imagens ficam guardadas neste aparelho.</div>
    <div class="r2d-geral"><b>1 · Imagem geral dos leques</b>
      ${geral ? `<img src="${geral}" alt="imagem geral dos leques">` : '<div class="r2d-img-vazia">Anexe a imagem com todos os leques do realce</div>'}
      <div class="r2d-img-acoes"><button type="button" class="steel" data-r2d-anexar="geral:${a.id}">${geral ? 'Trocar imagem' : 'Anexar imagem'}</button>${geral ? `<button type="button" class="ghost" data-r2d-remover="geral:${a.id}">Remover</button>` : ''}</div></div>
    <b style="display:block;margin:12px 0 4px;">2 · Leques no relatório</b>
    <div class="rel-atalhos"><button type="button" class="ghost" id="r2d-todos">Marcar todos</button><button type="button" class="ghost" id="r2d-trat">Só tratados</button></div>
    <div class="r2d-lista">${linhas.join('')}</div>
    <input type="file" id="r2d-arq" accept="image/*" hidden>
    <div class="modal-actions"><button class="ghost" id="r2d-fechar">Fechar</button><button class="steel" id="r2d-pdf">Gerar PDF</button></div>
  </div></div>`;
}

document.addEventListener('click', async ev=>{
  const t = ev.target; if(!r2dEstado || !t.closest || !t.closest('.r2d-box') && t.id !== 'modal-overlay') return;
  if(t.id === 'modal-overlay' || t.id === 'r2d-fechar'){ Object.values(r2dEstado.urls).forEach(u=> u && URL.revokeObjectURL(u)); r2dEstado = null; el('modal-root').innerHTML = ''; return; }
  if(t.id === 'r2d-todos'){ r2dLequesDoRealce(r2dEstado.anelId).forEach(e=> r2dEstado.incluir.add(e.c.id)); return r2dRender(); }
  if(t.id === 'r2d-trat'){ r2dEstado.incluir = new Set(r2dLequesDoRealce(r2dEstado.anelId).filter(e=>e.tratado).map(e=>e.c.id)); return r2dRender(); }
  if(t.id === 'r2d-pdf'){ return gerarRelatorio2DPDF(); }
  const ab = t.closest('[data-r2d-abrir]'); if(ab){ const id = ab.dataset.r2dAbrir; r2dEstado.aberto = r2dEstado.aberto === id ? null : id; return r2dRender(); }
  const an = t.closest('[data-r2d-anexar]'); if(an){ const inp = el('r2d-arq'); inp.dataset.chave = an.dataset.r2dAnexar; inp.value = ''; inp.click(); return; }
  const rm = t.closest('[data-r2d-remover]'); if(rm){ const k = rm.dataset.r2dRemover; await r2dImg('del', k); if(r2dEstado.urls[k]) URL.revokeObjectURL(r2dEstado.urls[k]); delete r2dEstado.urls[k]; return r2dRender(); }
});
document.addEventListener('change', async ev=>{
  const t = ev.target; if(!r2dEstado) return;
  if(t.id === 'r2d-arq' && t.files && t.files[0]){
    try{ const r = await r2dReduzir(t.files[0]); const k = t.dataset.chave; await r2dImg('put', k, { blob: r.blob, w: r.w, h: r.h });
      if(r2dEstado.urls[k]) URL.revokeObjectURL(r2dEstado.urls[k]); delete r2dEstado.urls[k]; showToast('Imagem anexada.', { tipo:'ok' }); }
    catch(e){ showToast(e.message || 'Não consegui anexar a imagem.', { tipo:'erro' }); }
    return r2dRender();
  }
  const inc = t.closest && t.closest('[data-r2d-inc]'); if(inc){ const id = inc.dataset.r2dInc; if(inc.checked) r2dEstado.incluir.add(id); else r2dEstado.incluir.delete(id); return; }
  const campo = t.dataset && t.dataset.r2dCampo; if(!campo) return;
  const f = checklistFuros.find(x=>x.id === t.closest('tr').dataset.furo); if(!f) return;
  const reg = { id: f.id };
  if(campo === 'obsTratamento'){ const v = t.value.trim(); f.obsTratamento = (v === r2dObsAuto({ ...f, obsTratamento:'' })) ? '' : v; reg.obs_tratamento = f.obsTratamento || null; }
  else { const v = r2dLer(t.value); if(campo === 'metragem'){ f.metragem = v; reg.metragem = v; } else { f.desvioCm = v; reg.desvio_cm = v; } t.value = r2dNum(v); }
  enfileirar('checklist_furos', 'update', reg); salvarChecklistFurosLocal();
});

async function gerarRelatorio2DPDF(){
  const st = r2dEstado; if(!st) return;
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const a = aneis.find(x=>x.id === st.anelId), lista = r2dLequesDoRealce(a.id).filter(e=> st.incluir.has(e.c.id));
  const geral = await r2dImg('get', 'geral:' + a.id);
  if(!geral && !lista.length){ showToast('Anexe a imagem geral ou marque ao menos um leque.', { tipo:'aviso' }); return; }
  showToast('Gerando o PDF…');
  const doc = new window.jspdf.jsPDF(), NOME = a.nome;
  const cab = (cod)=>{
    doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, 12, cod ? 100 : 60, 12); doc.setFont(undefined,'bold'); doc.setFontSize(11); doc.text(NOME, 17, 19.5, { maxWidth: cod ? 70 : 56 });
    if(cod){ doc.line(87, 12, 87, 24); doc.text(cod, 101, 19.5, { align:'center' }); }
    try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64, 'JPEG', 170, 8, 25, 24.5); }catch(e){}
  };
  const infoLinha = ()=>{ doc.setFont(undefined,'normal'); doc.setFontSize(8.5); doc.setTextColor(110);
    doc.text(`Supervisor: ${configApp.supervisor || '-'}   ·   Projeto: ${configApp.projetoAtivo || '-'}   ·   Gerado em ${new Date().toLocaleString('pt-BR')}`, 15, 31, { maxWidth: 150 }); doc.setTextColor(0); };
  const imagem = async (reg, x, y, wMax, hMax)=>{
    if(!reg){ doc.setDrawColor(190); doc.setLineDashPattern([2,2],0); doc.rect(x, y, wMax, Math.min(hMax, 60)); doc.setLineDashPattern([],0); doc.setFontSize(9); doc.setTextColor(140); doc.text('(sem imagem anexada)', x + wMax/2, y + 30, { align:'center' }); doc.setTextColor(0); return Math.min(hMax, 60); }
    let w = wMax, h = w * reg.h / reg.w; if(h > hMax){ h = hMax; w = h * reg.w / reg.h; }
    doc.addImage(await r2dParaDataURL(reg.blob), 'JPEG', x + (wMax - w)/2, y, w, h); return h;
  };
  const legenda = (y, geral)=>{ doc.setFont(undefined,'bold'); doc.setFontSize(10); doc.text('LEGENDA', 15, y); doc.text(geral ? 'AZUL: PLANEJADO' : 'LINHA AZUL: PLANEJADO', 15, y + 5); doc.text(geral ? 'VERMELHO: EXECUTADO' : 'TRACEJADO VERMELHA: EXECUTADO', 15, y + 10); };
  // Página 1 — cabeçalho completo (logo, título, gerado em, supervisor e projeto) + imagem geral
  let y1 = await desenharCabecalhoTurnoPDF(doc, { titulo:'RELATÓRIO 2D DE TRATATIVA' }) - 4;
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, y1, 100, 10); doc.setFont(undefined,'bold'); doc.setFontSize(11); doc.text(NOME, 17, y1 + 6.8, { maxWidth: 96 });
  y1 += 14; const hG = await imagem(geral, 15, y1, 180, 285 - y1 - 20); legenda(y1 + hG + 8, true);
  // Uma página por leque
  for(const e of lista){
    doc.addPage(); cab(codigoLequeCk(e.c)); infoLinha();
    const fs = checklistFurosDoLeque(e.c.id).slice().sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, { numeric:true }));
    const linhaH = 6.2, tabH = (fs.length + 1) * linhaH, hMax = Math.max(60, 285 - 38 - 22 - tabH - 6);
    const reg = await r2dImg('get', 'leque:' + e.c.id), h = await imagem(reg, 15, 38, 180, Math.min(hMax, 130));
    let y = 38 + h + 8; legenda(y); y += 14;
    const COLS = [['FURO',15],['PLANEJADO (m)',34],['EXECUTADO (m)',34],['DESVIO (CM)',28],['OBSERVAÇÃO',69]];
    doc.setLineWidth(0.2); doc.setDrawColor(0); doc.setFontSize(8);
    let x = 15; doc.setFont(undefined,'bold'); COLS.forEach(([t,w])=>{ doc.rect(x, y, w, linhaH); doc.text(t, x + w/2, y + 4.2, { align:'center' }); x += w; }); y += linhaH;
    doc.setFont(undefined,'normal'); doc.setFontSize(9);
    fs.forEach(f=>{
      const cel = [String(f.numero), r2dNum(f.metragemEsperada), r2dNum(f.metragem > 0 ? f.metragem : ''), r2dNum(f.desvioCm), r2dObsAuto(f)];
      x = 15; COLS.forEach(([,w],i)=>{ doc.rect(x, y, w, linhaH); doc.setFont(undefined, i === 3 && cel[i] ? 'bold' : 'normal'); doc.text(cel[i], x + w/2, y + 4.3, { align:'center', maxWidth: w - 2 }); x += w; }); y += linhaH;
    });
  }
  adicionarMarcaDaguaPDF(doc);
  await baixarOuCompartilharPDF(doc, `relatorio-2d_${String(NOME).replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`, true);
  showToast('Relatório 2D gerado.', { tipo:'ok' });
}
