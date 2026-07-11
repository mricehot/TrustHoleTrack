// ======================================================
// COLOQUE AQUI A URL E A CHAVE "anon public" DO SEU PROJETO
// (painel do Supabase -> Project Settings -> API)
// ======================================================
const SUPABASE_URL = 'https://yccblxqevplzjopkdryb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IFKAde28BGRHIghLcVYT0g_dpT5IBlw';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


let aneis = [];        // { id, nome, ativo }
let leques = [];       // { id, anelId, tipo, numero, nome, status: 'aberto'|'fechado' }
let furos = [];        // { id, lequeId, numero, metragemEsperada, metragemReal, situacao, ts }
let anelAtivoId = null;
let lequesColapsados = new Set();
let lequesSelecionados = new Set();

function toggleLeque(id){
  if(lequesColapsados.has(id)) lequesColapsados.delete(id);
  else lequesColapsados.add(id);
  render();
}

function toggleSelecaoLeque(id, marcado){
  if(marcado) lequesSelecionados.add(id);
  else lequesSelecionados.delete(id);
  renderExportBar();
  // reflete o destaque visual do card sem precisar re-renderizar a lista inteira
  document.querySelectorAll('.leque-group[data-leque-id="'+id+'"]').forEach(elGroup=>{
    elGroup.classList.toggle('selecionado', marcado);
  });
}

function limparSelecaoLeques(){
  lequesSelecionados.clear();
  renderExportBar();
  render();
}

function renderExportBar(){
  const idsValidos = new Set(leques.map(l=>l.id));
  Array.from(lequesSelecionados).forEach(id=>{ if(!idsValidos.has(id)) lequesSelecionados.delete(id); });

  const bar = el('export-bar');
  const n = lequesSelecionados.size;
  if(n === 0){
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const codigos = leques.filter(l=>lequesSelecionados.has(l.id))
    .sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}))
    .map(l=>lequeCode(l)).join(', ');
  el('export-bar-count').textContent = (n===1 ? '1 leque selecionado: ' : n+' leques selecionados: ') + codigos;
}

const PREFIXO = { leque:'LQ', slot:'SL', fill:'FL' };

// Ícones em SVG (em vez de glifos de texto) para não depender da fonte de emoji
// de cada aparelho e manter contraste/traço consistentes em qualquer tela.
const ICONE_LIXEIRA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const ICONE_LAPIS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICONE_REABRIR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/></svg>';
const ICONE_DOWNLOAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>';
const ICONE_CHEVRON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const LOGO_B64 = "";

const TURNO_ROW_ID = 'current';
const SUPERVISOR_CONST = 'Talles da Silveira';
const PROJETO_CONST = 'Ero - Pilar';
let turnoInfo = { data:'', turnoNumero:'', turnoLetra:'', tecnicos:'', supervisor:SUPERVISOR_CONST, projeto:PROJETO_CONST, local:'', status:'', observacoes:'' };

function selecionarChip(grupoId, valor){
  document.querySelectorAll('#'+grupoId+' .chip').forEach(chip=>{
    chip.classList.toggle('active', chip.dataset.val === valor);
  });
}

async function loadTurnoInfo(){
  try{
    const { data, error } = await db.from('turno_info').select('*').eq('id', TURNO_ROW_ID).maybeSingle();
    if(error) throw error;
    if(data){
      turnoInfo = {
        data: data.data || '',
        turnoNumero: data.turno_numero || '',
        turnoLetra: data.turno_letra || '',
        tecnicos: data.tecnicos || '',
        supervisor: SUPERVISOR_CONST,
        projeto: PROJETO_CONST,
        local: data.local || '',
        status: data.status || '',
        observacoes: data.observacoes || ''
      };
    }
  }catch(e){
    showToast('Erro ao carregar dados do turno: ' + (e && e.message ? e.message : e));
  }

  turnoInfo.data = new Date().toLocaleDateString('pt-BR');
  turnoInfo.supervisor = SUPERVISOR_CONST;
  turnoInfo.projeto = PROJETO_CONST;

  el('turno-data').value = turnoInfo.data;
  el('turno-tecnicos').value = turnoInfo.tecnicos || '';
  el('turno-local').value = turnoInfo.local || '';
  el('turno-status').value = turnoInfo.status || '';
  el('turno-observacoes').value = turnoInfo.observacoes || '';
  el('turno-supervisor').value = turnoInfo.supervisor;
  el('turno-projeto').value = turnoInfo.projeto;
  selecionarChip('turno-numero-group', turnoInfo.turnoNumero);
  selecionarChip('turno-letra-group', turnoInfo.turnoLetra);

  await saveTurnoInfo();
}

async function saveTurnoInfo(){
  turnoInfo.data = el('turno-data').value;
  turnoInfo.tecnicos = el('turno-tecnicos').value;
  turnoInfo.local = el('turno-local').value;
  turnoInfo.status = el('turno-status').value;
  turnoInfo.observacoes = el('turno-observacoes').value;
  turnoInfo.supervisor = SUPERVISOR_CONST;
  turnoInfo.projeto = PROJETO_CONST;
  const chipNumero = document.querySelector('#turno-numero-group .chip.active');
  const chipLetra = document.querySelector('#turno-letra-group .chip.active');
  turnoInfo.turnoNumero = chipNumero ? chipNumero.dataset.val : '';
  turnoInfo.turnoLetra = chipLetra ? chipLetra.dataset.val : '';
  try{
    await db.from('turno_info').upsert({
      id: TURNO_ROW_ID,
      data: turnoInfo.data,
      turno_numero: turnoInfo.turnoNumero,
      turno_letra: turnoInfo.turnoLetra,
      tecnicos: turnoInfo.tecnicos,
      supervisor: turnoInfo.supervisor,
      projeto: turnoInfo.projeto,
      local: turnoInfo.local,
      status: turnoInfo.status,
      observacoes: turnoInfo.observacoes
    });
  }catch(e){
    showToast('Erro ao salvar dados do turno: ' + (e && e.message ? e.message : e));
  }
}

