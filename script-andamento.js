// ---------- Andamento do realce: resumo para prestar conta à equipe (PDF, texto/WhatsApp) ----------
function dadosAndamentoRealce(anelId){
  const a = aneis.find(x=>x.id === anelId); if(!a) return null;
  const r = dadosRelatorioTratativa([anelId]).realces[0]; if(!r) return null;
  const L = r.leques, n = L.length, cont = s => L.filter(l=>l.status === s).length;
  const completos = k => L.filter(l=> l.uteis > 0 && l[k] >= l.uteis).length;
  const metrosTratados = L.filter(l=>l.status === 'Tratado').reduce((s,l)=> s + metrosDoLeque(l), 0);
  return { a, L, n, tot: r.tot, metrosTratados,
    status: { tratado: cont('Tratado'), pronto: cont('Pronto p/ tratar'), andamento: cont('Em andamento'), novo: cont('Não iniciado') + cont('Sem furos') },
    etapas: [['Perfilagem', completos('perf'), '#1f8a4c'], ['Topografia', completos('topo'), '#1f63b0'], ['Azimute', completos('az'), '#8a5cc2'], ['Tratado', cont('Tratado'), '#0f7d78']],
    faltaAz: L.filter(l=> l.uteis > 0 && l.az < l.uteis && l.perf >= l.uteis && l.topo >= l.uteis).map(l=>l.codigo) };
}
const pctAnd = (v, n) => n ? Math.round(v / n * 100) : 0;

function textoAndamentoRealce(anelId){
  const d = dadosAndamentoRealce(anelId); if(!d) return '';
  const hoje = new Date().toLocaleDateString('pt-BR');
  const l = [`*Andamento do realce ${d.a.nome}*${d.a.projeto ? ' (' + d.a.projeto + ')' : ''}`, hoje, ''];
  l.push(`Leques: ${d.n} · Tratados ${d.status.tratado} (${pctAnd(d.status.tratado, d.n)}%)`);
  d.etapas.forEach(([rot, v])=> l.push(`• ${rot}: ${v}/${d.n} leques (${pctAnd(v, d.n)}%)`));
  l.push('', `Furos úteis: perfilados ${d.tot.perf}/${d.tot.uteis} · topografados ${d.tot.topo}/${d.tot.uteis} · azimutados ${d.tot.az}/${d.tot.uteis}`);
  l.push(`Metros tratados: ${fmtM(d.metrosTratados)} m`);
  if(d.status.pronto) l.push(`Prontos para tratar: ${d.status.pronto}${d.faltaAz.length ? ' · falta azimute em ' + d.faltaAz.join(', ') : ''}`);
  l.push(`Arquivos do realce: ${d.a.arquivosOk ? 'recebidos' : 'ainda não recebidos'}`);
  return l.join('\n');
}

