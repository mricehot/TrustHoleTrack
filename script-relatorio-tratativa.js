// ---------- Relatório dos tratamentos: realces, leques, furos, metragens e envios (PDF ou planilha CSV) ----------
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
      const furosLista = fs.slice().sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, { numeric:true })).map(f=>({ numero: String(f.numero), obst: !!f.obstruido, metros: Number(f.metragem) > 0 ? Number(f.metragem) : Number(f.metragemEsperada || 0),
        plan: Number(f.metragemEsperada || 0), exec: Number(f.metragem) > 0 ? Number(f.metragem) : null, desvio: f.desvioCm != null && f.desvioCm !== '' ? Number(f.desvioCm) : null,
        obs: typeof r2dObsAuto === 'function' ? r2dObsAuto(f) : (f.obsTratamento || (f.obstruido ? 'Obstruído' : '')) }));
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

// Resumido: só os leques TRATADOS, com metros e data do tratamento.
function linhasTratados(anelIds){
  return dadosRelatorioTratativa(anelIds).realces.map(r=>({ realce: r.realce,
    leques: r.leques.filter(l=>l.status === 'Tratado').sort((x,y)=> String(x.tratadoEm).localeCompare(String(y.tratadoEm)) || x.codigo.localeCompare(y.codigo, undefined, { numeric:true })) }))
    .filter(r=>r.leques.length);
}
// Metros tratados = metragem real medida; se ainda não foi preenchida, usa a esperada.
const metrosDoLeque = l => l.real > 0 ? l.real : l.esp;