function drawHeaderTabelaPDF(doc, y){
  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 7, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(9); doc.setFont(undefined,'bold');
  doc.text('Furo', 17, y);
  doc.text('Esperada', 62, y);
  doc.text('Real', 97, y);
  doc.text('Diferenca', 127, y);
  doc.text('Situacao', 162, y);
  doc.setTextColor(0,0,0);
  return y+7;
}

function desenharCabecalhoTurnoPDF(doc){
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64, 'JPEG', 15, 8, 20, 19.6); }catch(e){}

  doc.setFontSize(12); doc.setFont(undefined,'bold');
  doc.text('STATUS TURNO PERFILAGEM DE LAVRA/TOPOGRAFIA', 40, 15);
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(120);
  doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), 40, 21);
  doc.setTextColor(0);
  doc.setDrawColor(180); doc.line(15, 30, 195, 30);

  doc.setFontSize(10);
  let y = 38;
  const turnoDisplay = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `${turnoInfo.turnoNumero || '-'}º Turno - Letra ${turnoInfo.turnoLetra || '-'}`
    : '-';
  const campos = [
    ['Data:', turnoInfo.data],
    ['Turno:', turnoDisplay],
    ['Tecnicos:', turnoInfo.tecnicos],
    ['Supervisor:', turnoInfo.supervisor],
    ['Projeto:', turnoInfo.projeto],
    ['Local:', turnoInfo.local],
    ['Status:', turnoInfo.status],
  ];
  campos.forEach(([label,val])=>{
    doc.setFont(undefined,'bold'); doc.text(label, 15, y);
    doc.setFont(undefined,'normal'); doc.text(String(val||'-'), 42, y);
    y += 6;
  });

  if(turnoInfo.observacoes && turnoInfo.observacoes.trim()){
    doc.setFont(undefined,'bold'); doc.text('Observacoes:', 15, y); y += 6;
    doc.setFont(undefined,'normal');
    const linhasObs = doc.splitTextToSize(turnoInfo.observacoes.trim(), 178);
    if(y + linhasObs.length * 5 > 275){ doc.addPage(); y = 20; }
    doc.text(linhasObs, 15, y);
    y += linhasObs.length * 5 + 4;
  }

  y += 4;
  doc.setDrawColor(180); doc.line(15, y, 195, y); y += 10;
  return y;
}

