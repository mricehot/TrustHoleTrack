// ---------- Relatório das tratativas: realces, leques, furos, metragens e envios (PDF ou planilha CSV) ----------
const fmtM = n => (Math.round(Number(n || 0) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 });
const fmtDataBR = iso => { if(!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }); };

function dadosRelatorioTratativa(anelIds){
  const ids = new Set(anelIds);
  const realces = aneis.filter(a=>ids.has(a.id)).sort((a,b)=> String(a.nome).localeCompare(String(b.nome), undefined, { numeric:true })).map(a=>{
    const cks = checklistLeques.filter(c=>c.anelId === a.id).map(estadoTratativaLeque)
      .sort((x,y)=> codigoLequeCk(x.c).localeCompare(codigoLequeCk(y.c), undefined, { numeric:true }));
    const leques = cks.map(e=>{
      const fs = checklistFurosDoLeque(e.c.id);
      const obst = fs.filter(f=>f.obstruido).length, uteis = fs.filter(f=>!f.obstruido);
      const esp = uteis.reduce((s,f)=> s + Number(f.metragemEsperada || 0), 0), real = uteis.reduce((s,f)=> s + Number(f.metragem || 0), 0);
      const espMed = uteis.filter(f=>Number(f.metragem) > 0).reduce((s,f)=> s + Number(f.metragemEsperada || 0), 0); // esperada só dos furos já medidos (base justa p/ variação)
      const status = e.tratado ? 'Tratado' : e.pronto ? 'Pronto p/ tratar' : !e.tem ? 'Sem furos' : (fs.some(f=>f.perfilado || f.topografado) ? 'Em andamento' : 'Não iniciado');
      const furosLista = fs.map(f=>({ numero: String(f.numero), obst: !!f.obstruido, metros: Number(f.metragem) > 0 ? Number(f.metragem) : Number(f.metragemEsperada || 0) }));
      return { codigo: codigoLequeCk(e.c), furosLista, furos: fs.length, uteis: uteis.length, obst,
        perf: uteis.filter(f=>f.perfilado).length, topo: uteis.filter(f=>f.topografado).length, az: uteis.filter(f=>furoTemAzimute(f)).length,
        esp, real, espMed, status, tratadoEm: e.tratado ? e.c.tratadoEm : null, tratadoPor: e.tratado ? e.c.tratadoPor : '', observacao: e.c.observacao || '' };
    });
    const soma = k => leques.reduce((s,l)=> s + l[k], 0);
    return { realce: a, leques, tot: { leques: leques.length, furos: soma('furos'), uteis: soma('uteis'), obst: soma('obst'), perf: soma('perf'), topo: soma('topo'), az: soma('az'), esp: soma('esp'), real: soma('real'), espMed: soma('espMed'),
      tratados: leques.filter(l=>l.status === 'Tratado').length, prontos: leques.filter(l=>l.status === 'Pronto p/ tratar').length } };
  });
  const envios = (typeof tratativaEnvios !== 'undefined' ? tratativaEnvios : []).filter(e=> envioNoEscopo(e) && (!e.anelId || ids.has(e.anelId)))
    .sort((x,y)=> x.data.localeCompare(y.data));
  const tot = realces.reduce((t,r)=>{ Object.keys(r.tot).forEach(k=> t[k] = (t[k] || 0) + r.tot[k]); return t; }, {});
  return { realces, envios, tot, metrosEnviados: envios.reduce((s,e)=> s + e.metragem, 0) };
}

// Resumido: só os leques TRATADOS, com metros e data da tratativa.
function linhasTratados(anelIds){
  return dadosRelatorioTratativa(anelIds).realces.map(r=>({ realce: r.realce,
    leques: r.leques.filter(l=>l.status === 'Tratado').sort((x,y)=> String(x.tratadoEm).localeCompare(String(y.tratadoEm)) || x.codigo.localeCompare(y.codigo, undefined, { numeric:true })) }))
    .filter(r=>r.leques.length);
}
// Metros tratados = metragem real medida; se ainda não foi preenchida, usa a esperada.
const metrosDoLeque = l => l.real > 0 ? l.real : l.esp;