// Imagem dos leques tratados (um quadro por realce): cada leque é um cartão com código, metros e data.
function imagemTratadosCanvas(g){
  const W = 720, M = 24, COLS = 3, GAP = 12, CW = Math.floor((W - 2*M - GAP*(COLS-1)) / COLS), CH = 78;
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
    rr(x, y, CW, CH, 12); c.fillStyle = '#f3f3f3'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#333333'; c.stroke();
    c.fillStyle = '#222'; c.font = `700 14px ${F}`; c.fillText('✓', x + 12, y + 24);
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
  const doc = new window.jspdf.jsPDF(), PROJ = configApp.projetoAtivo || '';
  const hoje = new Date().toLocaleDateString('pt-BR'), quem = (typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '') || '';
  const todos = grupos.flatMap(g=>g.leques);
  const soma = (k, f)=> todos.reduce((t,l)=> t + (f ? f(l) : l[k]), 0);
  const plan = soma('esp'), exec = soma('real'), difT = soma(null, l=> l.real > 0 ? l.real - l.espMed : 0), nFuros = soma('uteis');
  const datas = todos.map(l=>l.tratadoEm).filter(Boolean).sort(), periodo = datas.length ? (fmtDataBR(datas[0]) === fmtDataBR(datas[datas.length-1]) ? fmtDataBR(datas[0]) : fmtDataBR(datas[0]) + ' a ' + fmtDataBR(datas[datas.length-1])) : '—';
  const sinal = n => (n > 0.049 ? '+' : n < -0.049 ? '-' : '') + fmtM(Math.abs(n));
  const PRETO = 20, CINZA = [235,235,235], CINZA2 = [217,217,217];
  let y = 0, parcial = false;
  const linhaH = (yy)=>{ doc.setDrawColor(0); doc.setLineWidth(0.35); doc.line(15, yy, 195, yy); doc.setLineWidth(0.2); };
  // Cabeçalho oficial
  try{ doc.addImage('data:image/png;base64,'+R2D_LOGO_B64, 'PNG', 15, 11, 54, 54 * 216 / 943); }catch(e){}
  doc.setTextColor(PRETO); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('RELATÓRIO DE TRATAMENTO DE DADOS', 195, 17, { align:'right' });
  doc.setFontSize(10.5); doc.setFont('helvetica','normal'); doc.text('Leques tratados — perfilagem de furos de lavra', 195, 23, { align:'right' });
  doc.setFontSize(9); doc.setTextColor(90); doc.text('Emitido em ' + hoje, 195, 28.5, { align:'right' }); doc.setTextColor(PRETO);
  linhaH(33); y = 40;
  const tituloSecao = t=>{ if(y > 262){ doc.addPage(); y = 20; } doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.text(t, 15, y); y += 2; doc.setLineWidth(0.2); doc.setDrawColor(120); doc.line(15, y, 195, y); y += 6; };
  // 1. Identificação
  tituloSecao('1. IDENTIFICAÇÃO');
  const ident = [['Projeto', PROJ || '—', 'Período dos tratamentos', periodo], ['Realce(s)', grupos.map(g=>g.realce.nome).join(', '), 'Elaborado por', quem || '—']];
  doc.setFontSize(9);
  ident.forEach(r=>{ const rh = Math.max(7, doc.splitTextToSize(r[1], 51).length * 4 + 3);
    doc.setFillColor(...CINZA); doc.rect(15, y, 28, rh, 'F'); doc.rect(98, y, 40, rh, 'F');
    doc.setDrawColor(120); doc.rect(15, y, 180, rh); [43, 98, 138].forEach(x=> doc.line(x, y, x, y + rh));
    doc.setFont('helvetica','bold'); doc.text(r[0], 17, y + 4.6); doc.text(r[2], 100, y + 4.6);
    doc.setFont('helvetica','normal'); doc.text(doc.splitTextToSize(r[1], 51), 45, y + 4.6); doc.text(doc.splitTextToSize(r[3], 53), 140, y + 4.6); y += rh; });
  y += 6;
  // 2. Resumo
  tituloSecao('2. RESUMO GERAL');
  const colR = [['Leques tratados', String(todos.length)], ['Furos considerados', String(nFuros)], ['Planejado (m)', fmtM(plan)], ['Executado (m)', fmtM(exec)], ['Diferença (m)', sinal(difT)]], wR = 180 / colR.length;
  doc.setDrawColor(120); doc.setFontSize(8.5);
  colR.forEach(([r, v], k)=>{ const x = 15 + k * wR; doc.setFillColor(...CINZA); doc.rect(x, y, wR, 6, 'FD'); doc.rect(x, y + 6, wR, 8, 'D');
    doc.setFont('helvetica','bold'); doc.text(r, x + wR / 2, y + 4.1, { align:'center' }); doc.setFontSize(11); doc.text(v, x + wR / 2, y + 12, { align:'center' }); doc.setFontSize(8.5); });
  y += 20;
  // 3. Detalhamento por realce (uma linha por leque)
  tituloSecao('3. LEQUES TRATADOS');
  const X = [15, 37, 55, 68, 92, 116, 136, 158, 195];  // limites das colunas
  const cab = ()=>{ doc.setFillColor(...CINZA2); doc.setDrawColor(0); doc.rect(15, y, 180, 8, 'FD'); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
    [['LEQUE',0,'l'], ['DATA',1,'l'], ['FUROS',2,'r'], ['PLAN. (m)',3,'r'], ['EXEC. (m)',4,'r'], ['DIF. (m)',5,'r'], ['DESV. (cm)',6,'r'], ['OBSERVAÇÃO',7,'l']].forEach(([t, c, al])=>{
      if(c) doc.line(X[c], y, X[c], y + 8); if(al === 'r') doc.text(t, X[c + 1] - 2, y + 5.2, { align:'right' }); else doc.text(t, X[c] + 2, y + 5.2); }); y += 8; doc.setFont('helvetica','normal'); doc.setFontSize(8.5); };
  const linha = (cel, opc)=>{ opc = opc || {}; const rh = opc.h || 5.6;
    if(y + rh > 281){ doc.addPage(); y = 20; cab(); }
    if(opc.fill){ doc.setFillColor(...opc.fill); doc.rect(15, y, 180, rh, 'F'); }
    doc.setDrawColor(150); doc.rect(15, y, 180, rh); for(let c = 1; c < 8; c++) if(!(opc.junta && c < opc.junta)) doc.line(X[c], y, X[c], y + rh);
    doc.setFont('helvetica', opc.bold ? 'bold' : 'normal'); doc.setFontSize(8.5);
    cel.forEach((t, c)=>{ if(t === '' || t == null) return; const dir = c >= 2 && c <= 6;
      if(dir) doc.text(String(t), X[c + 1] - 2, y + rh - 1.8, { align:'right' });
      else { if(c === 0 && !opc.bold) doc.setFont('helvetica','bold'); const txt = opc.junta && c === 0 ? String(t) : doc.splitTextToSize(String(t), X[c + 1] - X[c] - 3)[0]; doc.text(txt, X[c] + 2, y + rh - 1.8); if(c === 0 && !opc.bold) doc.setFont('helvetica','normal'); } });
    y += rh; };
  const realces = dadosRelatorioTratativa(anelIds).realces;
  grupos.forEach((g, gi)=>{
    const meta = [g.realce.nivel, g.realce.orientacao === 'ascendente' ? 'Ascendente' : g.realce.orientacao === 'descendente' ? 'Descendente' : ''].filter(Boolean).join(' · ');
    if(y > 250){ doc.addPage(); y = 20; }
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(PRETO); doc.text(`Realce ${g.realce.nome}${meta ? '  —  ' + meta : ''}`, 15, y); y += 3.5; cab();
    g.leques.forEach(l=>{
      const part = l.real > 0 && l.espMed < l.esp - 0.049; if(part) parcial = true;
      const desv = l.furosLista.filter(f=>f.desvio != null).map(f=> Math.abs(f.desvio)), obsCont = {};
      l.furosLista.forEach(f=>{ if(f.obs) obsCont[f.obs] = (obsCont[f.obs] || 0) + 1; });
      const obsTxt = Object.entries(obsCont).map(([k, n])=> `${n} ${k.toLowerCase()}`).join(' · ');
      linha([l.codigo, fmtDataBR(l.tratadoEm), String(l.uteis), fmtM(l.esp), l.real > 0 ? fmtM(l.real) : '—', l.real > 0 ? sinal(l.real - l.espMed) + (part ? '*' : '') : '—', desv.length ? fmtM(Math.max(...desv)) : '—', obsTxt]);
    });
    const tp = g.leques.reduce((t,l)=> t + l.esp, 0), te = g.leques.reduce((t,l)=> t + l.real, 0), td = g.leques.reduce((t,l)=> t + (l.real > 0 ? l.real - l.espMed : 0), 0), tf = g.leques.reduce((t,l)=> t + l.uteis, 0);
    linha([`Total (${g.leques.length} ${g.leques.length === 1 ? 'leque' : 'leques'})`, '', String(tf), fmtM(tp), fmtM(te), sinal(td), '', ''], { bold:true, fill: CINZA2, junta: 2, h: 6 });
    y += 6;
  });
  // Nota e assinatura
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(80);
  const nota = doc.splitTextToSize('Diferença = executado - planejado (positivo: furo mais longo que o previsto). Furos obstruídos ou detonados não entram nos totais.' + (parcial ? ' * Calculada só sobre os furos já medidos do leque.' : ''), 180);
  if(y + nota.length * 3.4 + 22 > 284){ doc.addPage(); y = 20; }
  doc.text(nota, 15, y); y += nota.length * 3.4 + 12; doc.setTextColor(PRETO);
  doc.setDrawColor(0); doc.line(15, y, 85, y); doc.setFontSize(8.5); doc.setFont('helvetica','bold'); if(quem){ doc.text(quem, 15, y + 4.5); } doc.setFont('helvetica','normal'); doc.setTextColor(90); doc.text('Elaborado por  ·  ' + hoje, 15, y + (quem ? 8.5 : 4.5)); doc.setTextColor(PRETO);
  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);
  // rodapé de identificação em todas as páginas
  const np = doc.getNumberOfPages();
  for(let p = 1; p <= np; p++){ doc.setPage(p); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(110); doc.setDrawColor(180); doc.line(15, 289, 195, 289); doc.text('Relatório de Tratamento de Dados — Leques tratados' + (PROJ ? '  ·  ' + PROJ : '') + '  ·  Emitido em ' + hoje, 15, 293.5); doc.setTextColor(0); }
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
  const noEscopo = aneis; // todos os realces, de qualquer projeto
  const marcados = new Set(lista.map(a=>a.id));
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;">Exportar leques tratados</p>
    <div class="hint" style="margin-bottom:8px;">Lista os leques tratados de cada realce, com os furos, os metros e a data do tratamento.</div>
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