// Compartilha o PDF como arquivo de verdade (evita cair um link "blob:" no WhatsApp/redes sociais).
// Quando o navegador suporta Web Share API com arquivos, abre o menu nativo de compartilhamento.
// Caso contrário, cai no download tradicional (o arquivo vai para a pasta de Downloads do aparelho).
async function baixarOuCompartilharPDF(doc, nomeArquivo){
  const blob = doc.output('blob');

  try{
    const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
    if(navigator.canShare && navigator.canShare({ files: [arquivo] })){
      await navigator.share({ files: [arquivo], title: nomeArquivo });
      return;
    }
  }catch(err){
    if(err && err.name === 'AbortError') return; // usuário cancelou o compartilhamento, não é erro
    // se o compartilhamento falhar por outro motivo, cai no download normal abaixo
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

let historicoExportacoes = [];

async function registrarExportacao({ tipo, leques, qtdLeques, qtdFuros, nomeArquivo }){
  try{
    const { error } = await db.from('export_historico').insert({
      tipo,
      turno_data: turnoInfo.data,
      turno_numero: turnoInfo.turnoNumero,
      turno_letra: turnoInfo.turnoLetra,
      leques: leques || null,
      qtd_leques: qtdLeques || 0,
      qtd_furos: qtdFuros || 0,
      nome_arquivo: nomeArquivo
    });
    if(error) throw error;
    await loadHistoricoExportacoes();
    return true;
  }catch(e){
    // histórico é auxiliar: não trava a exportação, mas registra o erro real no console para diagnóstico
    console.error('Falha ao registrar no histórico de exportações:', e);
    return false;
  }
}

async function loadHistoricoExportacoes(){
  try{
    const { data, error } = await db.from('export_historico').select('*').order('criado_em', { ascending:false }).limit(50);
    if(error) throw error;
    historicoExportacoes = data || [];
  }catch(e){
    historicoExportacoes = [];
  }
  renderHistoricoExportacoes();
}

function renderHistoricoExportacoes(){
  const lista = el('historico-list');
  const vazio = el('historico-vazio');
  if(!lista) return;
  if(historicoExportacoes.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';

  const TIPO_LABEL = { turno:'Só turno', leque:'1 leque', combinado:'Combinado' };

  lista.innerHTML = historicoExportacoes.map(reg=>{
    const quando = reg.criado_em ? new Date(reg.criado_em).toLocaleString('pt-BR') : '-';
    const turnoLabelReg = [reg.turno_numero, reg.turno_letra].filter(Boolean).join('');
    const detalhe = reg.tipo === 'turno'
      ? 'Sem perfilagem de furos'
      : `${reg.leques || '-'} · ${reg.qtd_furos || 0} furo(s)`;
    return `
      <div class="historico-row">
        <span class="quando">${quando}</span>
        <span class="tipo ${reg.tipo}">${TIPO_LABEL[reg.tipo] || reg.tipo}</span>
        <span>${reg.turno_data || '-'}${turnoLabelReg ? ' · Turno '+turnoLabelReg : ''}</span>
        <span class="detalhe">${detalhe}</span>
        <span class="arquivo">${reg.nome_arquivo || ''}</span>
      </div>
    `;
  }).join('');
}

async function exportarTurnoPDF(){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(10); doc.setFont(undefined,'italic'); doc.setTextColor(120);
  doc.text('Nenhuma perfilagem de furos vinculada a este relatório.', 15, y);
  doc.setTextColor(0); doc.setFont(undefined,'normal');

  const dataArquivo = (turnoInfo.data || '').replace(/\//g,'-') || 'sem-data';
  const sufixoTurno = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `_${turnoInfo.turnoNumero || ''}${turnoInfo.turnoLetra || ''}`
    : '';
  const nomeArquivo = ('Turno_' + dataArquivo + sufixoTurno).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';

  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'turno', leques:null, qtdLeques:0, qtdFuros:0, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF do turno exportado.'
    : 'PDF do turno exportado, mas não entrou no histórico (crie a tabela export_historico no Supabase).');
}

async function exportarLequePDF(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const a = aneis.find(x=>x.id===l.anelId);
  let furosDoLeque = furos.filter(f=>f.lequeId===id);
  furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text('Anel: ' + (a ? a.nome : '-'), 15, y); y += 6;
  doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 10;

  y = drawHeaderTabelaPDF(doc, y);
  doc.setFont(undefined,'normal'); doc.setFontSize(9);

  furosDoLeque.forEach(f=>{
    if(y > 275){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(9); }
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    doc.text(furoCode(l,f), 17, y);
    doc.text(fmt1(Number(f.metragemEsperada))+' m', 62, y);
    doc.text(fmt1(Number(f.metragemReal))+' m', 97, y);
    doc.text(diffLabel(diff), 127, y);
    doc.text(situacaoLabel(f.situacao), 162, y);
    doc.setDrawColor(220); doc.line(15, y+2, 195, y+2);
    y += 7;
  });

  y += 6;
  if(y > 270){ doc.addPage(); y = 20; }
  const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const varTotal = totalReal - totalEsp;
  const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

  doc.setFont(undefined,'bold'); doc.setFontSize(10);
  doc.text('Total: ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);

  const nomeArquivo = (lequeCode(l) + '_' + (a?a.nome:'anel')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'leque', leques: lequeCode(l), qtdLeques:1, qtdFuros: furosDoLeque.length, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF de ' + lequeCode(l) + ' exportado.'
    : 'PDF de ' + lequeCode(l) + ' exportado, mas não entrou no histórico (crie a tabela export_historico no Supabase).');
}

async function exportarLequesPDF(ids){
  if(!ids || ids.length === 0){ showToast('Selecione ao menos um leque para exportar.'); return; }
  let selecionados = leques.filter(l=>ids.includes(l.id));
  if(selecionados.length === 0){ showToast('Nenhum leque válido selecionado.'); return; }
  selecionados = [...selecionados].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(10); doc.setFont(undefined,'bold');
  const linhasInclusos = doc.splitTextToSize(
    'Leques inclusos (' + selecionados.length + '): ' + selecionados.map(l=>lequeCode(l)).join(', '),
    180
  );
  doc.text(linhasInclusos, 15, y);
  y += linhasInclusos.length * 6 + 6;

  let totalGeralEsp = 0, totalGeralReal = 0, totalGeralFuros = 0, alertasGeral = 0;

  selecionados.forEach((l, idx)=>{
    const a = aneis.find(x=>x.id===l.anelId);
    let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
    furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));

    if(y > 250){ doc.addPage(); y = 20; }

    doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('Anel: ' + (a ? a.nome : '-'), 15, y); y += 6;
    doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 10;

    y = drawHeaderTabelaPDF(doc, y);
    doc.setFont(undefined,'normal'); doc.setFontSize(9);

    furosDoLeque.forEach(f=>{
      if(y > 275){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(9); }
      const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
      doc.text(furoCode(l,f), 17, y);
      doc.text(fmt1(Number(f.metragemEsperada))+' m', 62, y);
      doc.text(fmt1(Number(f.metragemReal))+' m', 97, y);
      doc.text(diffLabel(diff), 127, y);
      doc.text(situacaoLabel(f.situacao), 162, y);
      doc.setDrawColor(220); doc.line(15, y+2, 195, y+2);
      y += 7;
    });

    const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
    const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
    const varTotal = totalReal - totalEsp;
    const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

    totalGeralEsp += totalEsp;
    totalGeralReal += totalReal;
    totalGeralFuros += furosDoLeque.length;
    alertasGeral += alertas;

    y += 6;
    if(y > 270){ doc.addPage(); y = 20; }
    doc.setFont(undefined,'bold'); doc.setFontSize(10);
    doc.text('Subtotal ' + lequeCode(l) + ': ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);
    y += 10;

    if(idx < selecionados.length - 1){
      doc.setDrawColor(200); doc.line(15, y, 195, y);
      y += 8;
    }
  });

  if(y > 255){ doc.addPage(); y = 20; }
  y += 2;
  doc.setDrawColor(25,18,49); doc.setLineWidth(0.6); doc.line(15, y, 195, y); doc.setLineWidth(0.2); y += 9;
  const varGeral = totalGeralReal - totalGeralEsp;
  doc.setFontSize(11); doc.setFont(undefined,'bold');
  const linhasTotal = doc.splitTextToSize(
    'TOTAL GERAL (' + selecionados.length + ' leque(s)): ' + totalGeralFuros + ' furo(s)  |  Esperada: ' + fmt1(totalGeralEsp) + ' m  |  Real: ' + fmt1(totalGeralReal) + ' m  |  Variacao: ' + diffLabel(varGeral) + '  |  Alertas: ' + alertasGeral,
    180
  );
  doc.text(linhasTotal, 15, y);

  const nomeArquivo = ('Turno_' + selecionados.map(l=>lequeCode(l)).join('-')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({
    tipo:'combinado',
    leques: selecionados.map(l=>lequeCode(l)).join(', '),
    qtdLeques: selecionados.length,
    qtdFuros: totalGeralFuros,
    nomeArquivo
  });
  showToast(salvoNoHistorico
    ? 'PDF combinado com ' + selecionados.length + ' leque(s) exportado.'
    : 'PDF combinado exportado, mas não entrou no histórico (crie a tabela export_historico no Supabase).');
}


const el = id => document.getElementById(id);
const fmt1 = n => (Math.round(n*10)/10).toFixed(1);
const pad2 = n => String(n).padStart(2,'0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

// Padroniza número de 1 dígito com zero na frente (1 -> 01), evitando duplicidade tipo "1" vs "01".
// Se já tiver 2+ dígitos, ou não for só números, mantém como o usuário digitou.
function normalizarNumero(str){
  const trimmed = String(str).trim();
  if(/^\d$/.test(trimmed)) return '0' + trimmed;
  return trimmed;
}

function situacaoLabel(s){ return { livre:'Livre', obstruido:'Obstruído', varado:'Varado' }[s] || s; }
function tipoLabel(t){ return { leque:'Leque', slot:'Slot', fill:'Face Livre' }[t] || t; }
function tipoBotaoLabel(t){ return { leque:'Criar Leque', slot:'Criar Slot', fill:'Criar Face Livre' }[t] || 'Criar Medição'; }
function diffClass(diff){ if(diff >= 0) return 'ok'; if(diff >= -0.5) return 'warn'; return 'bad'; }
function diffLabel(diff){ return (diff > 0 ? '+' : '') + fmt1(diff) + ' m'; }
function lequeCode(l){ return PREFIXO[l.tipo] + l.numero; }
function furoCode(l, f){ return lequeCode(l) + 'F' + f.numero; }

function mapAnel(row){ return { id: row.id, nome: row.nome, ativo: row.ativo }; }
function mapLeque(row){ return { id: row.id, anelId: row.anel_id, tipo: row.tipo, numero: row.numero, nome: row.nome, status: row.status }; }
function mapFuro(row){ return { id: row.id, lequeId: row.leque_id, numero: row.numero, metragemEsperada: row.metragem_esperada, metragemReal: row.metragem_real, situacao: row.situacao, ts: row.criado_em }; }

async function loadData(){
  try{
    const [{ data: aneisData, error: e1 }, { data: lequesData, error: e2 }, { data: furosData, error: e3 }] = await Promise.all([
      db.from('aneis').select('*').order('criado_em'),
      db.from('leques').select('*').order('criado_em'),
      db.from('furos').select('*').order('criado_em')
    ]);
    if(e1 || e2 || e3) throw (e1 || e2 || e3);

    aneis = (aneisData || []).map(mapAnel);
    leques = (lequesData || []).map(mapLeque);
    furos = (furosData || []).map(mapFuro);

    const ativo = aneis.find(a=>a.ativo);
    if(ativo){
      anelAtivoId = ativo.id;
    }else if(aneis[0]){
      anelAtivoId = aneis[0].id;
      await db.from('aneis').update({ ativo: true }).eq('id', anelAtivoId);
    }else{
      anelAtivoId = null;
    }
  }catch(e){
    showToast('Erro ao carregar dados do Supabase: ' + (e && e.message ? e.message : e));
    aneis = []; leques = []; furos = []; anelAtivoId = null;
  }
  renderAll();
}

function showToast(msg){
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.classList.remove('show'), 2200);
}

function destacarCampoInvalido(id){
  const campo = el(id);
  if(!campo) return;
  campo.classList.remove('campo-invalido');
  // força reflow para a animação poder rodar de novo mesmo se o campo já estava marcado
  void campo.offsetWidth;
  campo.classList.add('campo-invalido');
  campo.focus();
  clearTimeout(campo._invalidoTimer);
  campo._invalidoTimer = setTimeout(()=> campo.classList.remove('campo-invalido'), 1600);
}

function confirmDialog(mensagem, textoConfirmar){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p>${mensagem}</p>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="danger" id="modal-confirmar">${textoConfirmar || 'Confirmar'}</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(false));
    el('modal-confirmar').addEventListener('click', ()=> fechar(true));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(false); });
  });
}