// Imagem dos leques tratados (um quadro por realce): cada leque é um cartão com código, metros e data.
function imagemTratadosCanvas(g){
  const W = 1000, M = 28, COLS = 4, GAP = 12, CW = Math.floor((W - 2*M - GAP*(COLS-1)) / COLS), CH = 78;
  const linhas = Math.ceil(g.leques.length / COLS), H = M + 62 + linhas * (CH + GAP) + 24;
  const esc = 2, cv = document.createElement('canvas'); cv.width = W * esc; cv.height = H * esc;
  const c = cv.getContext('2d'); c.scale(esc, esc);
  const F = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const rr = (x,y,w,h,r)=>{ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); };
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  const tot = g.leques.reduce((s,l)=> s + metrosDoLeque(l), 0);
  c.fillStyle = '#18202b'; c.font = `700 26px ${F}`; c.textBaseline = 'alphabetic'; c.fillText(g.realce.nome, M, M + 26);
  c.fillStyle = '#5b6878'; c.font = `500 16px ${F}`;
  c.fillText(`${g.leques.length} ${g.leques.length === 1 ? 'leque tratado' : 'leques tratados'} · ${fmtM(tot)} m${g.realce.nivel ? ' · ' + g.realce.nivel : ''}`, M, M + 52);
  g.leques.forEach((l,i)=>{
    const x = M + (i % COLS) * (CW + GAP), y = M + 66 + Math.floor(i / COLS) * (CH + GAP);
    rr(x, y, CW, CH, 12); c.fillStyle = '#e3f4f2'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#0f7d78'; c.stroke();
    c.fillStyle = '#0f7d78'; c.font = `700 14px ${F}`; c.fillText('✓', x + 12, y + 24);
    c.fillStyle = '#18202b'; c.font = `700 22px ${F}`; c.fillText(l.codigo, x + 32, y + 26);
    c.fillStyle = '#18202b'; c.font = `600 17px ${F}`; c.fillText(fmtM(metrosDoLeque(l)) + ' m', x + 12, y + 50);
    c.fillStyle = '#5b6878'; c.font = `500 14px ${F}`; c.fillText(fmtDataBR(l.tratadoEm), x + 12, y + 68);
  });
  return cv;
}

async function exportarRelatorioTratativaPDF(anelIds){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const grupos = linhasTratados(anelIds);
  if(!grupos.length){ showToast('Nenhum leque tratado nos realces escolhidos.', { tipo:'aviso' }); return; }
  const doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'RELATÓRIO DE LEQUES TRATADOS' });
  const todos = grupos.flatMap(g=>g.leques), totM = todos.reduce((s,l)=> s + metrosDoLeque(l), 0);
  doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text(`${todos.length} ${todos.length === 1 ? 'leque tratado' : 'leques tratados'}  ·  ${fmtM(totM)} m`, 15, y); y += 9;
  const cab = ()=>{ doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(10); doc.setFont(undefined,'bold');
    doc.text('Leque', 17, y); doc.text('Metros tratados', 120, y, { align:'right' }); doc.text('Data', 150, y); y += 6.5; };
  grupos.forEach(g=>{
    if(y > 262){ doc.addPage(); y = 20; }
    doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text(g.realce.nome, 15, y); y += 7; cab();
    doc.setFont(undefined,'normal'); doc.setFontSize(10);
    g.leques.forEach(l=>{
      if(y > 280){ doc.addPage(); y = 20; cab(); doc.setFont(undefined,'normal'); doc.setFontSize(10); }
      doc.text(l.codigo, 17, y); doc.text(fmtM(metrosDoLeque(l)), 120, y, { align:'right' }); doc.text(fmtDataBR(l.tratadoEm), 150, y); y += 5;
      if(l.furosLista.length){
        const txt = 'Furos: ' + l.furosLista.map(f=> `F${f.numero} ${f.obst ? 'obstruído' : fmtM(f.metros) + ' m'}`).join('  ·  ');
        const ls = doc.splitTextToSize(txt, 172); doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(100);
        if(y + ls.length * 3.6 > 284){ doc.addPage(); y = 20; }
        doc.text(ls, 21, y); y += ls.length * 3.6 + 2; doc.setTextColor(0); doc.setFontSize(10);
      } else y += 0.5; });
    doc.setDrawColor(150); doc.line(15, y - 3.8, 195, y - 3.8); doc.setFont(undefined,'bold');
    doc.text(`Total (${g.leques.length})`, 17, y); doc.text(fmtM(g.leques.reduce((s,l)=> s + metrosDoLeque(l), 0)), 120, y, { align:'right' }); y += 10;
  });
  // Anexo: imagem dos leques tratados, um quadro por realce.
  doc.addPage(); y = 20;
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text('Imagem dos leques tratados', 15, y); y += 6;
  for(const g of grupos){
    const cv = imagemTratadosCanvas(g); let w = 180, h = w * cv.height / cv.width;
    if(h > 255){ h = 255; w = h * cv.width / cv.height; }
    if(y + h > 285){ doc.addPage(); y = 20; }
    doc.addImage(cv.toDataURL('image/png'), 'PNG', 15, y, w, h); y += h + 6;
  }
  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);
  await baixarOuCompartilharPDF(doc, `leques_tratados_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`, true);
  showToast('Relatório em PDF gerado.', { tipo:'ok' });
}