async function exportarAndamentoRealcePDF(anelId){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const d = dadosAndamentoRealce(anelId); if(!d) return;
  const doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'ANDAMENTO DO REALCE' });
  doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(d.a.nome, 15, y); y += 6;
  doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(90);
  const sub = [d.a.projeto, d.a.nivel, d.a.orientacao === 'ascendente' ? 'Ascendente' : d.a.orientacao === 'descendente' ? 'Descendente' : ''].filter(Boolean).join(' · ');
  if(sub){ doc.text(sub, 15, y); y += 5; }
  doc.text(`Posição em ${new Date().toLocaleDateString('pt-BR')}  ·  Arquivos do realce: ${d.a.arquivosOk ? 'recebidos' : 'ainda não recebidos'}`, 15, y); doc.setTextColor(0); y += 9;
  // Resumo
  doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text(`${d.status.tratado} de ${d.n} leques tratados (${pctAnd(d.status.tratado, d.n)}%)  ·  ${fmtM(d.metrosTratados)} m tratados`, 15, y); y += 7;
  // Barras por etapa
  doc.setFontSize(10);
  d.etapas.forEach(([rot, v, cor])=>{
    const rgb = [1,3,5].map(i=> parseInt(cor.slice(i, i + 2), 16));
    doc.setFont(undefined,'bold'); doc.setTextColor(0); doc.text(rot, 15, y);
    doc.setFillColor(232,232,238); doc.roundedRect(45, y - 3.6, 110, 4.4, 1.2, 1.2, 'F');
    if(v) { doc.setFillColor(...rgb); doc.roundedRect(45, y - 3.6, Math.max(2.4, 110 * v / d.n), 4.4, 1.2, 1.2, 'F'); }
    doc.setFont(undefined,'normal'); doc.text(`${v}/${d.n}  (${pctAnd(v, d.n)}%)`, 160, y); y += 7;
  });
  y += 1; doc.setFontSize(9.5); doc.setTextColor(70);
  doc.text(`Furos úteis: perfilados ${d.tot.perf}/${d.tot.uteis}  ·  topografados ${d.tot.topo}/${d.tot.uteis}  ·  azimutados ${d.tot.az}/${d.tot.uteis}${d.tot.obst ? '  ·  obstruídos ' + d.tot.obst : ''}`, 15, y); y += 5;
  doc.text(`Prontos para tratar: ${d.status.pronto}  ·  Em andamento: ${d.status.andamento}  ·  Não iniciados: ${d.status.novo}`, 15, y); y += 5;
  if(d.faltaAz.length){ const ls = doc.splitTextToSize('Falta só o azimute em: ' + d.faltaAz.join(', '), 180); doc.text(ls, 15, y); y += ls.length * 4.6; }
  doc.setTextColor(0); y += 5;
  // Tabela por leque
  const COR = { 'Tratado':[15,125,120], 'Pronto p/ tratar':[178,53,17], 'Em andamento':[154,106,12], 'Não iniciado':[120,120,130], 'Sem furos':[120,120,130] };
  const cab = ()=>{ doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(9.5); doc.setFont(undefined,'bold'); doc.setTextColor(0);
    doc.text('Leque', 17, y); doc.text('Furos', 52, y, { align:'right' }); doc.text('Perf.', 76, y, { align:'right' }); doc.text('Topo', 98, y, { align:'right' }); doc.text('Azim.', 120, y, { align:'right' });
    doc.text('Situação', 128, y); doc.text('Tratado em', 164, y); y += 6.5; };
  cab(); doc.setFont(undefined,'normal');
  d.L.forEach((l, i)=>{
    if(y > 282){ doc.addPage(); y = 20; cab(); }
    if(i % 2) { doc.setFillColor(248,248,251); doc.rect(15, y - 4, 180, 5.4, 'F'); }
    doc.setFontSize(9.5); doc.setFont(undefined,'bold'); doc.setTextColor(0); doc.text(l.codigo, 17, y);
    doc.setFont(undefined,'normal'); doc.text(String(l.uteis), 52, y, { align:'right' }); doc.text(String(l.perf), 76, y, { align:'right' }); doc.text(String(l.topo), 98, y, { align:'right' }); doc.text(String(l.az), 120, y, { align:'right' });
    doc.setTextColor(...(COR[l.status] || [0,0,0])); doc.setFont(undefined,'bold'); doc.text(l.status, 128, y);
    doc.setFont(undefined,'normal'); doc.setTextColor(60); doc.text(l.tratadoEm ? fmtDataBR(l.tratadoEm) : '—', 164, y); doc.setTextColor(0); y += 5.4;
  });
  adicionarMarcaDaguaPDF(doc); adicionarNumeracaoPaginas(doc);
  await baixarOuCompartilharPDF(doc, `andamento_${String(d.a.nome).replace(/[^\w-]+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`, true);
  showToast('Andamento em PDF gerado.', { tipo:'ok' });
}

function abrirAndamentoRealce(anelId){
  const d = dadosAndamentoRealce(anelId); if(!d) return;
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;">Andamento — ${escHtml(d.a.nome)}</p>
    <div class="hint" style="margin-bottom:8px;">Para prestar conta à equipe: ${d.status.tratado} de ${d.n} leques tratados (${pctAnd(d.status.tratado, d.n)}%), com o progresso de cada etapa e a situação de cada leque.</div>
    <pre class="and-previa" id="and-texto">${escHtml(textoAndamentoRealce(anelId))}</pre>
    <div class="modal-actions"><button class="ghost" id="modal-cancelar">Fechar</button><button class="ghost" id="and-copiar">Copiar texto</button><button class="ghost" id="and-wpp">WhatsApp</button><button class="steel" id="and-pdf">PDF</button></div>
  </div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('modal-cancelar').addEventListener('click', fechar);
  el('modal-overlay').addEventListener('click', e=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('and-copiar').addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(textoAndamentoRealce(anelId)); showToast('Texto copiado.', { tipo:'ok' }); }catch(e){ showToast('Não consegui copiar; selecione o texto e copie.', { tipo:'aviso' }); } });
  el('and-wpp').addEventListener('click', ()=>{ window.open('https://wa.me/?text=' + encodeURIComponent(textoAndamentoRealce(anelId)), '_blank', 'noopener'); });
  el('and-pdf').addEventListener('click', async ()=>{ try{ await exportarAndamentoRealcePDF(anelId); fechar(); }catch(e){ console.error(e); showToast('Não consegui gerar o PDF.', { tipo:'erro' }); } });
}