function editFuroModal(furo){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Editar furo</p>
          <div class="grid-3" style="margin-bottom:14px;">
            <div class="field">
              <label for="edit-furo-numero">Número</label>
              <input id="edit-furo-numero" type="text" value="${furo.numero}">
            </div>
            <div class="field">
              <label for="edit-furo-esperada">Esperada (m)</label>
              <input id="edit-furo-esperada" type="number" step="0.1" min="0" value="${furo.metragemEsperada}">
            </div>
            <div class="field">
              <label for="edit-furo-real">Real (m)</label>
              <input id="edit-furo-real" type="number" step="0.1" min="0" value="${furo.metragemReal}">
            </div>
          </div>
          <div class="field" style="margin-bottom:16px;">
            <label for="edit-furo-situacao">Situação</label>
            <select id="edit-furo-situacao">
              <option value="livre" ${furo.situacao==='livre'?'selected':''}>Livre</option>
              <option value="obstruido" ${furo.situacao==='obstruido'?'selected':''}>Obstruído</option>
              <option value="varado" ${furo.situacao==='varado'?'selected':''}>Varado</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="steel" id="modal-salvar">Salvar</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(null));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(null); });
    const salvar = ()=>{
      const numero = normalizarNumero(el('edit-furo-numero').value.trim());
      const metragemEsperada = parseFloat(el('edit-furo-esperada').value);
      const metragemReal = parseFloat(el('edit-furo-real').value);
      const situacao = el('edit-furo-situacao').value;
      if(!numero || isNaN(metragemEsperada) || isNaN(metragemReal)){
        showToast('Preencha número, esperada e real corretamente.');
        if(!numero) destacarCampoInvalido('edit-furo-numero');
        else if(isNaN(metragemEsperada)) destacarCampoInvalido('edit-furo-esperada');
        else destacarCampoInvalido('edit-furo-real');
        return;
      }
      fechar({ numero, metragemEsperada, metragemReal, situacao });
    };
    el('modal-salvar').addEventListener('click', salvar);
    ['edit-furo-numero','edit-furo-esperada','edit-furo-real'].forEach(id=>{
      el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    });
  });
}

