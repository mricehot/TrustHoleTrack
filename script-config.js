// ---------- Configurações do app, perfil do técnico e relatórios em PDF ----------
// WhatsApp e projeto ativo ficam editáveis na aba Configurações.
const CONFIG_LOCAL_KEY = 'perfilagem-config-app-v1';
let configApp = { whatsapp: '', projetoAtivo: '' };
function carregarConfigLocal(){
  try{
    const raw = localStorage.getItem(CONFIG_LOCAL_KEY);
    if(raw) configApp = { ...configApp, ...JSON.parse(raw) };
    delete configApp.supervisor; // campo removido
  }catch(e){}
}
function salvarConfigLocal(){
  try{ localStorage.setItem(CONFIG_LOCAL_KEY, JSON.stringify(configApp)); }catch(e){}
}
function renderConfig(){
  const campoWhatsapp = el('config-whatsapp');
  if(campoWhatsapp) campoWhatsapp.value = configApp.whatsapp || '';
  renderProjetosConfig();
}
function salvarConfig(){
  configApp.whatsapp = el('config-whatsapp').value.replace(/\D/g, ''); // só dígitos
  salvarConfigLocal();
  showToast('Configurações salvas.');
}
el('btn-salvar-config').addEventListener('click', salvarConfig);
(function iniciarPrefsUx(){
  const t = el('pref-tela'), v = el('pref-vibrar'); if(!t || !v) return;
  t.checked = !!prefsUx.tela; v.checked = !!prefsUx.vibrar;
  t.addEventListener('change', ()=>{ prefsUx.tela = t.checked; salvarPrefsUx(); atualizarWakeLock(); });
  v.addEventListener('change', ()=>{ prefsUx.vibrar = v.checked; salvarPrefsUx(); if(v.checked) vibrarCurto([12, 40, 12]); });
})();

// O filtro de projeto ativo já aplica na hora, sem precisar clicar em
// "Salvar" — é só uma forma de enxergar a lista, não uma configuração
// que precisa de confirmação.
el('anel-projeto-ativo').addEventListener('change', ()=>{
  configApp.projetoAtivo = el('anel-projeto-ativo').value;
  salvarConfigLocal();
  renderAneisMenu();
  preencherSelectsDeProjeto();
  showToast(configApp.projetoAtivo ? `Mostrando só realces de "${configApp.projetoAtivo}".` : 'Mostrando realces de todos os projetos.');
});

// ---------- Perfil do técnico ----------
function renderPerfilTecnico(){
  if(!usuarioAtual) return;
  const campoEmail = el('tecnico-email');
  const campoNome = el('tecnico-nome');
  if(campoEmail) campoEmail.value = usuarioAtual.email || '';
  if(campoNome) campoNome.value = usuarioAtual.nome || '';
  atualizarAvatarEMeuDia();
}

