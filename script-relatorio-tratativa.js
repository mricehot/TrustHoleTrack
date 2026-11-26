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

// Resumido: só os leques TRATADOS, com metros e data da tratativa.
function linhasTratados(anelIds){
  return dadosRelatorioTratativa(anelIds).realces.map(r=>({ realce: r.realce,
    leques: r.leques.filter(l=>l.status === 'Tratado').sort((x,y)=> String(x.tratadoEm).localeCompare(String(y.tratadoEm)) || x.codigo.localeCompare(y.codigo, undefined, { numeric:true })) }))
    .filter(r=>r.leques.length);
}
// Metros tratados = metragem real medida; se ainda não foi preenchida, usa a esperada.
const metrosDoLeque = l => l.real > 0 ? l.real : l.esp;

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
      doc.text(l.codigo, 17, y); doc.text(fmtM(metrosDoLeque(l)), 120, y, { align:'right' }); doc.text(fmtDataBR(l.tratadoEm), 150, y); y += 5.5; });
    doc.setDrawColor(150); doc.line(15, y - 3.8, 195, y - 3.8); doc.setFont(undefined,'bold');
    doc.text(`Total (${g.leques.length})`, 17, y); doc.text(fmtM(g.leques.reduce((s,l)=> s + metrosDoLeque(l), 0)), 120, y, { align:'right' }); y += 10;
  });
  adicionarNumeracaoPaginas(doc);
  await baixarOuCompartilharPDF(doc, `leques_tratados_${(configApp.projetoAtivo || 'todos').replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`, true);
  showToast('Relatório em PDF gerado.', { tipo:'ok' });
}

function exportarRelatorioTratativaCSV(anelIds){
  const grupos = linhasTratados(anelIds);
  if(!grupos.length){ showToast('Nenhum leque tratado nos realces escolhidos.', { tipo:'aviso' }); return; }
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const L = [['Realce','Leque','Metros tratados','Data']];
  grupos.forEach(g=> g.leques.forEach(l=> L.push([g.realce.nome, l.codigo, String(Math.round(metrosDoLeque(l) * 10) / 10).replace('.', ','), fmtDataBR(l.tratadoEm)])));
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
    <div class="hint" style="margin-bottom:8px;">Lista os leques tratados de cada realce, com os metros e a data da tratativa.</div>
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