async function editarFuro(id){
  const f = furos.find(x=>x.id===id);
  if(!f) return;
  const l = leques.find(x=>x.id===f.lequeId);
  const resultado = await editFuroModal(f);
  if(!resultado) return;

  if(resultado.numero !== f.numero){
    const duplicado = furos.some(x=>x.lequeId===f.lequeId && x.numero===resultado.numero && x.id!==f.id);
    if(duplicado){
      showToast(`Já existe o furo ${l ? lequeCode(l) : ''}F${resultado.numero} neste leque.`);
      return;
    }
  }

  try{
    const { error } = await db.from('furos').update({
      numero: resultado.numero,
      metragem_esperada: resultado.metragemEsperada,
      metragem_real: resultado.metragemReal,
      situacao: resultado.situacao
    }).eq('id', id);
    if(error) throw error;
    await loadData();
    showToast('Furo atualizado.');
  }catch(err){
    showToast('Erro ao editar furo: ' + (err && err.message ? err.message : err));
  }
}

function fanSVG(furosDoLeque){
  const n = Math.max(furosDoLeque.length, 1);
  const w = 34, h = 26, cx = 6, cy = h - 3;
  const spread = Math.PI * 0.62;
  const start = -Math.PI/2 - spread/2;
  let lines = '';
  furosDoLeque.forEach((f, i) => {
    const t = n === 1 ? 0.5 : i/(n-1);
    const angle = start + spread * t;
    const x2 = cx + Math.cos(angle) * 18, y2 = cy + Math.sin(angle) * 18;
    const color = f.situacao === 'obstruido' ? 'var(--amber)' : f.situacao === 'varado' ? 'var(--steel)' : 'var(--moss)';
    lines += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`;
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--muted)"/>${lines}</svg>`;
}

function lequeAbertoDoAnel(anelId){
  return leques.find(l=>l.anelId===anelId && l.status==='aberto');
}

// ---------- Anéis (menu separado) ----------
function renderAneisMenu(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  el('anel-menu-current').textContent = anelAtivo ? `ativo: ${anelAtivo.nome}` : 'nenhum anel ativo';
  if(!anelAtivo) el('anel-menu').setAttribute('open', '');

  const lista = el('anel-list');
  if(aneis.length === 0){
    lista.innerHTML = `<div class="hint">Nenhum anel criado. Crie o primeiro acima.</div>`;
    return;
  }
  lista.innerHTML = aneis.map(a=>{
    const ativo = a.id === anelAtivoId;
    return `
      <div class="anel-row ${ativo?'ativo':''}">
        <span class="nome">${a.nome}</span>
        ${ativo ? '<span class="badge-ativo">ativo</span>' : ''}
        <span class="spacer"></span>
        ${!ativo ? `<button class="ghost" onclick="usarAnel('${a.id}')">Usar este anel</button>` : ''}
        <button class="icon" onclick="removerAnel('${a.id}')" title="remover anel">${ICONE_LIXEIRA}</button>
      </div>
    `;
  }).join('');
}

async function usarAnel(id){
  try{
    await db.from('aneis').update({ ativo: false }).eq('ativo', true);
    await db.from('aneis').update({ ativo: true }).eq('id', id);
    await loadData();
    showToast('Anel ativo alterado.');
    el('anel-menu').removeAttribute('open');
  }catch(err){
    showToast('Erro ao trocar de anel: ' + (err && err.message ? err.message : err));
  }
}

async function removerAnel(id){
  const a = aneis.find(x=>x.id===id);
  if(!a) return;
  const lequesDoAnel = leques.filter(l=>l.anelId===id).map(l=>l.id);
  const qtdFuros = furos.filter(f=>lequesDoAnel.includes(f.lequeId)).length;
  const msg = `Remover o anel "${a.nome}", ${lequesDoAnel.length} leque(s) e ${qtdFuros} furo(s)? Esta ação não pode ser desfeita.`;
  if(!(await confirmDialog(msg, 'Remover'))) return;
  try{
    const { error } = await db.from('aneis').delete().eq('id', id); // leques/furos saem via ON DELETE CASCADE
    if(error) throw error;
    if(anelAtivoId === id){
      const restante = aneis.find(x=>x.id!==id);
      if(restante) await db.from('aneis').update({ ativo: true }).eq('id', restante.id);
    }
    await loadData();
    showToast('Anel removido.');
  }catch(err){
    showToast('Erro ao remover anel: ' + (err && err.message ? err.message : err));
  }
}

async function criarAnel(){
  try{
    const campoNome = el('anel-nome');
    const nome = campoNome.value.trim();
    campoNome.style.borderColor = '';
    el('anel-erro').textContent = '';
    if(!nome){
      showToast('Informe o nome do anel/galeria.');
      destacarCampoInvalido('anel-nome');
      return;
    }
    if(aneis.some(a=>a.nome.toLowerCase() === nome.toLowerCase())){
      campoNome.style.borderColor = 'var(--rust)';
      el('anel-erro').textContent = `Já existe um anel chamado "${nome}". Escolha outro nome ou use o existente na lista abaixo.`;
      showToast('Já existe um anel com esse nome.');
      destacarCampoInvalido('anel-nome');
      return;
    }
    await db.from('aneis').update({ ativo: false }).eq('ativo', true);
    const { data, error } = await db.from('aneis').insert({ nome, ativo: true }).select().single();
    if(error) throw error;
    campoNome.value = '';
    await loadData();
    showToast('Anel criado e definido como ativo.');
  }catch(err){
    showToast('Erro ao criar anel: ' + (err && err.message ? err.message : err));
  }
}
el('btn-criar-anel').addEventListener('click', criarAnel);
el('anel-nome').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarAnel(); } });