async function exportarImagemTratados(anelIds){
  const grupos = linhasTratados(anelIds);
  if(!grupos.length){ showToast('Nenhum leque tratado nos realces escolhidos.', { tipo:'aviso' }); return; }
  const cvs = grupos.map(imagemTratadosCanvas), w = cvs[0].width, h = cvs.reduce((s,c)=> s + c.height, 0);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); let y = 0;
  cvs.forEach(c=>{ g.drawImage(c, 0, y); y += c.height; });
  const blob = await new Promise(r=> cv.toBlob(r, 'image/png'));
  const nome = `leques_tratados_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.png`;
  const arq = new File([blob], nome, { type:'image/png' });
  try{ if(navigator.canShare && navigator.canShare({ files:[arq] })){ await navigator.share({ files:[arq], title:nome }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1000);
  showToast('Imagem gerada.', { tipo:'ok' });
}

function exportarRelatorioTratativaCSV(anelIds){
  const grupos = linhasTratados(anelIds);
  if(!grupos.length){ showToast('Nenhum leque tratado nos realces escolhidos.', { tipo:'aviso' }); return; }
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const L = [['Realce','Leque','Furo','Metros','Data']];
  const nm = v => String(Math.round(Number(v || 0) * 10) / 10).replace('.', ',');
  grupos.forEach(g=> g.leques.forEach(l=>{
    l.furosLista.forEach(f=> L.push([g.realce.nome, l.codigo, 'F' + f.numero, f.obst ? 'obstruído' : nm(f.metros), fmtDataBR(l.tratadoEm)]));
    L.push([g.realce.nome, l.codigo, 'TOTAL DO LEQUE', nm(metrosDoLeque(l)), fmtDataBR(l.tratadoEm)]);
  }));
  const csv = '\ufeff' + L.map(r=> r.map(q).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `leques_tratados_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1000);
  showToast('Planilha gerada.', { tipo:'ok' });
}

// Janela para escolher quais realces entram e o formato.
function abrirExportarTratativa(){
  const { lista, fallback } = realcesDaTratativa();
  const noEscopo = (typeof aneisDoEscopo === 'function') ? aneisDoEscopo() : (configApp.projetoAtivo ? aneis.filter(a=>a.projeto === configApp.projetoAtivo) : aneis);
  const marcados = new Set(lista.map(a=>a.id));
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;">Exportar leques tratados</p>
    <div class="hint" style="margin-bottom:8px;">Lista os leques tratados de cada realce, com os furos, os metros e a data da tratativa.</div>
    <div class="rel-realces" role="group" aria-label="Realces do relatório">${noEscopo.map(a=>`<label class="rel-item"><input type="checkbox" value="${a.id}" ${marcados.has(a.id) ? 'checked' : ''}><span>${escHtml(a.nome)}</span></label>`).join('') || '<div class="hint">Nenhum realce.</div>'}</div>
    <div class="rel-atalhos"><button type="button" class="ghost" id="rel-todos">Marcar todos</button><button type="button" class="ghost" id="rel-nenhum">Limpar</button></div>
    <div class="modal-actions"><button class="ghost" id="modal-cancelar">Cancelar</button><button class="ghost" id="rel-csv">Planilha (CSV)</button><button class="ghost" id="rel-img">Só imagem</button><button class="steel" id="rel-pdf">Baixar PDF</button></div>
  </div></div>`;
  const ids = ()=> [...root.querySelectorAll('.rel-realces input:checked')].map(i=>i.value);
  const fechar = ()=>{ root.innerHTML = ''; };
  el('modal-cancelar').addEventListener('click', fechar);
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('rel-todos').addEventListener('click', ()=> root.querySelectorAll('.rel-realces input').forEach(i=> i.checked = true));
  el('rel-nenhum').addEventListener('click', ()=> root.querySelectorAll('.rel-realces input').forEach(i=> i.checked = false));
  const rodar = fn => async ()=>{ const sel = ids(); if(!sel.length){ showToast('Marque ao menos um realce.', { tipo:'aviso' }); return; } try{ await fn(sel); fechar(); }catch(e){ showToast('Não consegui gerar o relatório.', { tipo:'erro' }); } };
  el('rel-pdf').addEventListener('click', rodar(exportarRelatorioTratativaPDF));
  el('rel-img').addEventListener('click', rodar(exportarImagemTratados));
  el('rel-csv').addEventListener('click', rodar(async s=> exportarRelatorioTratativaCSV(s)));
}

// ---------- Fechamento mensal das tratativas (somatório do mês) ----------
// Reúne o que foi ENVIADO no mês (Envios da tratativa) e os leques TRATADOS no mês, com totais por realce.
function dadosFechamentoMensal(ym){
  const envios = tratativaEnvios.filter(e=> envioNoEscopo(e) && e.data.slice(0,7) === ym).sort((a,b)=> a.data.localeCompare(b.data));
  const porRealce = new Map();
  envios.forEach(e=>{ const k = e.anelRotulo || 'Sem realce'; const r = porRealce.get(k) || { realce:k, envios:0, metros:0 }; r.envios++; r.metros += e.metragem; porRealce.set(k, r); });
  const escopo = aneis.filter(a=> !configApp.projetoAtivo || !a.projeto || a.projeto === configApp.projetoAtivo).map(a=>a.id);
  const tratados = [];
  dadosRelatorioTratativa(escopo).realces.forEach(r=> r.leques.forEach(l=>{ if(l.status === 'Tratado' && l.tratadoEm && l.tratadoEm.slice(0,7) === ym) tratados.push({ realce:r.realce.nome, codigo:l.codigo, metros:metrosDoLeque(l), data:l.tratadoEm }); }));
  tratados.sort((a,b)=> String(a.data).localeCompare(String(b.data)) || a.realce.localeCompare(b.realce, undefined, { numeric:true }) || a.codigo.localeCompare(b.codigo, undefined, { numeric:true }));
  return { ym, envios, resumo:[...porRealce.values()], tratados,
    metrosEnviados: envios.reduce((s,e)=> s + e.metragem, 0), metrosTratados: tratados.reduce((s,l)=> s + l.metros, 0) };
}

async function exportarFechamentoMensalPDF(ym){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const d = dadosFechamentoMensal(ym), doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'FECHAMENTO MENSAL DAS TRATATIVAS' });
  const garante = h => { if(y + h > 282){ doc.addPage(); y = 20; } };
  const titulo = t => { garante(14); doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text(t, 15, y); y += 7; doc.setFont(undefined,'normal'); doc.setFontSize(9); };
  doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(rotuloMesEnvio(ym), 15, y); y += 8;
  doc.setFontSize(10); doc.setFont(undefined,'normal');
  doc.text(`Metragem enviada: ${fmtM(d.metrosEnviados)} m em ${d.envios.length} ${d.envios.length === 1 ? 'envio' : 'envios'}`, 15, y); y += 6;
  doc.text(`Leques tratados no mês: ${d.tratados.length}  ·  ${fmtM(d.metrosTratados)} m`, 15, y); y += 10;

  if(d.resumo.length){
    titulo('Total por realce (envios)');
    doc.setFont(undefined,'bold'); doc.text('Realce', 17, y); doc.text('Envios', 130, y, { align:'right' }); doc.text('Metros', 175, y, { align:'right' }); y += 5.5; doc.setFont(undefined,'normal');
    d.resumo.forEach(r=>{ garante(6); doc.text(r.realce, 17, y, { maxWidth:90 }); doc.text(String(r.envios), 130, y, { align:'right' }); doc.text(fmtM(r.metros), 175, y, { align:'right' }); y += 5.5; });
    doc.setDrawColor(150); doc.line(15, y - 3.8, 195, y - 3.8); doc.setFont(undefined,'bold');
    doc.text('Total', 17, y); doc.text(String(d.envios.length), 130, y, { align:'right' }); doc.text(fmtM(d.metrosEnviados), 175, y, { align:'right' }); doc.setFont(undefined,'normal'); y += 10;
  }
  titulo('Envios do mês');
  if(!d.envios.length){ doc.text('Nenhum envio registrado neste mês.', 17, y); y += 8; }
  else d.envios.forEach(e=>{
    const ls = doc.splitTextToSize(`${fmtDiaEnvio(e.data)}   ${e.anelRotulo || 'Sem realce'}${e.leques ? '  ·  ' + e.leques : ''}${e.observacao ? '  ·  ' + e.observacao : ''}`, 140);
    garante(ls.length * 4.6 + 2); doc.text(ls, 17, y); doc.text(fmtM(e.metragem) + ' m', 195, y, { align:'right' }); y += ls.length * 4.6 + 1.5; });
  y += 6;
  titulo('Leques tratados no mês');
  if(!d.tratados.length){ doc.text('Nenhum leque marcado como tratado neste mês.', 17, y); y += 8; }
  else{
    doc.setFont(undefined,'bold'); doc.text('Data', 17, y); doc.text('Realce', 38, y); doc.text('Leque', 120, y); doc.text('Metros', 195, y, { align:'right' }); y += 5.5; doc.setFont(undefined,'normal');
    d.tratados.forEach(l=>{ garante(6); doc.text(fmtDataBR(l.data), 17, y); doc.text(l.realce, 38, y, { maxWidth:78 }); doc.text(l.codigo, 120, y); doc.text(fmtM(l.metros), 195, y, { align:'right' }); y += 5.5; });
    doc.setDrawColor(150); doc.line(15, y - 3.8, 195, y - 3.8); doc.setFont(undefined,'bold');
    doc.text(`Total (${d.tratados.length} leques)`, 17, y); doc.text(fmtM(d.metrosTratados), 195, y, { align:'right' });
  }
  adicionarMarcaDaguaPDF(doc); adicionarNumeracaoPaginas(doc);
  await baixarOuCompartilharPDF(doc, `tratativas_${ym}.pdf`, true);
  showToast('Fechamento mensal gerado.', { tipo:'ok' });
}