function iniciaisDe(txt){
  const p = String(txt || '').split(/[\s@._-]+/).filter(Boolean);
  if(!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length-1][0] : '')).toUpperCase();
}
function corDoUsuario(txt){
  let h = 0; for(const c of String(txt||'')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38%)`;
}
function atualizarAvatarEMeuDia(){
  if(!usuarioAtual) return;
  const nome = usuarioAtual.nome || usuarioAtual.email || '';
  const ini = iniciaisDe(nome), cor = corDoUsuario(usuarioAtual.email || nome);
  ['menu-avatar','md-avatar'].forEach(id=>{ const a = el(id); if(a){ a.textContent = ini; a.style.background = cor; } });
  const mn = el('menu-nome'); if(mn) mn.textContent = nome;
  const me = el('menu-email'); if(me) me.textContent = usuarioAtual.nome ? (usuarioAtual.email || '') : '';
  const mdn = el('md-nome'); if(mdn) mdn.textContent = nome;
  const hoje = chaveDia(new Date());
  const eu = nomeDoUsuario();
  const meus = checklistFuros;
  const noDia = iso => iso && chaveDia(iso) === hoje;
  const perf = meus.filter(f=>f.perfilado && f.perfiladoPor === eu && noDia(f.perfiladoEm)).length;
  const topo = meus.filter(f=>f.topografado && f.topografadoPor === eu && noDia(f.topografadoEm)).length;
  const obs = meus.filter(f=>f.obstruido && f.obstruidoPor === eu).length;
  [['md-perf',perf],['md-topo',topo],['md-obs',obs]].forEach(([id,v])=>{ const n = el(id); if(n) n.textContent = v; });
  const sub = el('md-sub'); if(sub) sub.textContent = usuarioAtual.email || '';
  const dica = el('md-dica'); if(dica) dica.textContent = (perf + topo + obs) ? 'Contagem das marcações do checklist feitas por você, com seu nome.' : 'Suas marcações do checklist de hoje aparecem aqui.';
}

async function salvarPerfilTecnico(){
  const novoNome = el('tecnico-nome').value.trim();
  const { data, error } = await db.auth.updateUser({ data: { nome: novoNome } });
  if(error){
    showToast(`Não foi possível salvar: ${error.message}`);
    return;
  }
  usuarioAtual.nome = novoNome;
  salvarSessaoCache(usuarioAtual);
  const labelUsuario = el('usuario-logado-label');
  if(labelUsuario) labelUsuario.textContent = `logado: ${usuarioAtual.nome || usuarioAtual.email}`;
  if(typeof aplicarPapel === 'function') aplicarPapel();
  showToast('Nome atualizado.');
}
el('btn-salvar-perfil').addEventListener('click', salvarPerfilTecnico);

async function alterarSenhaTecnico(){
  const novaSenha = el('tecnico-senha-nova').value;
  const confirmar = el('tecnico-senha-confirmar').value;
  const erro = el('tecnico-senha-erro');
  erro.textContent = '';

  if(!novaSenha || novaSenha.length < 6){
    erro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
    return;
  }
  if(novaSenha !== confirmar){
    erro.textContent = 'As duas senhas precisam ser iguais.';
    return;
  }
  const btn = el('btn-alterar-senha');
  btn.disabled = true;
  const { error } = await db.auth.updateUser({ password: novaSenha });
  btn.disabled = false;
  if(error){
    erro.textContent = `Não foi possível alterar: ${error.message}`;
    return;
  }
  el('tecnico-senha-nova').value = '';
  el('tecnico-senha-confirmar').value = '';
  showToast('Senha alterada com sucesso.');
}
el('btn-alterar-senha').addEventListener('click', alterarSenhaTecnico);
['tecnico-senha-nova','tecnico-senha-confirmar'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); alterarSenhaTecnico(); } });
});

function selecionarChip(grupoId, valor){
  document.querySelectorAll('#'+grupoId+' .chip').forEach(chip=>{
    chip.classList.toggle('active', chip.dataset.val === valor);
  });
}

// Converte "DD/MM/AAAA" (formato exibido em tela) para "AAAA-MM-DD" (formato que o
// Postgres/Supabase espera numa coluna `date`). Sem essa conversão, o Postgres tenta
// ler como MM/DD/AAAA e quebra em qualquer dia acima de 12.
function dataBRParaISO(dataBR){
  if(!dataBR) return null;
  const partes = dataBR.split('/');
  if(partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;
}

// Exibe a data sempre como DD/MM/AAAA, aceitando tanto o formato ISO (novos registros)
// quanto o formato BR (registros antigos, salvos antes desta correção).
function dataParaExibicao(data){
  if(!data) return '-';
  const isoMatch = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return data;
}

function editarObservacaoModal(valorAtual, atalhos, titulo){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">${escHtml(titulo || 'Editar observação')}</p>
          <div class="field" style="margin-bottom:16px;">
            <label for="obs-turno-editar-input">Texto</label>
            <input id="obs-turno-editar-input" type="text" maxlength="300" value="${(valorAtual || '').replace(/"/g,'&quot;')}">
          </div>
          ${atalhos && atalhos.length ? `<div class="notas-rapidas" role="group" aria-label="notas rápidas">${atalhos.map(a=>`<button type="button" class="ck-chip nota-rapida">${escHtml(a)}</button>`).join('')}</div>` : ''}
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
      const texto = el('obs-turno-editar-input').value.trim();
      if(!texto){ showToast('A observação não pode ficar em branco.'); return; }
      fechar(texto);
    };
    el('modal-salvar').addEventListener('click', salvar);
    el('obs-turno-editar-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    root.querySelectorAll('.nota-rapida').forEach(b=> b.addEventListener('click', ()=>{
      const inp = el('obs-turno-editar-input'); const v = inp.value.trim();
      if(v.toLowerCase().includes(b.textContent.toLowerCase())) return;
      inp.value = v ? v + '; ' + b.textContent : b.textContent;
    }));
    el('obs-turno-editar-input').focus();
  });
}

function drawHeaderTabelaPDF(doc, y){
  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(PDF_FONT_CABECALHO); doc.setFont(undefined,'bold');
  doc.text('Furo', 17, y);
  doc.text('Esperada', 90, y, { align:'right' });
  doc.text('Real', 122, y, { align:'right' });
  doc.text('Diferenca', 157, y, { align:'right' });
  doc.text('Situacao', 162, y);
  doc.setTextColor(0,0,0);
  return y+8;
}

// Numera todas as páginas do documento no formato "Página X de Y" — só pode
// ser chamada no final, depois que todas as páginas já foram criadas.
function adicionarNumeracaoPaginas(doc){
  const totalPaginas = doc.internal.getNumberOfPages();
  if(totalPaginas <= 1) return;
  for(let i = 1; i <= totalPaginas; i++){
    doc.setPage(i);
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(120);
    doc.text(`Página ${i} de ${totalPaginas}`, 195, 289, { align:'right' });
    doc.setTextColor(0);
  }
}

// Marca d'água da logo (Trust Soluções Geológicas) no canto inferior direito de cada
// página — grande e levemente puxada pra dentro da folha, passando por trás da tabela.
// Precisa ser chamada depois de todo o conteúdo já ter sido desenhado (pinta por cima,
// mas a opacidade baixa faz o efeito de "atrás" sem precisar redesenhar tudo por página).
function adicionarMarcaDaguaPDF(doc){
  const totalPaginas = doc.internal.getNumberOfPages();
  const tamanho = 130; // mm
  const x = 210 - (tamanho * 0.72);
  const y = 297 - (tamanho * 0.72);
  for(let i = 1; i <= totalPaginas; i++){
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.10 }));
    try{ doc.addImage('data:image/png;base64,'+LOGO_MARCA_DAGUA_B64, 'PNG', x, y, tamanho, tamanho); }catch(e){}
    doc.restoreGraphicsState();
  }
}

// Caixa de resumo no topo do relatório combinado — dá a visão geral (quantos leques,
// furos, metros, aproveitamento e qual leque merece mais atenção) sem precisar rolar
// até o fim pra achar o TOTAL GERAL. Devolve o Y logo depois da caixa.
function desenharResumoPDF(doc, y, stats){
  const alturaBox = 34;
  if(y + alturaBox > 275){ doc.addPage(); y = 20; }

  const aproveitamento = stats.totalEsp > 0 ? (stats.totalReal / stats.totalEsp * 100) : 0;
  doc.setDrawColor(200); doc.setLineWidth(0.3);
  doc.rect(15, y, 180, alturaBox);
  doc.setFont(undefined,'bold'); doc.setFontSize(11);
  doc.text('RESUMO', 20, y+8);
  doc.setFont(undefined,'normal'); doc.setFontSize(10);

  const col1 = 20, col2 = 78, col3 = 138;
  doc.text(`Leques perfilados: ${stats.qtdLeques}`, col1, y+17);
  doc.text(`Furos registrados: ${stats.totalFuros}`, col1, y+24);
  doc.text(`Esperada: ${fmt1(stats.totalEsp)} m`, col2, y+17);
  doc.text(`Real: ${fmt1(stats.totalReal)} m`, col2, y+24);

  const varGeral = stats.totalReal - stats.totalEsp;
  doc.setTextColor(...corRGBDiferenca(varGeral));
  doc.text(`Variação: ${diffLabel(varGeral)}`, col3, y+17);
  doc.setTextColor(0,0,0);
  doc.text(`Alertas: ${stats.alertas}`, col3, y+24);

  doc.setFont(undefined,'bold');
  doc.text(`Aproveitamento: ${aproveitamento.toFixed(1)}%`, col1, y+31);
  if(stats.piorLeque){
    doc.setFont(undefined,'normal');
    doc.setTextColor(...corRGBDiferenca(stats.piorLeque.diff));
    const linhaAtencao = doc.splitTextToSize(
      `Leque que mais precisa de atenção: ${stats.piorLeque.codigo} (${diffLabel(stats.piorLeque.diff)}, ${stats.piorLeque.alertas} alerta(s))`,
      108
    );
    doc.text(linhaAtencao, col2, y+31);
    doc.setTextColor(0,0,0);
  }
  return y + alturaBox + 8;
}

// Desenha o cabeçalho comum de qualquer relatório em PDF (logo + título + projeto).
// Devolve a coordenada Y onde o conteúdo específico do relatório deve começar.
async function desenharCabecalhoTurnoPDF(doc, opcoes={}){
  const titulo = opcoes.titulo || 'RELATÓRIO DE PERFILAGEM DE LAVRA';

  try{ doc.addImage('data:image/png;base64,'+R2D_LOGO_B64, 'PNG', 195 - 48, 9, 48, 48 * 216 / 943); }catch(e){} // logos Trust + ERO à direita

  doc.setFontSize(PDF_FONT_TITULO); doc.setFont(undefined,'bold');
  doc.text(titulo, 15, 15, { maxWidth: 128 });
  doc.setFontSize(PDF_FONT_SUBTITULO); doc.setFont(undefined,'normal'); doc.setTextColor(120);
  doc.text('Gerado em ' + (opcoes.titulo ? new Date().toLocaleDateString('pt-BR') : new Date().toLocaleString('pt-BR')), 15, 21); // relatórios de tratamento: só a data
  doc.setTextColor(0);
  doc.setDrawColor(180); doc.line(15, 30, 195, 30);

  doc.setFontSize(PDF_FONT_INFO);
  let y = 38;
  const campos = configApp.projetoAtivo ? [['Projeto:', configApp.projetoAtivo]] : [];
  doc.setFont(undefined,'normal');
  campos.forEach(([label,val])=>{
    doc.text(label, 15, y);
    doc.text(String(val||'-'), 42, y);
    y += 7;
  });

  if(!campos.length) return 38;
  y += 4;
  doc.setDrawColor(180); doc.line(15, y, 195, y); y += 10;
  return y;
}

// Compartilha o PDF como arquivo de verdade (evita cair um link "blob:" no WhatsApp/redes sociais).
// Quando o navegador suporta Web Share API com arquivos, abre o menu nativo de compartilhamento.
// Caso contrário, cai no download tradicional (o arquivo vai para a pasta de Downloads do aparelho).
async function baixarOuCompartilharPDF(doc, nomeArquivo, forcarDownload){
  const blob = doc.output('blob');

  try{
    if(forcarDownload) throw { name:'BaixarDireto' }; // pula o compartilhar e cai no download
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

// ---------- Exportação de PDF: leque único e combinado ----------
// Busca a foto do leque e devolve já em base64 (formato que o jsPDF entende),
// junto com as dimensões reais — pra desenhar no PDF sem esticar/espremer a
// imagem. Se falhar por qualquer motivo (sem sinal na hora de exportar, etc.),
// devolve null e o relatório continua normal, só sem a foto.
async function carregarImagemParaPDF(url){
  try{
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('falha ao buscar imagem');
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dimensoes = await new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=> resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = ()=> resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dimensoes };
  }catch(e){
    return null;
  }
}

// Desenha a foto no PDF a partir da posição y atual, mantendo a proporção
// (nunca estica/espreme), dentro de um tamanho máximo razoável de página —
// com moldura e legenda, pra parecer parte do relatório e não só uma imagem
// flutuando sem contexto. Devolve o novo y, já depois da foto.
async function desenharFotoLequePDF(doc, fotoUrl, y, legendaTexto){
  const foto = await carregarImagemParaPDF(fotoUrl);
  if(!foto) return y;
  const larguraMax = 100, alturaMax = 70;
  let largura = larguraMax, altura = larguraMax * (foto.h / foto.w);
  if(altura > alturaMax){ altura = alturaMax; largura = alturaMax * (foto.w / foto.h); }
  if(y + altura + 8 > 275){ doc.addPage(); y = 20; }
  try{
    const formato = foto.dataUrl.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.rect(15, y, largura, altura);
    doc.addImage(foto.dataUrl, formato, 15, y, largura, altura);
    y += altura + 5;
    if(legendaTexto){
      doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(legendaTexto, 15, y);
      doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
      y += 3;
    }
    return y + 8;
  }catch(e){
    return y;
  }
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

  let y = await desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
  doc.text('Realce: ' + (a ? a.nome : '-'), 15, y); y += 7;
  doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 8;
  y += 2;

  if(l.fotoUrl) y = await desenharFotoLequePDF(doc, l.fotoUrl, y, 'Foto do leque ' + lequeCode(l));

  // A tabela de perfilagem sempre começa numa página nova — assim ela nunca
  // fica cortada pela metade entre o resumo/foto (página 1) e os dados (página 2+).
  doc.addPage();
  y = 20;
  y = drawHeaderTabelaPDF(doc, y);
  doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

  furosDoLeque.forEach(f=>{
    if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    doc.setTextColor(0,0,0);
    doc.text(furoCode(l,f), 17, y);
    doc.text(fmt1(Number(f.metragemEsperada))+' m', 90, y, { align:'right' });
    doc.text(fmt1(Number(f.metragemReal))+' m', 122, y, { align:'right' });
    doc.setTextColor(...corRGBDiferenca(diff));
    doc.text(diffLabel(diff), 157, y, { align:'right' });
    doc.setTextColor(...corRGBSituacao(f.situacao));
    doc.text(situacaoLabel(f.situacao), 162, y);
    doc.setTextColor(0,0,0);
    if(f.observacao){
      y += 5.5;
      if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
      doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text('obs: ' + f.observacao, 20, y);
      doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); doc.setTextColor(0,0,0);
      y += 3;
    }
    doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
    y += 8;
  });

  y += 6;
  if(y > 268){ doc.addPage(); y = 20; }
  const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const varTotal = totalReal - totalEsp;
  const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
  doc.text('Total: ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 17, y);
  doc.setTextColor(0,0,0);

  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);

  const nomeArquivo = (lequeCode(l) + '_' + (a?a.nome:'realce')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  showToast('PDF de ' + lequeCode(l) + ' exportado.');
}

async function exportarLequesPDF(ids, opcoes){
  const baixar = !!(opcoes && opcoes.baixar);
  if(!ids || ids.length === 0){ showToast('Selecione ao menos um leque para exportar.'); return; }
  let selecionados = leques.filter(l=>ids.includes(l.id));
  if(selecionados.length === 0){ showToast('Nenhum leque válido selecionado.'); return; }
  selecionados = [...selecionados].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = await desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_AVISO); doc.setFont(undefined,'normal');
  const linhasInclusos = doc.splitTextToSize(
    'Leques inclusos (' + selecionados.length + '): ' + selecionados.map(l=>lequeCode(l)).join(', '),
    180
  );
  doc.text(linhasInclusos, 15, y);
  y += linhasInclusos.length * 7 + 6;

  // Pré-calcula os furos e totais de cada leque uma única vez — usado tanto no
  // resumo do topo quanto nas tabelas individuais, sem recalcular duas vezes.
  const statsLeques = selecionados.map(l=>{
    let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
    furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));
    const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
    const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
    const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;
    return { leque: l, furosDoLeque, totalEsp, totalReal, alertas, varTotal: totalReal - totalEsp };
  });

  let totalGeralEsp = 0, totalGeralReal = 0, totalGeralFuros = 0, alertasGeral = 0;
  let piorLeque = null;
  statsLeques.forEach(s=>{
    totalGeralEsp += s.totalEsp;
    totalGeralReal += s.totalReal;
    totalGeralFuros += s.furosDoLeque.length;
    alertasGeral += s.alertas;
    if(!piorLeque || s.varTotal < piorLeque.diff){
      piorLeque = { codigo: lequeCode(s.leque), diff: s.varTotal, alertas: s.alertas };
    }
  });

  y = desenharResumoPDF(doc, y, {
    qtdLeques: selecionados.length, totalFuros: totalGeralFuros,
    totalEsp: totalGeralEsp, totalReal: totalGeralReal, alertas: alertasGeral, piorLeque
  });

  for(const [idx, { leque: l, furosDoLeque, totalEsp, totalReal, alertas, varTotal }] of statsLeques.entries()){
    const a = aneis.find(x=>x.id===l.anelId);

    if(y > 250){ doc.addPage(); y = 20; }

    doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
    doc.text('Realce: ' + (a ? a.nome : '-'), 15, y); y += 7;
    doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 8;
    y += 2;

    if(l.fotoUrl) y = await desenharFotoLequePDF(doc, l.fotoUrl, y, 'Foto do leque ' + lequeCode(l));

    // Garante espaço pro cabeçalho da tabela + pelo menos 1 linha antes de
    // desenhar — sem isso, o cabeçalho podia ficar "órfão" sozinho numa página
    // (sem nenhuma linha depois) quando sobrava só um pouquinho de espaço.
    if(y + 16 > 273){ doc.addPage(); y = 20; }
    y = drawHeaderTabelaPDF(doc, y);
    doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

    furosDoLeque.forEach(f=>{
      if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
      const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
      doc.setTextColor(0,0,0);
      doc.text(furoCode(l,f), 17, y);
      doc.text(fmt1(Number(f.metragemEsperada))+' m', 90, y, { align:'right' });
      doc.text(fmt1(Number(f.metragemReal))+' m', 122, y, { align:'right' });
      doc.setTextColor(...corRGBDiferenca(diff));
      doc.text(diffLabel(diff), 157, y, { align:'right' });
      doc.setTextColor(...corRGBSituacao(f.situacao));
      doc.text(situacaoLabel(f.situacao), 162, y);
      doc.setTextColor(0,0,0);
      if(f.observacao){
        y += 5.5;
        if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
        doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(110);
        doc.text('obs: ' + f.observacao, 20, y);
        doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); doc.setTextColor(0,0,0);
        y += 3;
      }
      doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
      y += 8;
    });

    y += 6;
    if(y > 268){ doc.addPage(); y = 20; }
    doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
    doc.text('Subtotal ' + lequeCode(l) + ': ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);
    y += 10;

    if(idx < selecionados.length - 1){
      doc.setDrawColor(200); doc.line(15, y, 195, y);
      y += 8;
    }
  }

  if(y > 255){ doc.addPage(); y = 20; }
  y += 2;
  doc.setDrawColor(25,18,49); doc.setLineWidth(0.6); doc.line(15, y, 195, y); doc.setLineWidth(0.2); y += 9;
  const varGeral = totalGeralReal - totalGeralEsp;
  doc.setFont(undefined,'bold');
  const textoTotalGeral = 'TOTAL GERAL (' + selecionados.length + ' leque(s)): ' + totalGeralFuros + ' furo(s)  |  Esperada: ' + fmt1(totalGeralEsp) + ' m  |  Real: ' + fmt1(totalGeralReal) + ' m  |  Variacao: ' + diffLabel(varGeral) + '  |  Alertas: ' + alertasGeral;

  // Encolhe a fonte só o suficiente pra caber numa linha só (até um piso legível de 8.5pt).
  // Só quebra em duas linhas se, mesmo no menor tamanho, o texto ainda não couber.
  let fonteTotalGeral = PDF_FONT_TOTAL;
  doc.setFontSize(fonteTotalGeral);
  while(doc.getTextWidth(textoTotalGeral) > 180 && fonteTotalGeral > 8.5){
    fonteTotalGeral -= 0.5;
    doc.setFontSize(fonteTotalGeral);
  }

  const linhasTotal = doc.splitTextToSize(textoTotalGeral, 180);
  if(y + linhasTotal.length * 6 > 285){ doc.addPage(); y = 20; }
  doc.text(linhasTotal, 15, y);

  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);

  const nomeArquivo = ('Relatorio_' + selecionados.map(l=>lequeCode(l)).join('-')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo, baixar);
  showToast('PDF combinado com ' + selecionados.length + ' leque(s) exportado.');
  limparSelecaoLeques();
}