// ---------- Breadcrumb + painel de trabalho ----------
function renderBreadcrumb(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const bc = el('breadcrumb');
  if(!anelAtivo){
    bc.innerHTML = `<span class="warn">Nenhum anel ativo — abra o menu "Anéis / Galerias" acima e crie ou selecione um.</span>`;
    return;
  }
  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
  bc.innerHTML = `Anel <b>${anelAtivo.nome}</b>` +
    (lequeAberto
      ? ` <span class="arrow">›</span> leque aberto <b>${lequeCode(lequeAberto)}</b> (${tipoLabel(lequeAberto.tipo)})`
      : ` <span class="arrow">›</span> <span class="warn">nenhum leque aberto</span>`);
}

function renderPainelTrabalho(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const painel = el('painel-trabalho');

  if(!anelAtivo){
    painel.style.display = 'none';
    return;
  }
  painel.style.display = '';

  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);

  // painel leque: criar OU mostrar leque atual + finalizar
  const formLeque = el('form-leque');
  const boxAtual = el('leque-atual-box');
  if(lequeAberto){
    formLeque.style.display = 'none';
    el('leque-panel-title').textContent = 'Medição em andamento';
    const furosDoLeque = furos.filter(f=>f.lequeId===lequeAberto.id);
    boxAtual.innerHTML = `
      <div class="leque-atual">
        <span class="code">${lequeCode(lequeAberto)}</span>
        <span>${tipoLabel(lequeAberto.tipo)}${lequeAberto.nome ? ' · '+lequeAberto.nome : ''}</span>
        <span class="hint">${furosDoLeque.length} furo(s) registrados</span>
        <span class="spacer"></span>
        <button class="danger" onclick="finalizarLeque('${lequeAberto.id}')">Finalizar leque</button>
      </div>
    `;
  }else{
    formLeque.style.display = '';
    el('leque-panel-title').textContent = 'Criar Medição';
    el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value);
    boxAtual.innerHTML = '';
  }

  // painel furo
  const semLeque = !lequeAberto;
  ['furo-numero','furo-esperada','furo-real','furo-situacao','btn-add-furo'].forEach(id=> el(id).disabled = semLeque);
  el('furo-hint').style.display = semLeque ? 'block' : 'none';
}

async function criarLeque(){
  try{
    const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
    if(!anelAtivo){
      showToast('Selecione um anel ativo antes de criar um leque.');
      return;
    }
    const tipo = el('leque-tipo').value;
    const numero = normalizarNumero(el('leque-numero').value.trim());
    if(!numero){
      showToast('Informe o número do leque.');
      destacarCampoInvalido('leque-numero');
      return;
    }
    const duplicado = leques.some(l=>l.anelId===anelAtivo.id && l.tipo===tipo && l.numero===numero);
    if(duplicado){
      showToast(`Já existe ${PREFIXO[tipo]}${numero} neste anel.`);
      destacarCampoInvalido('leque-numero');
      return;
    }
    const { data, error } = await db.from('leques').insert({
      anel_id: anelAtivo.id, tipo, numero, nome: el('leque-nome').value.trim() || null, status: 'aberto'
    }).select().single();
    if(error) throw error;
    el('leque-numero').value = '';
    el('leque-nome').value = '';
    await loadData();
    showToast(`Leque ${lequeCode(mapLeque(data))} criado e aberto.`);
  }catch(err){
    showToast('Erro ao criar leque: ' + (err && err.message ? err.message : err));
  }
}
el('btn-add-leque').addEventListener('click', criarLeque);
el('leque-tipo').addEventListener('change', ()=>{ el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value); });
['leque-numero','leque-nome'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarLeque(); } });
});

async function finalizarLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const qtd = furos.filter(f=>f.lequeId===id).length;
  if(!(await confirmDialog(`Finalizar o leque ${lequeCode(l)}${qtd ? ' com '+qtd+' furo(s)' : ' sem nenhum furo'}? Você poderá reabri-lo depois se precisar.`, 'Finalizar'))) return;
  try{
    const { error } = await db.from('leques').update({ status: 'fechado' }).eq('id', id);
    if(error) throw error;
    await loadData();
    showToast(`Leque ${lequeCode(l)} finalizado.`);
  }catch(err){
    showToast('Erro ao finalizar leque: ' + (err && err.message ? err.message : err));
  }
}

async function reabrirLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const outroAberto = lequeAbertoDoAnel(l.anelId);
  if(outroAberto && outroAberto.id !== l.id){
    if(!(await confirmDialog(`O leque ${lequeCode(outroAberto)} está aberto neste anel. Finalizá-lo e reabrir ${lequeCode(l)}?`, 'Reabrir'))) return;
  }
  try{
    if(outroAberto && outroAberto.id !== l.id){
      await db.from('leques').update({ status: 'fechado' }).eq('id', outroAberto.id);
    }
    const { error } = await db.from('leques').update({ status: 'aberto' }).eq('id', id);
    if(error) throw error;
    await loadData();
    showToast(`Leque ${lequeCode(l)} reaberto.`);
  }catch(err){
    showToast('Erro ao reabrir leque: ' + (err && err.message ? err.message : err));
  }
}