function exportarFechamentoMensalCSV(ym){
  const d = dadosFechamentoMensal(ym), n = v => String(Math.round(Number(v || 0) * 10) / 10).replace('.', ','), q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const L = [[`FECHAMENTO MENSAL — ${rotuloMesEnvio(ym)}`], [], ['ENVIOS'], ['Data','Realce','Leques','Metragem (m)','Observação']];
  d.envios.forEach(e=> L.push([e.data.slice(8,10) + '/' + e.data.slice(5,7) + '/' + e.data.slice(0,4), e.anelRotulo, e.leques, n(e.metragem), e.observacao]));
  L.push(['Total enviado','','',n(d.metrosEnviados)], [], ['LEQUES TRATADOS NO MÊS'], ['Data','Realce','Leque','Metros']);
  d.tratados.forEach(l=> L.push([fmtDataBR(l.data), l.realce, l.codigo, n(l.metros)]));
  L.push(['Total tratado','','',n(d.metrosTratados)]);
  const url = URL.createObjectURL(new Blob(['﻿' + L.map(r=> r.map(q).join(';')).join('\r\n')], { type:'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `tratativas_${ym}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1000);
  showToast('Planilha gerada.', { tipo:'ok' });
}

function abrirExportarMes(ym){
  const d = dadosFechamentoMensal(ym), root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;margin:0 0 6px;">Exportar ${escHtml(rotuloMesEnvio(ym))}</p>
    <div class="hint" style="margin-bottom:12px;">${fmtM(d.metrosEnviados)} m enviados em ${d.envios.length} ${d.envios.length === 1 ? 'envio' : 'envios'} · ${d.tratados.length} ${d.tratados.length === 1 ? 'leque tratado' : 'leques tratados'} (${fmtM(d.metrosTratados)} m). Traz o total por realce, a lista de envios e os leques tratados no mês.</div>
    <div class="modal-actions"><button class="ghost" id="mes-cancelar">Cancelar</button><button class="ghost" id="mes-csv">Planilha (CSV)</button><button class="steel" id="mes-pdf">Baixar PDF</button></div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('mes-cancelar').onclick = fechar; el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('mes-pdf').onclick = async ()=>{ try{ await exportarFechamentoMensalPDF(ym); fechar(); }catch(e){ showToast('Não consegui gerar o PDF.', { tipo:'erro' }); } };
  el('mes-csv').onclick = ()=>{ exportarFechamentoMensalCSV(ym); fechar(); };
}
