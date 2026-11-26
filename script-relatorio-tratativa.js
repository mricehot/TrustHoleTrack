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
      return { codigo: codigoLequeCk(e.c), furos: fs.length, uteis: uteis.length, obst,
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

async function exportarRelatorioTratativaPDF(anelIds){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const d = dadosRelatorioTratativa(anelIds);
  const doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'RELATÓRIO DE TRATATIVA DE DADOS' });
  const nova = ()=>{ doc.addPage(); y = 20; };
  const garante = h => { if(y + h > 280) nova(); };

  // Resumo geral
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text('Resumo geral', 15, y); y += 7;
  doc.setFontSize(10); doc.setFont(undefined,'normal');
  const t = d.tot, pct = (v, n)=> n ? Math.round(v / n * 100) + '%' : '-';
  [
    `Realces: ${d.realces.length}   ·   Leques: ${t.leques || 0}   ·   Furos: ${t.furos || 0} (${t.obst || 0} obstruídos)`,
    `Perfilados: ${t.perf || 0}/${t.uteis || 0} (${pct(t.perf, t.uteis)})   ·   Topografados: ${t.topo || 0}/${t.uteis || 0} (${pct(t.topo, t.uteis)})   ·   Azimutados: ${t.az || 0}/${t.uteis || 0} (${pct(t.az, t.uteis)})`,
    `Leques tratados: ${t.tratados || 0}/${t.leques || 0}   ·   Prontos para tratar: ${t.prontos || 0}`,
    `Metragem esperada: ${fmtM(t.esp)} m   ·   Metragem real (medida): ${fmtM(t.real)} m   ·   Variação nos furos medidos: ${fmtM((t.real || 0) - (t.espMed || 0))} m`,
    `Metragem enviada (tratativas): ${fmtM(d.metrosEnviados)} m em ${d.envios.length} ${d.envios.length === 1 ? 'envio' : 'envios'}`
  ].forEach(l=>{ doc.text(l, 15, y, { maxWidth:180 }); y += 6; });
  y += 4;

  // Tabela por realce
  const COLS = [['Leque',22,'l'],['Furos',13,'r'],['Perf.',15,'r'],['Topo',15,'r'],['Azim.',15,'r'],['Obst.',13,'r'],['Esp. (m)',20,'r'],['Real (m)',20,'r'],['Situação',47,'l']];
  const linha = (cel, negrito)=>{ doc.setFont(undefined, negrito ? 'bold' : 'normal'); let x = 15;
    COLS.forEach(([,w,al],i)=>{ const txt = String(cel[i] ?? ''); doc.text(txt, al === 'r' ? x + w - 2 : x + 1, y, { align: al === 'r' ? 'right' : 'left', maxWidth: w - 2 }); x += w; }); y += 5.5; };
  const cabTabela = ()=>{ doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(9); linha(COLS.map(c=>c[0]), true); doc.setFontSize(9); };
  d.realces.forEach(r=>{
    garante(30);
    doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text(r.realce.nome, 15, y);
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(110);
    doc.text([r.realce.nivel, r.realce.orientacao === 'ascendente' ? 'Ascendente' : 'Descendente', r.realce.projeto].filter(Boolean).join(' · '), 15, y + 5); doc.setTextColor(0); y += 11;
    if(!r.leques.length){ doc.setFontSize(9); doc.text('Sem leques no checklist.', 15, y); y += 8; return; }
    cabTabela();
    r.leques.forEach(l=>{
      if(y > 278){ nova(); cabTabela(); }
      const sit = l.status === 'Tratado' ? `Tratado ${fmtDataBR(l.tratadoEm)}${l.tratadoPor ? ' · ' + l.tratadoPor.split(' ')[0] : ''}` : l.status;
      linha([l.codigo, l.furos, `${l.perf}/${l.uteis}`, `${l.topo}/${l.uteis}`, `${l.az}/${l.uteis}`, l.obst || '', l.esp ? fmtM(l.esp) : '-', l.real ? fmtM(l.real) : '-', sit]);
      if(l.observacao){ doc.setFontSize(8); doc.setTextColor(110); doc.text('Obs.: ' + l.observacao, 17, y - 1.2, { maxWidth:176 }); doc.setTextColor(0); doc.setFontSize(9); y += 3.5; }
    });
    const T = r.tot; doc.setDrawColor(150); doc.line(15, y - 3.8, 195, y - 3.8);
    linha(['Total', T.furos, `${T.perf}/${T.uteis}`, `${T.topo}/${T.uteis}`, `${T.az}/${T.uteis}`, T.obst || '', fmtM(T.esp), fmtM(T.real), `${T.tratados} tratados`], true);
    y += 6;
  });

  // Envios por mês
  garante(30);
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text('Envios das tratativas', 15, y); y += 7;
  if(!d.envios.length){ doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.text('Nenhum envio registrado.', 15, y); y += 8; }
  else{
    const porMes = {}; d.envios.forEach(e=> (porMes[e.data.slice(0,7)] = porMes[e.data.slice(0,7)] || []).push(e));
    Object.keys(porMes).sort().forEach(ym=>{
      const es = porMes[ym]; garante(20);
      doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.text(`${rotuloMesEnvio(ym)} ${ym.slice(0,4)} — ${fmtM(es.reduce((s,e)=>s+e.metragem,0))} m (${es.length} ${es.length === 1 ? 'envio' : 'envios'})`, 15, y); y += 5.5;
      doc.setFont(undefined,'normal'); doc.setFontSize(9);
      es.forEach(e=>{ const txt = `${fmtDiaEnvio(e.data)}  ·  ${fmtM(e.metragem)} m  ·  ${e.anelRotulo || '-'}${e.leques ? '  ·  ' + e.leques : ''}${e.observacao ? '  ·  ' + e.observacao : ''}`;
        const ls = doc.splitTextToSize(txt, 176); garante(ls.length * 4.5 + 2); doc.text(ls, 19, y); y += ls.length * 4.5 + 1; });
      y += 3;
    });
  }
  adicionarNumeracaoPaginas(doc);
  const nome = `tratativas_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
  await baixarOuCompartilharPDF(doc, nome, true);
  showToast('Relatório em PDF gerado.', { tipo:'ok' });
}

function exportarRelatorioTratativaCSV(anelIds){
  const d = dadosRelatorioTratativa(anelIds);
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const n = v => String(Math.round(Number(v || 0) * 10) / 10).replace('.', ',');
  const L = [['Realce','Projeto','Nível','Leque','Furos','Obstruídos','Perfilados','Topografados','Azimutados','Esperada (m)','Real (m)','Variação (m)','Situação','Tratado em','Tratado por','Observação']];
  d.realces.forEach(r=> r.leques.forEach(l=> L.push([r.realce.nome, r.realce.projeto || '', r.realce.nivel || '', l.codigo, l.furos, l.obst, `${l.perf}/${l.uteis}`, `${l.topo}/${l.uteis}`, `${l.az}/${l.uteis}`, n(l.esp), n(l.real), n(l.real ? l.real - l.espMed : 0), l.status, fmtDataBR(l.tratadoEm), l.tratadoPor, l.observacao])));
  L.push([]); L.push(['ENVIOS DAS TRATATIVAS']); L.push(['Data','Realce','Metragem (m)','Leques','Observação']);
  d.envios.forEach(e=> L.push([e.data.slice(8,10) + '/' + e.data.slice(5,7) + '/' + e.data.slice(0,4), e.anelRotulo, n(e.metragem), e.leques, e.observacao]));
  L.push(['Total enviado','', n(d.metrosEnviados)]);
  const csv = '﻿' + L.map(r=> r.map(q).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `tratativas_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
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
    <p style="font-weight:700;">Exportar relatório das tratativas</p>
    <div class="hint" style="margin-bottom:8px;">Inclui, por realce e leque: furos, perfilados, topografados, azimutados, obstruídos, metragem esperada e real, situação (tratado em / por quem) e os envios.</div>
    <div class="rel-realces" role="group" aria-label="Realces do relatório">${noEscopo.map(a=>`<label class="rel-item"><input type="checkbox" value="${a.id}" ${marcados.has(a.id) ? 'checked' : ''}><span>${escHtml(a.nome)}</span></label>`).join('') || '<div class="hint">Nenhum realce.</div>'}</div>
    <div class="rel-atalhos"><button type="button" class="ghost" id="rel-todos">Marcar todos</button><button type="button" class="ghost" id="rel-nenhum">Limpar</button></div>
    <div class="modal-actions"><button class="ghost" id="modal-cancelar">Cancelar</button><button class="ghost" id="rel-csv">Planilha (CSV)</button><button class="steel" id="rel-pdf">Baixar PDF</button></div>
  </div></div>`;
  const ids = ()=> [...root.querySelectorAll('.rel-realces input:checked')].map(i=>i.value);
  const fechar = ()=>{ root.innerHTML = ''; };
  el('modal-cancelar').addEventListener('click', fechar);
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('rel-todos').addEventListener('click', ()=> root.querySelectorAll('.rel-realces input').forEach(i=> i.checked = true));
  el('rel-nenhum').addEventListener('click', ()=> root.querySelectorAll('.rel-realces input').forEach(i=> i.checked = false));
  const rodar = fn => async ()=>{ const sel = ids(); if(!sel.length){ showToast('Marque ao menos um realce.', { tipo:'aviso' }); return; } try{ await fn(sel); fechar(); }catch(e){ showToast('Não consegui gerar o relatório.', { tipo:'erro' }); } };
  el('rel-pdf').addEventListener('click', rodar(exportarRelatorioTratativaPDF));
  el('rel-csv').addEventListener('click', rodar(async s=> exportarRelatorioTratativaCSV(s)));
}