async function adicionarFuro(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo){
    showToast('Selecione um anel ativo antes de adicionar furos.');
    return;
  }
  try{
    const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
    if(!lequeAberto){
      showToast('Abra um leque antes de adicionar furos.');
      return;
    }
    const numero = normalizarNumero(el('furo-numero').value.trim());
    if(!numero){
      showToast('Informe o número do furo.');
      destacarCampoInvalido('furo-numero');
      return;
    }
    const duplicado = furos.some(f=>f.lequeId===lequeAberto.id && f.numero===numero);
    if(duplicado){
      showToast(`Já existe o furo ${lequeCode(lequeAberto)}F${numero} neste leque.`);
      destacarCampoInvalido('furo-numero');
      return;
    }
    const metragemEsperada = parseFloat(el('furo-esperada').value);
    const metragemReal = parseFloat(el('furo-real').value);
    if(isNaN(metragemEsperada) || isNaN(metragemReal)){
      showToast('Preencha a metragem esperada e a real.');
      destacarCampoInvalido(isNaN(metragemEsperada) ? 'furo-esperada' : 'furo-real');
      return;
    }

    const { data, error } = await db.from('furos').insert({
      leque_id: lequeAberto.id,
      numero,
      metragem_esperada: metragemEsperada,
      metragem_real: metragemReal,
      situacao: el('furo-situacao').value
    }).select().single();
    if(error) throw error;

    el('furo-numero').value = '';
    el('furo-esperada').value = '';
    el('furo-real').value = '';
    el('furo-numero').focus();
    await loadData();
    showToast(`Furo ${furoCode(lequeAberto, mapFuro(data))} registrado.`);
  }catch(err){
    showToast('Erro ao adicionar furo: ' + (err && err.message ? err.message : err));
  }
}
el('btn-add-furo').addEventListener('click', adicionarFuro);
['furo-numero','furo-esperada','furo-real'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); adicionarFuro(); } });
});

async function removerFuro(id){
  try{
    const { error } = await db.from('furos').delete().eq('id', id);
    if(error) throw error;
    await loadData();
    showToast('Furo removido.');
  }catch(err){
    showToast('Erro ao remover furo: ' + (err && err.message ? err.message : err));
  }
}

async function removerLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const qtd = furos.filter(f=>f.lequeId===id).length;
  if(!(await confirmDialog(`Remover o leque ${lequeCode(l)} e seus ${qtd} furo(s)?`, 'Remover'))) return;
  try{
    const { error } = await db.from('leques').delete().eq('id', id); // furos saem via ON DELETE CASCADE
    if(error) throw error;
    await loadData();
    showToast('Leque removido.');
  }catch(err){
    showToast('Erro ao remover leque: ' + (err && err.message ? err.message : err));
  }
}