// ---------- Fechamento mensal dos tratamentos (somatório do mês) ----------
// Reúne o que foi ENVIADO no mês (Envios do tratamento) e os leques TRATADOS no mês, com totais por realce.
function dadosFechamentoMensal(ym){
  const envios = tratativaEnvios.filter(e=> envioNoEscopo(e) && e.data.slice(0,7) === ym).sort((a,b)=> a.data.localeCompare(b.data));
  const porRealce = new Map();
  envios.forEach(e=>{ const k = e.anelRotulo || 'Sem realce'; const r = porRealce.get(k) || { realce:k, envios:0, metros:0 }; r.envios++; r.metros += e.metragem; porRealce.set(k, r); });
  const escopo = aneis.map(a=>a.id); // todos os projetos
  const tratados = [];
  dadosRelatorioTratativa(escopo).realces.forEach(r=> r.leques.forEach(l=>{ if(l.status === 'Tratado' && l.tratadoEm && l.tratadoEm.slice(0,7) === ym) tratados.push({ realce:r.realce.nome, codigo:l.codigo, metros:metrosDoLeque(l), data:l.tratadoEm }); }));
  tratados.sort((a,b)=> String(a.data).localeCompare(String(b.data)) || a.realce.localeCompare(b.realce, undefined, { numeric:true }) || a.codigo.localeCompare(b.codigo, undefined, { numeric:true }));
  return { ym, envios, resumo:[...porRealce.values()], tratados,
    metrosEnviados: envios.reduce((s,e)=> s + e.metragem, 0), metrosTratados: tratados.reduce((s,l)=> s + l.metros, 0) };
}

async function exportarFechamentoMensalPDF(ym){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const d = dadosFechamentoMensal(ym), doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'FECHAMENTO MENSAL DOS TRATAMENTOS' });
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
  await baixarOuCompartilharPDF(doc, `tratamentos_${ym}.pdf`, true);
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
  const a = document.createElement('a'); a.href = url; a.download = `tratamentos_${ym}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1000);
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