// ---------- Filtros + lista/histórico ----------
function render(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const lequesDoAtivo = anelAtivo ? leques.filter(l=>l.anelId===anelAtivo.id) : [];
  const idsLequesAtivo = new Set(lequesDoAtivo.map(l=>l.id));
  const furosDoAtivo = furos.filter(f=>idsLequesAtivo.has(f.lequeId));

  const totalReal = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const totalEsperada = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const variacao = totalReal - totalEsperada;

  el('readout-label').textContent = anelAtivo ? `anel ativo: ${anelAtivo.nome}` : 'nenhum anel ativo';
  el('stat-leques').textContent = lequesDoAtivo.length;
  el('stat-furos').textContent = furosDoAtivo.length;
  el('stat-metros').textContent = fmt1(totalReal);
  el('stat-variacao').textContent = diffLabel(variacao);
  el('stat-var-wrap').className = variacao < 0 ? 'neg' : (variacao > 0 ? 'pos' : '');
  el('stat-alertas').textContent = furosDoAtivo.filter(f=>f.situacao!=='livre').length;

  const tipoFiltro = el('f-tipo').value;
  const situacaoFiltro = el('f-situacao').value;
  const busca = el('f-busca').value.trim().toUpperCase();

  const lista = el('lista');

  if(aneis.length === 0){
    lista.innerHTML = `<div class="empty">Nenhum anel criado ainda.<br>Abra o menu "Anéis / Galerias" no topo para começar.</div>`;
    return;
  }

  if(!anelAtivo){
    lista.innerHTML = `<div class="empty">Nenhum anel ativo.<br>Abra o menu "Anéis / Galerias" no topo e selecione um.</div>`;
    return;
  }

  const aneisParaMostrar = [anelAtivo];
  let algumConteudo = false;
  let html = '';

  aneisParaMostrar.forEach(a=>{
    let lequesDoAnel = leques.filter(l=>l.anelId===a.id);
    if(tipoFiltro) lequesDoAnel = lequesDoAnel.filter(l=>l.tipo===tipoFiltro);
    lequesDoAnel = [...lequesDoAnel].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

    const gruposHTML = lequesDoAnel.map(l=>{
      let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
      furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));
      if(situacaoFiltro) furosDoLeque = furosDoLeque.filter(f=>f.situacao===situacaoFiltro);
      if(busca) furosDoLeque = furosDoLeque.filter(f=>furoCode(l,f).includes(busca) || lequeCode(l).includes(busca));

      const semFurosPorFiltro = furosDoLeque.length === 0 && (situacaoFiltro || busca);
      if(semFurosPorFiltro) return '';

      const totalRealL = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
      const totalEspL = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
      const varL = totalRealL - totalEspL;
      const alertasL = furosDoLeque.filter(f=>f.situacao!=='livre').length;

      const rows = furosDoLeque.map(f=>{
        const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
        return `
        <tr>
          <td><span class="status-dot ${f.situacao}"></span>${furoCode(l,f)}</td>
          <td>${fmt1(Number(f.metragemEsperada))} m</td>
          <td>${fmt1(Number(f.metragemReal))} m</td>
          <td class="diff ${diffClass(diff)}">${diffLabel(diff)}</td>
          <td>${situacaoLabel(f.situacao)}</td>
          <td class="actions">
            <button class="icon" onclick="editarFuro('${f.id}')" title="editar">${ICONE_LAPIS}</button>
            <button class="icon" onclick="removerFuro('${f.id}')" title="remover">${ICONE_LIXEIRA}</button>
          </td>
        </tr>`;
      }).join('');

      const colapsado = lequesColapsados.has(l.id);
      const selecionado = lequesSelecionados.has(l.id);

      return `
        <div class="leque-group ${l.status === 'aberto' ? 'aberto' : ''} ${selecionado ? 'selecionado' : ''}" data-leque-id="${l.id}">
          <div class="leque-head">
              <label class="leque-select-wrap" title="selecionar para exportação combinada">
                <input type="checkbox" class="leque-select" data-id="${l.id}" ${selecionado ? 'checked' : ''}>
              </label>
              <button class="icon toggle-leque ${colapsado ? '' : 'expandido'}" onclick="toggleLeque('${l.id}')" title="${colapsado ? 'expandir' : 'minimizar'}">${ICONE_CHEVRON}</button>
              <div class="fan">${fanSVG(furosDoLeque)}</div>
              <span class="code">${lequeCode(l)}</span>
              <span class="badge-tipo ${l.tipo}">${tipoLabel(l.tipo)}</span>
              <span class="status ${l.status}">${l.status === 'aberto' ? 'aberto' : 'fechado'}</span>
              ${l.nome ? `<span class="hint">${l.nome}</span>` : ''}
            <div class="stats">
              <div><b>${furosDoLeque.length}</b> furos</div>
              <div><b>${fmt1(totalEspL)}</b> m esp.</div>
              <div><b>${fmt1(totalRealL)}</b> m real</div>
              <div class="${varL < 0 ? 'neg' : (varL > 0 ? 'pos' : '')}"><b>${diffLabel(varL)}</b> var.</div>
              ${alertasL ? `<div><b>${alertasL}</b> alertas</div>` : ''}
              ${l.status === 'fechado' ? `<button class="icon" onclick="reabrirLeque('${l.id}')" title="reabrir">${ICONE_REABRIR} reabrir</button>` : ''}
              <button class="icon" onclick="exportarLequePDF('${l.id}')" title="exportar PDF deste leque sozinho">${ICONE_DOWNLOAD} PDF</button>
              <button class="icon" onclick="removerLeque('${l.id}')" title="remover leque">${ICONE_LIXEIRA}</button>
            </div>
          </div>
          ${colapsado ? '' : (furosDoLeque.length ? `<div class="table-scroll"><table>
            <thead><tr><th>Furo</th><th>Esperada</th><th>Real</th><th>Variação</th><th>Situação</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>` : `<div class="sem-furos">Nenhum furo registrado neste leque ainda.</div>`)}
        </div>
      `;
    }).join('');

    if(gruposHTML.trim()){
      algumConteudo = true;
      html += `
        <div class="anel-section">
          <div class="anel-section-head"><b>${a.nome}</b></div>
          ${gruposHTML}
        </div>
      `;
    }
  });

  lista.innerHTML = algumConteudo ? html : `<div class="empty">Nenhum registro corresponde aos filtros.</div>`;
}

function renderAll(){
  renderAneisMenu();
  renderBreadcrumb();
  renderPainelTrabalho();
  render();
  renderExportBar();
}

['f-tipo','f-situacao','f-busca'].forEach(id=> el(id).addEventListener('input', render));



el('btn-csv').addEventListener('click', ()=>{
  if(furos.length === 0) return;
  const header = 'anel,codigo_furo,tipo,metragem_esperada,metragem_real,diferenca,situacao,timestamp\n';
  const rows = furos.map(f=>{
    const l = leques.find(x=>x.id===f.lequeId) || {};
    const a = aneis.find(x=>x.id===l.anelId) || {};
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    return [a.nome||'', furoCode(l,f), l.tipo||'', f.metragemEsperada, f.metragemReal, fmt1(diff), f.situacao, f.ts].join(',');
  }).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'perfilagem-furos.csv';
  a.click();
  URL.revokeObjectURL(url);
});

const EQUIPES_POR_LETRA = {
  A: 'Francisco / Erbisson',
  B: 'Alexandre / Graziel / Bruno',
  C: 'Caíque / Jamerson',
  D: 'Adeilsom / Atos'
};

['data','tecnicos','local','status','observacoes'].forEach(k=>{
  const campo = document.getElementById('turno-'+k);
  if(campo) campo.addEventListener('input', saveTurnoInfo);
});
document.querySelectorAll('#turno-numero-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
    saveTurnoInfo();
  });
});
document.querySelectorAll('#turno-letra-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
    const equipe = EQUIPES_POR_LETRA[chip.dataset.val];
    if(equipe) el('turno-tecnicos').value = equipe;
    saveTurnoInfo();
  });
});
el('lista').addEventListener('change', (e)=>{
  const chk = e.target.closest('.leque-select');
  if(!chk) return;
  toggleSelecaoLeque(chk.dataset.id, chk.checked);
});

el('btn-limpar-selecao').addEventListener('click', limparSelecaoLeques);
el('btn-exportar-selecionados').addEventListener('click', ()=>{
  exportarLequesPDF(Array.from(lequesSelecionados));
});
el('btn-exportar-turno').addEventListener('click', exportarTurnoPDF);

loadTurnoInfo();
loadData();
loadHistoricoExportacoes();

