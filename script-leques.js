// ---------- Anéis (menu separado) ----------
function renderAneisMenu(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  el('anel-menu-current').textContent = anelAtivo ? `ativo: ${anelAtivo.nome}` : 'nenhum realce ativo';

  const filtroProjeto = configApp.projetoAtivo;
  const aneisFiltrados = filtroProjeto ? aneis.filter(a=>a.projeto===filtroProjeto) : aneis;

  const avisoFiltro = el('anel-filtro-projeto-aviso');
  if(avisoFiltro){
    if(filtroProjeto){
      avisoFiltro.style.display = 'block';
      const ocultos = aneis.length - aneisFiltrados.length;
      avisoFiltro.textContent = ocultos > 0
        ? `${ocultos} realce(s) de outro(s) projeto(s) escondido(s) — troque o "Projeto ativo" acima pra ver todos.`
        : '';
      if(ocultos === 0) avisoFiltro.style.display = 'none';
    }else{
      avisoFiltro.style.display = 'none';
    }
  }

  const lista = el('anel-list');
  if(aneis.length === 0){
    lista.innerHTML = htmlEstadoVazio('Nenhum realce criado', 'Crie o primeiro realce no campo acima para começar.', '', '', 'realce');
    return;
  }
  if(aneisFiltrados.length === 0){
    lista.innerHTML = `<div class="hint">Nenhum realce do projeto "${escHtml(filtroProjeto)}" ainda. Troque o filtro em Config, ou crie um realce associado a esse projeto.</div>`;
    return;
  }
  lista.innerHTML = aneisFiltrados.map(a=>{
    const ativo = a.id === anelAtivoId;
    const itensA = checklistDoAnel(a.id);
    const idsA = new Set(itensA.map(c=>c.id));
    const furosA = checklistFuros.filter(f=>idsA.has(f.checklistLequeId));
    const pctA = furosA.length ? Math.round(furosA.filter(f=>f.perfilado && f.topografado || f.obstruido).length / furosA.length * 100) : 0;
    const estA = !itensA.length ? 'ini' : pctA >= 100 ? 'ok' : (furosA.some(f=>f.perfilado||f.topografado||f.obstruido) ? 'and' : 'ini');
    const icoA = { ok:'✓', and:'◐', ini:'○' }[estA];
    return `
      <div class="anel-row ${ativo?'ativo':''}" data-anel-id="${a.id}" data-est="${estA}">
        <span class="nome"><i class="lq-ico" data-est="${estA}" aria-hidden="true">${icoA}</i>${escHtml(a.nome)}</span>
        ${a.nivel ? `<span class="hint">${escHtml(a.nivel)}</span>` : ''}
        ${ativo ? '<span class="badge-ativo" title="o realce ativo é individual: só vale pra você">ativo p/ você</span>' : ''}
        ${realceChecklistCompleto(a.id) ? '<span class="badge-completo" title="todos os leques do checklist estão completos">✓ 100%</span>' : ''}
        <span class="spacer"></span>
        ${!ativo ? `<button class="ghost" onclick="usarAnel('${a.id}')">Usar este realce</button>` : ''}
        <button class="icon" onclick="toggleOcultoWhatsapp('${a.id}')" title="${a.ocultoWhatsapp ? 'oculto na lista de WhatsApp — clique pra mostrar' : 'visível na lista de WhatsApp — clique pra ocultar'}">${a.ocultoWhatsapp
          ? '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          : '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        }</button>
        <button class="icon icon-editar" onclick="editarAnel('${a.id}')" title="editar realce">✎</button>
        <button class="icon icon-remover" onclick="removerAnel('${a.id}')" title="remover realce">✕</button>
        ${itensA.length ? `<div class="lq-barra anel-barra" role="img" aria-label="${pctA}% concluído"><i style="width:${pctA}%"></i><span>${pctA}% · ${itensA.length} leque${itensA.length===1?'':'s'}</span></div>` : ''}
      </div>
    `;
  }).join('');
}

function usarAnel(id){
  definirAnelAtivo(id);
  salvarLocal();
  renderAll();
  showToast('Realce ativo alterado.');
  mostrarView('perfilagem');
}

function toggleOcultoWhatsapp(id){
  const a = aneis.find(x=>x.id===id);
  if(!a) return;
  a.ocultoWhatsapp = !a.ocultoWhatsapp;
  enfileirar('aneis', 'update', { id: a.id, oculto_whatsapp: a.ocultoWhatsapp });
  salvarLocal();
  renderAll();
  showToast(a.ocultoWhatsapp ? `"${a.nome}" agora fica oculto na lista de WhatsApp.` : `"${a.nome}" volta a aparecer na lista de WhatsApp.`);
}

async function removerAnel(id){
  const a = aneis.find(x=>x.id===id);
  if(!a) return;
  const lequesDoAnel = leques.filter(l=>l.anelId===id);
  const furosDoAnel = furos.filter(f=>lequesDoAnel.some(l=>l.id===f.lequeId));
  const msg = `Remover o realce "${a.nome}", ${lequesDoAnel.length} leque(s) e ${furosDoAnel.length} furo(s)?`;
  if(!(await confirmDialog(msg, 'Remover'))) return;

  const anelRemovido = { ...a };
  const lequesRemovidos = lequesDoAnel.map(l=>({ ...l }));
  const furosRemovidos = furosDoAnel.map(f=>({ ...f }));
  const eraAnelAtivo = anelAtivoId === id;

  aneis = aneis.filter(x=>x.id!==id);
  leques = leques.filter(l=>l.anelId!==id);
  furos = furos.filter(f=>!lequesDoAnel.some(l=>l.id===f.lequeId));

  lequesRemovidos.forEach(l=> removerDaFila('leques', l.id));
  furosRemovidos.forEach(f=> removerDaFila('furos', f.id));
  enfileirar('aneis', 'delete', { id });

  if(eraAnelAtivo){
    const restante = aneis[0];
    if(restante) definirAnelAtivo(restante.id);
    else anelAtivoId = null;
  }
  salvarLocal();
  renderAll();
  showToast(`Realce "${a.nome}" removido.`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoAnel(anelRemovido, lequesRemovidos, furosRemovidos, eraAnelAtivo)
  });
}

function desfazerRemocaoAnel(anelRemovido, lequesRemovidos, furosRemovidos, eraAnelAtivo){
  if(aneis.some(a=>a.id===anelRemovido.id)) return; // já foi restaurado

  aneis.push(anelRemovido);
  restaurarNaFila('aneis', anelRemovido.id, { id: anelRemovido.id, nome: anelRemovido.nome, ativo: anelRemovido.ativo, nivel: anelRemovido.nivel, empresa_id: anelRemovido.empresaId });

  lequesRemovidos.forEach(l=>{
    leques.push(l);
    restaurarNaFila('leques', l.id, {
      id: l.id, anel_id: l.anelId, tipo: l.tipo, numero: l.numero, nome: l.nome,
      status: l.status, orientacao: l.orientacao, turno_numero: l.turnoNumero,
      turno_letra: l.turnoLetra, criado_por: l.criadoPor, foto_url: l.fotoUrl
    });
  });

  furosRemovidos.forEach(f=>{
    furos.push(f);
    restaurarNaFila('furos', f.id, {
      id: f.id, leque_id: f.lequeId, numero: f.numero, metragem_esperada: f.metragemEsperada,
      metragem_real: f.metragemReal, situacao: f.situacao, observacao: f.observacao, precisa_refazer: f.precisaRefazer
    });
  });

  if(eraAnelAtivo){ anelAtivoId = anelRemovido.id; gravarRealceAtivoDoUsuario(anelRemovido.id); }
  salvarLocal();
  renderAll();
  showToast(`Realce "${anelRemovido.nome}" restaurado.`);
}

function editAnelModal(anel){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Editar realce</p>
          <div class="field" style="margin-bottom:14px;">
            <label for="edit-anel-nome">Nome</label>
            <input id="edit-anel-nome" type="text" value="${escHtml(anel.nome)}">
          </div>
          <div class="field" style="margin-bottom:16px;">
            <label for="edit-anel-nivel">Nível</label>
            <input id="edit-anel-nivel" type="text" value="${anel.nivel || ''}" placeholder="ex: N-125 TR6733">
          </div>
          <div class="field" style="margin-bottom:16px;">
            <label for="edit-anel-projeto">Projeto</label>
            <select id="edit-anel-projeto">
              <option value="">sem projeto</option>
              ${projetos.map(p=> `<option value="${escHtml(p.nome)}" ${anel.projeto===p.nome ? 'selected' : ''}>${escHtml(p.nome)}</option>`).join('')}
            </select>
          </div>
          <label class="field pref-linha" style="margin-bottom:16px;">
            <input id="edit-anel-oculto-whatsapp" type="checkbox" ${anel.ocultoWhatsapp ? 'checked' : ''}>
            <span>Ocultar da lista de envio por WhatsApp (ex: realce já finalizado)</span>
          </label>
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
      const nome = el('edit-anel-nome').value.trim();
      const nivel = el('edit-anel-nivel').value.trim();
      const projeto = el('edit-anel-projeto').value;
      const ocultoWhatsapp = el('edit-anel-oculto-whatsapp').checked;
      if(!nome){ showToast('Preencha o nome do realce.'); return; }
      fechar({ nome, nivel, projeto, ocultoWhatsapp });
    };
    el('modal-salvar').addEventListener('click', salvar);
    el('edit-anel-nome').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
  });
}

function editarAnel(id){
  const a = aneis.find(x=>x.id===id);
  if(!a) return;
  editAnelModal(a).then(resultado=>{
    if(!resultado) return;
    if(aneis.some(x=>x.id!==id && x.nome.toLowerCase()===resultado.nome.toLowerCase())){
      showToast(`Já existe um realce chamado "${resultado.nome}".`);
      return;
    }
    a.nome = resultado.nome;
    a.nivel = resultado.nivel;
    a.projeto = resultado.projeto;
    a.ocultoWhatsapp = resultado.ocultoWhatsapp;
    enfileirar('aneis', 'update', { id: a.id, nome: a.nome, nivel: a.nivel, projeto: a.projeto, oculto_whatsapp: a.ocultoWhatsapp });
    if(a.id === anelAtivoId) sincronizarLocalComNivelDoAnel();
    salvarLocal();
    renderAll();
    showToast(`Realce "${a.nome}" atualizado.`);
  });
}

function criarAnel(){
  const campoNome = el('anel-nome');
  const nome = campoNome.value.trim();
  const nivel = el('anel-nivel').value.trim();
  // Não pergunta o projeto de novo aqui — o realce nasce direto no projeto
  // ativo escolhido em Config (se nenhum estiver ativo, nasce sem projeto).
  const projeto = configApp.projetoAtivo || '';
  campoNome.style.borderColor = '';
  el('anel-erro').textContent = '';
  if(!nome) return;
  if(aneis.some(a=>a.nome.toLowerCase() === nome.toLowerCase())){
    campoNome.style.borderColor = 'var(--rust)';
    el('anel-erro').textContent = `Já existe um realce chamado "${nome}". Escolha outro nome ou use o existente na lista abaixo.`;
    showToast('Já existe um realce com esse nome.');
    return;
  }
  const novoId = uuidv4();
  aneis.push({ id: novoId, nome, ativo: false, nivel, projeto, ocultoWhatsapp: false });
  anelAtivoId = novoId;
  if(el('f-tipo')) el('f-tipo').value = '';
  if(el('f-situacao')) el('f-situacao').value = '';
  if(el('f-busca')) el('f-busca').value = '';
  sincronizarLocalComNivelDoAnel();
  enfileirar('aneis', 'insert', { id: novoId, nome, ativo: false, nivel, projeto });
  // o FK exige o realce já gravado; o upsert tem debounce, então chega depois do insert
  gravarRealceAtivoDoUsuario(novoId);
  campoNome.value = '';
  el('anel-nivel').value = '';
  salvarLocal();
  renderAll();
  showToast('Realce criado e definido como seu realce ativo.');
  mostrarView('perfilagem');
}
el('btn-criar-anel').addEventListener('click', criarAnel);
el('anel-nome').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarAnel(); } });

// ---------- Breadcrumb + painel de trabalho ----------
function renderBreadcrumb(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const bc = el('breadcrumb');
  if(!anelAtivo){
    bc.innerHTML = `<span class="warn">Nenhum realce ativo — clique na aba "Realce" e crie ou selecione um.</span>`;
    return;
  }
  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
  bc.innerHTML = `Realce <b>${escHtml(anelAtivo.nome)}</b>` +
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

  const formLeque = el('form-leque');
  const boxAtual = el('leque-atual-box');
  if(lequeAberto){
    formLeque.style.display = 'none';
    el('leque-panel-title').textContent = 'Medição em andamento';
    const furosDoLeque = furos.filter(f=>f.lequeId===lequeAberto.id);
    const podeFinalizar = souDonoDoLeque(lequeAberto);
    boxAtual.innerHTML = `
      <div class="leque-atual">
        <span class="code">${lequeCode(lequeAberto)}</span>
        <span>${tipoLabel(lequeAberto.tipo)}${lequeAberto.nome ? ' · '+escHtml(lequeAberto.nome) : ''}</span>
        <span class="hint">${furosDoLeque.length} furo(s) registrados</span>
        <span class="spacer"></span>
        ${podeFinalizar
          ? `<button class="danger" onclick="finalizarLeque('${lequeAberto.id}')">Finalizar leque</button>`
          : ''}
      </div>
    `;
  }else{
    formLeque.style.display = '';
    el('leque-panel-title').textContent = 'Criar Medição';
    el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value);
    boxAtual.innerHTML = '';
  }

  atualizarFaixaLeque(lequeAberto);
  const semLeque = !lequeAberto;
  ['furo-numero','furo-esperada','furo-real','furo-situacao','furo-observacao','btn-add-furo'].forEach(id=> el(id).disabled = semLeque);
  document.querySelectorAll('#furo-situacao-botoes button').forEach(b=> b.disabled = semLeque);
  el('furo-hint').style.display = semLeque ? 'block' : 'none';
}

el('btn-escolher-foto-leque').addEventListener('click', ()=> el('leque-foto-input').click());
el('leque-foto-input').addEventListener('change', ()=>{
  const arquivo = el('leque-foto-input').files[0];
  el('leque-foto-nome-arquivo').textContent = arquivo ? `✓ ${arquivo.name}` : '';
});

function criarLeque(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo) return;
  const tipo = el('leque-tipo').value;
  const numero = normalizarNumero(el('leque-numero').value.trim());
  if(!numero) return;
  const duplicado = leques.some(l=>l.anelId===anelAtivo.id && l.tipo===tipo && l.numero===numero);
  if(duplicado){
    showToast(`Já existe ${PREFIXO[tipo]}${numero} neste realce.`);
    return;
  }
  const chipOrientacao = document.querySelector('#leque-orientacao-group .chip.active');
  const orientacao = chipOrientacao ? chipOrientacao.dataset.val : 'ascendente';
  const chipLetraLeque = document.querySelector('#leque-letra-group .chip.active');
  const letraQuemPerfilou = chipLetraLeque ? chipLetraLeque.dataset.val : (turnoInfo.turnoLetra || null);
  const novoId = uuidv4();
  const nome = el('leque-nome').value.trim() || null;
  const criadoPor = usuarioAtual ? usuarioAtual.id : null;
  const novoLeque = {
    id: novoId, anelId: anelAtivo.id, tipo, numero, nome, status: 'aberto', orientacao,
    turnoNumero: turnoInfo.turnoNumero || null, turnoLetra: letraQuemPerfilou, criadoPor, fotoUrl: null
  };
  leques.push(novoLeque);
  CARDS_NOVOS.add(novoId);
  enfileirar('leques', 'insert', {
    id: novoId, anel_id: anelAtivo.id, tipo, numero, nome, status: 'aberto', orientacao,
    turno_numero: novoLeque.turnoNumero, turno_letra: novoLeque.turnoLetra, criado_por: criadoPor
  });

  const arquivoFoto = el('leque-foto-input').files[0];
  if(arquivoFoto) enviarFotoLeque(novoLeque, arquivoFoto);
  el('leque-foto-input').value = '';
  el('leque-foto-nome-arquivo').textContent = '';

  el('leque-numero').value = '';
  el('leque-nome').value = '';
  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(novoLeque)} criado e aberto.`);
}
el('btn-add-leque').addEventListener('click', criarLeque);
el('leque-tipo').addEventListener('change', ()=>{ el('btn-add-leque').textContent = tipoBotaoLabel(el('leque-tipo').value); });
document.querySelectorAll('#leque-letra-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
  });
});
document.querySelectorAll('#leque-orientacao-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#leque-orientacao-group .chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
  });
});
['leque-numero','leque-nome'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); criarLeque(); } });
});

async function finalizarLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  if(!souDonoDoLeque(l)){
    showToast('Só quem criou este leque pode finalizá-lo.');
    return;
  }
  const qtd = furos.filter(f=>f.lequeId===id).length;
  if(!(await confirmDialog(`Finalizar o leque ${lequeCode(l)}${qtd ? ' com '+qtd+' furo(s)' : ' sem nenhum furo'}? Você poderá reabri-lo depois se precisar.`, 'Finalizar'))) return;
  l.status = 'fechado';
  enfileirar('leques', 'update', { id: l.id, status: 'fechado' });
  salvarLocal();
  renderAll();
  brilharBorda(document.querySelector(`.leque-group[data-leque-id="${l.id}"]`), true);
  showToast(`Leque ${lequeCode(l)} finalizado.`);
}

async function reabrirLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  if(!souDonoDoLeque(l)){
    showToast('Só quem criou este leque pode reabri-lo.');
    return;
  }
  const outroAberto = lequeAbertoDoAnel(l.anelId);
  if(outroAberto && outroAberto.id !== l.id){
    if(!(await confirmDialog(`O leque ${lequeCode(outroAberto)} está aberto neste realce. Finalizá-lo e reabrir ${lequeCode(l)}?`, 'Reabrir'))) return;
    outroAberto.status = 'fechado';
    enfileirar('leques', 'update', { id: outroAberto.id, status: 'fechado' });
  }
  l.status = 'aberto';
  enfileirar('leques', 'update', { id: l.id, status: 'aberto' });
  salvarLocal();
  renderAll();
  brilharBorda(document.querySelector(`.leque-group[data-leque-id="${l.id}"]`), false, '#e0a21b');
  showToast(`Leque ${lequeCode(l)} reaberto.`);
}

// Furos de produção raramente passam de uns 30-40m — acima disso é bem provável
// que seja erro de digitação (ex: "90" em vez de "9.0", ou um zero sobrando).
// Não bloqueia — só confirma antes de salvar, pra pegar o typo sem travar quem
// realmente tem um furo fora do padrão.
const LIMITE_METRAGEM_SUSPEITA = 50;
function metragemPareceEstranha(valor){
  return valor > LIMITE_METRAGEM_SUSPEITA;
}
async function confirmarMetragemSuspeita(metragemEsperada, metragemReal){
  if(!metragemPareceEstranha(metragemEsperada) && !metragemPareceEstranha(metragemReal)) return true;
  const maior = Math.max(metragemEsperada, metragemReal);
  return confirmDialog(
    `${fmt1(maior)}m é bem mais que o normal — confere se não faltou um ponto decimal (ex: "90" em vez de "9.0") antes de continuar.`,
    'Salvar assim mesmo'
  );
}

async function adicionarFuro(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo) return;
  const lequeAberto = lequeAbertoDoAnel(anelAtivo.id);
  if(!lequeAberto) return;
  const numero = normalizarNumero(el('furo-numero').value.trim());
  if(!numero) return;
  const duplicado = furos.some(f=>f.lequeId===lequeAberto.id && f.numero===numero);
  if(duplicado){
    showToast(`Já existe o furo ${lequeCode(lequeAberto)}F${numero} neste leque.`);
    return;
  }
  const metragemEsperada = parseFloat(el('furo-esperada').value);
  const metragemReal = parseFloat(el('furo-real').value);
  if(isNaN(metragemEsperada) || isNaN(metragemReal)) return;
  if(!(await confirmarMetragemSuspeita(metragemEsperada, metragemReal))) return;
  const situacao = el('furo-situacao').value;
  const observacao = el('furo-observacao').value.trim();

  const novoId = uuidv4();
  const novoFuro = { id: novoId, lequeId: lequeAberto.id, numero, metragemEsperada, metragemReal, situacao, observacao, precisaRefazer: false, ts: new Date().toISOString() };
  furos.push(novoFuro);
  enfileirar('furos', 'insert', {
    id: novoId, leque_id: lequeAberto.id, numero, metragem_esperada: metragemEsperada, metragem_real: metragemReal, situacao, observacao
  });

  el('furo-numero').value = '';
  el('furo-esperada').value = '';
  el('furo-real').value = '';
  el('furo-observacao').value = '';
  el('furo-situacao').value = 'livre';
  sincronizarSituacaoBotoes(); atualizarDiferencaFuro();
  el('furo-numero').focus();
  salvarLocal();
  renderAll();
  showToast(`Furo ${furoCode(lequeAberto, novoFuro)} registrado.`);
}
el('btn-add-furo').addEventListener('click', adicionarFuro);
// Enter pula pro próximo campo (como Tab) em vez de tentar salvar toda hora —
// antes, apertar Enter em "Número" já tentava enviar o furo e falhava calado
// porque Esperada/Real ainda estavam vazios.
const ORDEM_CAMPOS_FURO = ['furo-numero','furo-esperada','furo-real'];
ORDEM_CAMPOS_FURO.forEach((id, i)=>{
  el(id).addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const proximo = ORDEM_CAMPOS_FURO[i+1];
    if(proximo) el(proximo).focus();
    else adicionarFuro();
  });
});

// Restaura um furo removido. Se a exclusão ainda estava só na fila local (nunca
// chegou a sincronizar), simplesmente cancela ela — o furo no servidor nem chegou
// a ser tocado. Só faz um "insert" novo se realmente não tinha mais nada pendente
// pra cancelar (furo criado e removido na mesma sessão, por exemplo).
// Restaura algo apagado, do jeito seguro pra fila de sincronização: se a exclusão
// ainda estava só pendente localmente (nunca chegou a sincronizar), simplesmente
// cancela ela — o registro no servidor nem foi tocado. Só manda um "insert" novo
// se realmente não tinha mais nada pra cancelar (criado e removido na mesma sessão).
// Usada pelo "Desfazer" — como não há mais fila, a remoção já foi enviada
// (ou tentada) na hora em que aconteceu, então desfazer sempre significa
// recriar o registro no servidor, nunca "cancelar" algo que ainda não saiu.
function restaurarNaFila(tabela, id, payloadInsert){
  enfileirar(tabela, 'insert', payloadInsert);
}

function desfazerRemocaoFuro(furoRemovido){
  if(furos.some(f=>f.id===furoRemovido.id)) return; // já foi restaurado (ex: clique duplo)
  furos.push(furoRemovido);
  restaurarNaFila('furos', furoRemovido.id, {
    id: furoRemovido.id, leque_id: furoRemovido.lequeId, numero: furoRemovido.numero,
    metragem_esperada: furoRemovido.metragemEsperada, metragem_real: furoRemovido.metragemReal,
    situacao: furoRemovido.situacao, observacao: furoRemovido.observacao, precisa_refazer: furoRemovido.precisaRefazer
  });
  salvarLocal();
  renderAll();
  showToast('Remoção desfeita.');
}

async function removerFuro(id){
  const f = furos.find(x=>x.id===id);
  const l = f ? leques.find(x=>x.id===f.lequeId) : null;
  if(!souDonoDoLeque(l)){
    showToast('Só quem criou este leque pode remover os furos dele.');
    return;
  }
  if(!f) return;
  const codigo = l ? furoCode(l, f) : `furo nº ${f.numero}`;
  if(!(await confirmDialog(`Remover o furo ${codigo}?`, 'Remover'))) return;

  const furoRemovido = { ...f }; // cópia, pra dar pra restaurar se a pessoa clicar em "Desfazer"
  furos = furos.filter(f=>f.id!==id);
  enfileirar('furos', 'delete', { id });
  salvarLocal();
  renderAll();

  showToast(`Furo ${codigo} removido.`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoFuro(furoRemovido)
  });
}

async function removerLeque(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  if(!souDonoDoLeque(l)){
    showToast('Só quem criou este leque pode removê-lo.');
    return;
  }
  const furosDoLeque = furos.filter(f=>f.lequeId===id);
  const qtd = furosDoLeque.length;
  if(!(await confirmDialog(`Remover o leque ${lequeCode(l)} e seus ${qtd} furo(s)?`, 'Remover'))) return;

  const lequeRemovido = { ...l };
  const furosRemovidos = furosDoLeque.map(f=>({ ...f }));

  leques = leques.filter(x=>x.id!==id);
  furos = furos.filter(f=>f.lequeId!==id);
  furosDoLeque.forEach(f=> removerDaFila('furos', f.id));
  enfileirar('leques', 'delete', { id });

  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(l)} removido.`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoLeque(lequeRemovido, furosRemovidos)
  });
}

function desfazerRemocaoLeque(lequeRemovido, furosRemovidos){
  if(leques.some(l=>l.id===lequeRemovido.id)) return; // já foi restaurado
  leques.push(lequeRemovido);
  restaurarNaFila('leques', lequeRemovido.id, {
    id: lequeRemovido.id, anel_id: lequeRemovido.anelId, tipo: lequeRemovido.tipo,
    numero: lequeRemovido.numero, nome: lequeRemovido.nome, status: lequeRemovido.status,
    orientacao: lequeRemovido.orientacao, turno_numero: lequeRemovido.turnoNumero,
    turno_letra: lequeRemovido.turnoLetra, criado_por: lequeRemovido.criadoPor, foto_url: lequeRemovido.fotoUrl
  });

  furosRemovidos.forEach(f=>{
    furos.push(f);
    restaurarNaFila('furos', f.id, {
      id: f.id, leque_id: f.lequeId, numero: f.numero, metragem_esperada: f.metragemEsperada,
      metragem_real: f.metragemReal, situacao: f.situacao, observacao: f.observacao, precisa_refazer: f.precisaRefazer
    });
  });

  salvarLocal();
  renderAll();
  showToast(`Leque ${lequeCode(lequeRemovido)} e ${furosRemovidos.length} furo(s) restaurados.`);
}

function mapProjeto(row){ return { id: row.id, nome: row.nome, ts: row.criado_em }; }
function carregarProjetosLocal(){
  try{
    const raw = localStorage.getItem(PROJETOS_LOCAL_KEY);
    projetos = raw ? JSON.parse(raw) : [];
  }catch(e){ projetos = []; }
}
function salvarProjetosLocal(){
  try{ localStorage.setItem(PROJETOS_LOCAL_KEY, JSON.stringify(projetos)); }catch(e){}
}

// Preenche os dois seletores de projeto (criar realce + editar realce, esse
// segundo só quando o modal estiver aberto) com a lista atual.
function preencherSelectsDeProjeto(){
  // O seletor de projeto ativo já está logo acima, na mesma tela — esse
  // aviso só confirma qual projeto o novo realce vai herdar.
  const avisoAoCriar = el('anel-projeto-ativo-aviso');
  if(avisoAoCriar){
    avisoAoCriar.textContent = configApp.projetoAtivo
      ? `Vai ser criado no projeto ativo: "${configApp.projetoAtivo}".`
      : `Nenhum projeto ativo escolhido acima — vai ser criado sem projeto associado.`;
  }
  const selectAtivo = el('anel-projeto-ativo');
  if(selectAtivo){
    selectAtivo.innerHTML = `<option value="">Todos os projetos</option>` +
      projetos.map(p=> `<option value="${escHtml(p.nome)}" ${configApp.projetoAtivo===p.nome ? 'selected' : ''}>${escHtml(p.nome)}</option>`).join('');
  }
}

function renderProjetosConfig(){
  const lista = el('config-projetos-list');
  const vazio = el('config-projetos-vazio');
  if(!lista) return;
  if(projetos.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
  }else{
    if(vazio) vazio.style.display = 'none';
    lista.innerHTML = projetos.map(p=>`
      <div class="obs-item">
        <span class="texto">${escHtml(p.nome)}</span>
        <button class="icon icon-remover" onclick="removerProjeto('${p.id}')" title="remover">✕</button>
      </div>
    `).join('');
  }
  preencherSelectsDeProjeto();
}

function adicionarProjeto(){
  const campo = el('config-novo-projeto-input');
  const nome = campo.value.trim();
  if(!nome) return;
  if(projetos.some(p=>p.nome.toLowerCase()===nome.toLowerCase())){
    showToast('Já existe um projeto com esse nome.');
    return;
  }
  const novoId = uuidv4();
  projetos.push({ id: novoId, nome, ts: new Date().toISOString() });
  enfileirar('projetos', 'insert', { id: novoId, nome });
  campo.value = '';
  campo.focus();
  salvarProjetosLocal();
  renderProjetosConfig();
  showToast('Projeto adicionado.');
}
el('btn-add-projeto').addEventListener('click', adicionarProjeto);
el('config-novo-projeto-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); adicionarProjeto(); } });

async function removerProjeto(id){
  const p = projetos.find(x=>x.id===id);
  if(!p) return;
  const emUso = aneis.some(a=>a.projeto===p.nome);
  const aviso = emUso
    ? `Remover o projeto "${p.nome}"? Ele ainda está associado a algum realce — remover aqui não muda os realces já criados, só deixa de aparecer como opção nova.`
    : `Remover o projeto "${p.nome}"?`;
  if(!(await confirmDialog(aviso, 'Remover'))) return;
  projetos = projetos.filter(x=>x.id!==id);
  // as equipes (e a produtividade lançada) do projeto saem junto
  const equipesDoProj = equipes.filter(e=>e.projeto===p.nome);
  if(equipesDoProj.length){
    const ids = new Set(equipesDoProj.map(e=>e.id));
    equipes = equipes.filter(e=>!ids.has(e.id));
    lancamentosProd = lancamentosProd.filter(r=>!ids.has(r.equipeId));
    equipesDoProj.forEach(e=> enfileirar('equipes', 'delete', { id: e.id }));
    salvarEquipesLocal(); salvarProdutividadeLocal();
  }
  enfileirar('projetos', 'delete', { id });
  salvarProjetosLocal();
  renderProjetosConfig();
  showToast('Projeto removido.', {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoProjeto(p)
  });
}

function desfazerRemocaoProjeto(projetoRemovido){
  if(projetos.some(p=>p.id===projetoRemovido.id)) return; // já foi restaurado
  projetos.push(projetoRemovido);
  restaurarNaFila('projetos', projetoRemovido.id, { id: projetoRemovido.id, nome: projetoRemovido.nome });
  salvarProjetosLocal();
  renderProjetosConfig();
  showToast('Projeto restaurado.');
}

function mapAnel(row){ return { id: row.id, nome: row.nome, ativo: row.ativo, nivel: row.nivel || '', projeto: row.projeto || '', empresaId: row.empresa_id || null, ocultoWhatsapp: !!row.oculto_whatsapp }; }
function mapLeque(row){ return { id: row.id, anelId: row.anel_id, tipo: row.tipo, numero: row.numero, nome: row.nome, status: row.status, orientacao: row.orientacao || 'ascendente', turnoNumero: row.turno_numero, turnoLetra: row.turno_letra, criadoPor: row.criado_por || null, fotoUrl: row.foto_url || null }; }
function mapChecklistLeque(row){ return { id: row.id, anelId: row.anel_id, tipo: row.tipo, numero: row.numero, perfilado: !!row.perfilado, observacao: row.observacao || '', localizacao: row.localizacao || '', perfiladoPor: row.perfilado_por || '', ordem: row.ordem != null ? Number(row.ordem) : null, equipePerfId: row.equipe_perfilagem_id || null, equipeTopoId: row.equipe_topografia_id || null, observacao: row.observacao || '', ts: row.criado_em }; }
function mapChecklistFuro(row){ return { id: row.id, checklistLequeId: row.checklist_leque_id, numero: row.numero, perfilado: !!row.perfilado, topografado: !!row.topografado, metragem: row.metragem != null ? Number(row.metragem) : null, perfiladoEm: row.perfilado_em || null, topografadoEm: row.topografado_em || null, obstruido: row.obstruido || '', perfiladoPor: row.perfilado_por || '', topografadoPor: row.topografado_por || '', obstruidoPor: row.obstruido_por || '', equipePerfId: row.equipe_perfilagem_id || null, equipeTopoId: row.equipe_topografia_id || null, equipeObsId: row.equipe_obstrucao_id || null, observacao: row.observacao || '', ts: row.criado_em }; }

function carregarChecklistLocal(){
  try{
    const raw = localStorage.getItem(CHECKLIST_LOCAL_KEY);
    checklistLeques = raw ? JSON.parse(raw) : [];
  }catch(e){ checklistLeques = []; }
}
function salvarChecklistLocal(){
  try{ localStorage.setItem(CHECKLIST_LOCAL_KEY, JSON.stringify(checklistLeques)); }catch(e){}
}
function carregarChecklistFurosLocal(){
  try{
    const raw = localStorage.getItem(CHECKLIST_FUROS_LOCAL_KEY);
    checklistFuros = raw ? JSON.parse(raw) : [];
  }catch(e){ checklistFuros = []; }
}
function salvarChecklistFurosLocal(){
  try{ localStorage.setItem(CHECKLIST_FUROS_LOCAL_KEY, JSON.stringify(checklistFuros)); }catch(e){}
}
function checklistFurosDoLeque(checklistLequeId){
  return checklistFuros
    .filter(f=>f.checklistLequeId===checklistLequeId)
    .sort((a,b)=> a.numero.localeCompare(b.numero, undefined, {numeric:true}));
}

function mapObservacaoGeralChecklist(row){ return { id: row.id, anelId: row.anel_id, texto: row.texto, ts: row.criado_em }; }
function carregarChecklistObsGeralLocal(){
  try{
    const raw = localStorage.getItem(CHECKLIST_OBS_GERAL_LOCAL_KEY);
    checklistObservacoesGerais = raw ? JSON.parse(raw) : [];
  }catch(e){ checklistObservacoesGerais = []; }
}
function salvarChecklistObsGeralLocal(){
  try{ localStorage.setItem(CHECKLIST_OBS_GERAL_LOCAL_KEY, JSON.stringify(checklistObservacoesGerais)); }catch(e){}
}
function checklistObsGeraisDoAnel(anelId){
  return checklistObservacoesGerais
    .filter(o=>o.anelId===anelId)
    .sort((a,b)=> new Date(a.ts) - new Date(b.ts));
}

function renderObservacoesGeraisChecklist(){
  const lista = el('checklist-obs-geral-list');
  const vazio = el('checklist-obs-geral-vazio');
  if(!lista) return;
  const obs = anelAtivoId ? checklistObsGeraisDoAnel(anelAtivoId) : [];
  if(obs.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';
  lista.innerHTML = obs.map(o=>`
    <div class="obs-item">
      <span class="texto">${escHtml(o.texto)}</span>
      <button class="icon icon-editar" onclick="editarObservacaoGeralChecklist('${o.id}')" title="editar">✎</button>
      <button class="icon icon-remover" onclick="removerObservacaoGeralChecklist('${o.id}')" title="remover">✕</button>
    </div>
  `).join('');
}

function adicionarObservacaoGeralChecklist(){
  if(!anelAtivoId){ showToast('Selecione um realce primeiro.'); return; }
  const campo = el('checklist-obs-geral-input');
  const texto = campo.value.trim();
  if(!texto) return;
  const novoId = uuidv4();
  const novaObs = { id: novoId, anelId: anelAtivoId, texto, ts: new Date().toISOString() };
  checklistObservacoesGerais.push(novaObs);
  enfileirar('checklist_observacoes_gerais', 'insert', { id: novoId, anel_id: anelAtivoId, texto });
  campo.value = '';
  campo.focus();
  salvarChecklistObsGeralLocal();
  renderObservacoesGeraisChecklist();
  showToast('Observação geral adicionada.');
}
el('btn-add-checklist-obs-geral').addEventListener('click', adicionarObservacaoGeralChecklist);
el('checklist-obs-geral-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); adicionarObservacaoGeralChecklist(); } });

async function editarObservacaoGeralChecklist(id){
  const o = checklistObservacoesGerais.find(x=>x.id===id);
  if(!o) return;
  const novoTexto = await editarObservacaoModal(o.texto);
  if(novoTexto === null || novoTexto === o.texto) return;
  o.texto = novoTexto;
  enfileirar('checklist_observacoes_gerais', 'update', { id: o.id, texto: novoTexto });
  salvarChecklistObsGeralLocal();
  renderObservacoesGeraisChecklist();
  showToast('Observação atualizada.');
}

async function removerObservacaoGeralChecklist(id){
  const o = checklistObservacoesGerais.find(x=>x.id===id);
  if(!o) return;
  if(!(await confirmDialog('Remover esta observação geral?', 'Remover'))) return;
  checklistObservacoesGerais = checklistObservacoesGerais.filter(x=>x.id!==id);
  enfileirar('checklist_observacoes_gerais', 'delete', { id });
  salvarChecklistObsGeralLocal();
  renderObservacoesGeraisChecklist();
  showToast('Observação removida.', {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoObservacaoGeralChecklist(o)
  });
}

function desfazerRemocaoObservacaoGeralChecklist(obsRemovida){
  if(checklistObservacoesGerais.some(o=>o.id===obsRemovida.id)) return; // já foi restaurado
  checklistObservacoesGerais.push(obsRemovida);
  restaurarNaFila('checklist_observacoes_gerais', obsRemovida.id, {
    id: obsRemovida.id, anel_id: obsRemovida.anelId, texto: obsRemovida.texto
  });
  salvarChecklistObsGeralLocal();
  renderObservacoesGeraisChecklist();
  showToast('Observação restaurada.');
}

// Leques na ordem em que foram colocados no checklist (não em ordem alfabética).
// Leques criados juntos (mesma faixa, enviados em paralelo ao servidor) chegam com
// horários quase iguais e embaralhados; por isso, os que ficaram a menos de 0,4 s
// um do outro contam como um mesmo "lote" e dentro dele vão em ordem numérica.
function ordenarPorInsercao(lista){
  const comTempo = lista.map((c, i)=> ({ c, i, t: c.ts ? new Date(c.ts).getTime() : 0 }))
    .sort((a, b)=> (a.t - b.t) || (a.i - b.i));
  let lote = 0, anterior = null;
  comTempo.forEach(x=>{
    if(anterior !== null && x.t - anterior > 400) lote++;
    x.lote = lote;
    anterior = x.t;
  });
  comTempo.sort((a, b)=> (a.lote - b.lote)
    || (a.c.tipo + a.c.numero).localeCompare(b.c.tipo + b.c.numero, undefined, {numeric:true})
    || (a.t - b.t) || (a.i - b.i));
  return comTempo.map(x=>x.c);
}
// Ordem final: quem já foi posicionado à mão (campo "ordem") vem primeiro, na
// ordem escolhida; leques novos (sem ordem) entram depois, na ordem em que foram criados.
function checklistDoAnel(anelId){
  const base = ordenarPorInsercao(checklistLeques.filter(c=>c.anelId===anelId));
  const fixos = base.filter(c=>c.ordem != null).sort((a,b)=> a.ordem - b.ordem);
  if(!fixos.length) return base;
  return fixos.concat(base.filter(c=>c.ordem == null));
}

// ---------- Reorganizar a sequência dos leques (arrastar ou ▲▼) ----------
let arrastandoChecklist = false;
// ids = nova ordem dos leques de UMA lista (um grupo de localização, ou a lista toda).
// Os demais leques mantêm suas posições; só as vagas ocupadas por esses ids são reembaralhadas.
function aplicarNovaOrdemChecklist(ids){
  const todos = checklistDoAnelAtivo();
  const conjunto = new Set(ids);
  const posicoes = [];
  todos.forEach((c, i)=>{ if(conjunto.has(c.id)) posicoes.push(i); });
  if(posicoes.length !== ids.length) return false;
  const novo = todos.slice();
  posicoes.forEach((pos, k)=>{ novo[pos] = checklistLeques.find(c=>c.id===ids[k]); });
  let mudou = 0;
  novo.forEach((c, i)=>{
    if(c.ordem !== i){
      c.ordem = i; mudou++;
      enfileirar('checklist_leques', 'update', { id: c.id, ordem: i });
    }
  });
  if(mudou){ salvarChecklistLocal(); }
  return mudou > 0;
}
function moverLequeChecklist(id, delta){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  const local = (c.localizacao||'').trim();
  const lista = filtrarItensChecklist(checklistDoAnelAtivo()).filter(x=> (x.localizacao||'').trim() === local);
  const i = lista.findIndex(x=>x.id===id), j = i + delta;
  if(i < 0 || j < 0 || j >= lista.length){ showToast(delta < 0 ? 'Já é o primeiro desta lista.' : 'Já é o último desta lista.'); return; }
  const ids = lista.map(x=>x.id);
  ids.splice(j, 0, ids.splice(i, 1)[0]);
  const posAntes = posicoesCards();
  aplicarNovaOrdemChecklist(ids);
  renderChecklist();
  animarTrocaCards(posAntes);
  const cartao = document.getElementById('ck-card-' + id);
  if(cartao) cartao.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
// Arrastar pela alça ⠿: funciona com dedo e mouse (pointer events), com rolagem automática.
function iniciarArrasteChecklist(ev, id){
  if(ev.button != null && ev.button !== 0) return;
  const alca = ev.currentTarget;
  const card = document.getElementById('ck-card-' + id);
  const lista = card && card.parentElement;
  if(!card || !lista) return;
  ev.preventDefault(); ev.stopPropagation();
  arrastandoChecklist = true;
  const idsAntes = [...lista.querySelectorAll(':scope > .checklist-leque-card')].map(x=>x.id.replace('ck-card-',''));
  const rect0 = card.getBoundingClientRect();
  const pegada = ev.clientY - rect0.top;
  let ultimoY = ev.clientY;
  card.classList.add('arrastando'); lista.classList.add('em-arraste');
  try{ alca.setPointerCapture(ev.pointerId); }catch(e){}
  vibrarCurto(15);

  const posicionar = ()=>{
    card.style.transform = 'none';
    const natural = card.getBoundingClientRect();
    card.style.transform = `translateY(${ultimoY - pegada - natural.top}px)`;
    const centro = ultimoY - pegada + natural.height / 2;
    const irmaos = [...lista.querySelectorAll(':scope > .checklist-leque-card')];
    const idx = irmaos.indexOf(card);
    const ant = irmaos[idx - 1], prox = irmaos[idx + 1];
    if(ant){ const r = ant.getBoundingClientRect(); if(centro < r.top + r.height/2){ lista.insertBefore(ant, card.nextSibling); return posicionar(); } }
    if(prox){ const r = prox.getBoundingClientRect(); if(centro > r.top + r.height/2){ lista.insertBefore(prox, card); return posicionar(); } }
  };
  let rolagem = null;
  const aoMover = e=>{
    ultimoY = e.clientY;
    posicionar();
    clearInterval(rolagem);
    if(e.clientY < 90) rolagem = setInterval(()=>{ window.scrollBy(0,-14); posicionar(); }, 16);
    else if(e.clientY > window.innerHeight - 130) rolagem = setInterval(()=>{ window.scrollBy(0,14); posicionar(); }, 16);
  };
  const terminar = ()=>{
    clearInterval(rolagem);
    window.removeEventListener('pointermove', aoMover);
    window.removeEventListener('pointerup', terminar);
    window.removeEventListener('pointercancel', terminar);
    card.classList.remove('arrastando'); lista.classList.remove('em-arraste'); card.style.transform = '';
    arrastandoChecklist = false;
    const idsDepois = [...lista.querySelectorAll(':scope > .checklist-leque-card')].map(x=>x.id.replace('ck-card-',''));
    if(idsDepois.join() !== idsAntes.join()){
      aplicarNovaOrdemChecklist(idsDepois);
      showToast('Sequência dos leques alterada.');
    }
    renderChecklist();
  };
  // O cartão arrastado nunca sai do DOM (só os vizinhos mudam de lugar) — assim o
  // dedo/mouse não perde a captura do ponteiro no meio do arraste.
  window.addEventListener('pointermove', aoMover);
  window.addEventListener('pointerup', terminar);
  window.addEventListener('pointercancel', terminar);
}
function checklistDoAnelAtivo(){
  return checklistDoAnel(anelAtivoId);
}

// Realces dentro do escopo atual — respeita o "Projeto ativo" já usado na
// aba Realce. Sem projeto escolhido, o escopo é todos os realces.
function aneisNoEscopoAtual(){
  return configApp.projetoAtivo ? aneis.filter(a=>a.projeto===configApp.projetoAtivo) : aneis;
}

// Todos os furos do checklist dentro do escopo atual (realces do projeto
// ativo, ou todos os realces se nenhum projeto estiver escolhido) — é a
// base de dados usada pelo Infográfico.
function checklistFurosNoEscopoAtual(){
  const idsAneis = new Set(aneisNoEscopoAtual().map(a=>a.id));
  const idsLeques = new Set(checklistLeques.filter(c=>idsAneis.has(c.anelId)).map(c=>c.id));
  return checklistFuros.filter(f=>idsLeques.has(f.checklistLequeId));
}

// Número na aba Checklist: quantos leques do realce ativo ainda têm furo (não obstruído) por
// perfilar ou topografar. Dá pra ver o que falta sem abrir a tela.
function atualizarContadorAbaChecklist(){
  const aba = document.querySelector('.tab-item[data-view="checklist"]'); if(!aba) return;
  let n = 0;
  try{
    checklistDoAnelAtivo().forEach(c=>{
      const fl = checklistFurosDoLeque(c.id).filter(f=>!f.obstruido);
      if(fl.some(f=>!f.perfilado || !f.topografado)) n++;
    });
  }catch(e){}
  let sel = aba.querySelector('.tab-badge');
  if(!sel){ sel = document.createElement('span'); sel.className = 'tab-badge'; aba.querySelector('.tab-icon').appendChild(sel); }
  sel.textContent = n > 99 ? '99+' : String(n);
  sel.hidden = n === 0;
  aba.setAttribute('aria-label', n ? `Checklist, ${n} leque(s) com pendência` : 'Checklist');
}

// Produção por equipe no realce aberto: furos perfilados/topografados (total e de hoje).
function renderChecklistPorEquipe(furosDoRealce){
  const box = el('checklist-por-equipe'); if(!box) return;
  const hoje = dataISOLocal(new Date());
  const ehHoje = v=> v && dataISOLocal(new Date(v)) === hoje;
  const mapa = new Map();
  const linha = id=>{ if(!mapa.has(id)) mapa.set(id, { p:0, ph:0, t:0, th:0 }); return mapa.get(id); };
  furosDoRealce.forEach(f=>{
    if(f.perfilado){ const id = equipePerfEfetivaId(f); if(id && nomeDaEquipeId(id)){ const l = linha(id); l.p++; if(ehHoje(f.perfiladoEm)) l.ph++; } }
    if(f.topografado){ const id = equipeTopoEfetivaId(f); if(id && nomeDaEquipeId(id)){ const l = linha(id); l.t++; if(ehHoje(f.topografadoEm)) l.th++; } }
  });
  if(!mapa.size){ box.hidden = true; box.innerHTML = ''; return; }
  const ordem = equipes.filter(e=>mapa.has(e.id));
  box.hidden = false;
  box.innerHTML = `<div class="ck-pe-titulo">Por equipe neste realce</div>` + ordem.map(e=>{
    const l = mapa.get(e.id);
    return `<div class="ck-pe-linha" style="--eq-cor:${corDaEquipe(e)}"><span class="ck-pe-nome">${marcaDaEquipe(e)}${escHtml(e.nome)}</span><span class="ck-pe-num">Perf. <b>${l.p}</b>${l.ph ? ` <small>(+${l.ph} hoje)</small>` : ''}</span><span class="ck-pe-num">Topo <b>${l.t}</b>${l.th ? ` <small>(+${l.th} hoje)</small>` : ''}</span></div>`;
  }).join('');
}
function renderChecklist(){
  atualizarContadorAbaChecklist();
  const grid = el('checklist-grid');
  const vazio = el('checklist-vazio');
  const progresso = el('checklist-progresso');
  if(!grid) return;
  renderObservacoesGeraisChecklist();
  const itens = checklistDoAnelAtivo();
  if(progresso){
    const feitos = itens.filter(c=>c.perfilado).length;
    progresso.textContent = `${feitos}/${itens.length} perfilados`;
  }

  // Progresso geral de furos — soma os furos de TODOS os leques do checklist
  // nesse realce (não só dos que estão expandidos na tela).
  const idsLequesChecklist = new Set(itens.map(c=>c.id));
  const todosFurosDoRealce = checklistFuros.filter(f=>idsLequesChecklist.has(f.checklistLequeId));

  const nomeRealceEl = el('checklist-realce-nome');
  if(nomeRealceEl){
    const a = aneis.find(x=>x.id===anelAtivoId);
    nomeRealceEl.textContent = a ? a.nome : 'Sem realce ativo';
    const lq = el('checklist-realce-leques');
    if(lq) lq.textContent = itens.length ? `${itens.filter(c=>c.perfilado).length}/${itens.length} leques` : '';
  }
  const textoFurosBarra = el('checklist-progresso-furos-texto');
  const barraFuros = el('checklist-progresso-furos-barra');
  if(textoFurosBarra && barraFuros){
    const furosFeitosNoRealce = todosFurosDoRealce.filter(f=>f.perfilado).length;
    const totalFurosNoRealce = todosFurosDoRealce.length;
    const percentual = totalFurosNoRealce > 0 ? Math.round((furosFeitosNoRealce / totalFurosNoRealce) * 100) : 0;
    textoFurosBarra.textContent = `${furosFeitosNoRealce}/${totalFurosNoRealce} · ${percentual}%`;
    barraFuros.style.width = percentual + '%';
  }

  const textoTopoBarra = el('checklist-progresso-topo-texto');
  const barraTopo = el('checklist-progresso-topo-barra');
  if(textoTopoBarra && barraTopo){
    const topografadosNoRealce = todosFurosDoRealce.filter(f=>f.topografado).length;
    const totalFurosNoRealce = todosFurosDoRealce.length;
    const percentual = totalFurosNoRealce > 0 ? Math.round((topografadosNoRealce / totalFurosNoRealce) * 100) : 0;
    textoTopoBarra.textContent = `${topografadosNoRealce}/${totalFurosNoRealce} · ${percentual}%`;
    barraTopo.style.width = percentual + '%';
  }

  renderChecklistPorEquipe(todosFurosDoRealce);

  const detAdicionar = el('checklist-adicionar');
  const grupoFerr = el('ck-ferr-topo');
  if(grupoFerr && !grupoFerr.dataset.tocado && grupoFerr.open !== (itens.length === 0)){ grupoFerr.dataset.prog = '1'; grupoFerr.open = itens.length === 0; }
  if(detAdicionar && !detAdicionar.dataset.tocado && detAdicionar.open !== (itens.length === 0)){
    detAdicionar.dataset.prog = '1'; // abertura automática: não conta como escolha do usuário
    detAdicionar.open = itens.length === 0;
  }
  const contObs = el('checklist-obs-geral-contagem');
  if(contObs) contObs.textContent = checklistObsGeraisDoAnel(anelAtivoId).length || '';
  renderSugestoesLocalChecklist(itens);

  if(itens.length === 0){
    grid.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    el('checklist-filtros').style.display = 'none';
    renderBarraLoteChecklist([]);
    return;
  }
  if(vazio) vazio.style.display = 'none';
  el('checklist-filtros').style.display = '';

  const visiveis = filtrarItensChecklist(itens);
  renderFiltrosChecklist(itens);
  window.__ckVisiveisIds = visiveis.map(c=>c.id);

  if(visiveis.length === 0){
    grid.innerHTML = '<div class="hint" style="margin-top:12px;">Nenhum leque com esse filtro. Toque em "Todos" para ver a lista completa.</div>';
    renderBarraLoteChecklist(visiveis);
    return;
  }

  const temLocal = visiveis.some(c=>(c.localizacao||'').trim());
  if(!temLocal){
    grid.innerHTML = `<div class="ck-lista">${visiveis.map(c=>htmlCardChecklist(c, false)).join('')}</div>`;
  }else{
    const grupos = new Map();
    visiveis.forEach(c=>{
      const k = (c.localizacao||'').trim();
      if(!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(c);
    });
    const chaves = [...grupos.keys()]; // ordem em que cada localização apareceu pela primeira vez
    window.__ckGrupos = chaves;
    grid.innerHTML = chaves.map((k, idx)=>{
      const lista = grupos.get(k);
      const chave = anelAtivoId + '|' + k;
      const fechado = checklistGruposFechados.has(chave);
      const feitos = lista.filter(c=>c.perfilado).length;
      return `
        <div class="ck-grupo">
          <button type="button" class="ck-grupo-cab" onclick="alternarGrupoChecklist(${idx})" aria-expanded="${fechado ? 'false' : 'true'}">
            <span class="seta">${fechado ? '▸' : '▾'}</span>
            <span>${k ? escHtml(k) : 'Sem localização'}</span>
            <span class="resumo">${feitos}/${lista.length} perfilados</span>
          </button>
          ${fechado ? '' : `<div class="ck-lista">${lista.map(c=>htmlCardChecklist(c, !!k)).join('')}</div>`}
        </div>`;
    }).join('');
  }
  renderBarraLoteChecklist(visiveis);
  aplicarEntradaCards();
  renderPainelTurno();
}



// ---------- Aba Perfilagem: situação em botões, diferença ao vivo, faixa fixa do leque aberto ----------
function sincronizarSituacaoBotoes(){
  const v = el('furo-situacao').value;
  document.querySelectorAll('#furo-situacao-botoes button').forEach(b=>{
    const on = b.dataset.val === v;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
document.querySelectorAll('#furo-situacao-botoes button').forEach(b=> b.addEventListener('click', ()=>{
  el('furo-situacao').value = b.dataset.val; sincronizarSituacaoBotoes(); vibrarCurto(10);
}));
sincronizarSituacaoBotoes();

// Diferença entre real e esperada: até 5% da esperada = ok, até 15% = atenção, acima = fora.
function atualizarDiferencaFuro(){
  const box = el('furo-diferenca'); if(!box) return;
  const esp = parseFloat(el('furo-esperada').value), real = parseFloat(el('furo-real').value);
  if(isNaN(esp) || isNaN(real)){ box.hidden = true; return; }
  const dif = Math.round((real - esp) * 100) / 100;
  const pct = esp > 0 ? Math.abs(dif) / esp * 100 : 0;
  const nivel = pct <= 5 ? 'ok' : pct <= 15 ? 'atencao' : 'fora';
  const sinal = dif > 0 ? '+' : dif < 0 ? '−' : '';
  const txt = dif === 0 ? 'Real igual à esperada' : `${dif > 0 ? 'Passou' : 'Faltou'} ${fmt1(Math.abs(dif))} m (${sinal}${Math.round(pct)}%) em relação à esperada`;
  box.hidden = false; box.dataset.nivel = nivel;
  box.innerHTML = `<span class="dif-ico" aria-hidden="true">${nivel==='ok' ? '✓' : nivel==='atencao' ? '!' : '⚠'}</span><span>${txt}</span>`;
}
['furo-esperada','furo-real'].forEach(id=> el(id).addEventListener('input', atualizarDiferencaFuro));

function atualizarFaixaLeque(lequeAberto){
  const f = el('leque-faixa'); if(!f) return;
  if(!lequeAberto){ f.hidden = true; f.innerHTML = ''; return; }
  const fl = furos.filter(x=>x.lequeId === lequeAberto.id);
  const metros = fl.reduce((t,x)=> t + (x.metragemReal || 0), 0);
  const esperados = fl.reduce((t,x)=> t + (x.metragemEsperada || 0), 0);
  const vara = fl.filter(x=>x.situacao === 'varado').length;
  const obs = fl.filter(x=>x.situacao === 'obstruido').length;
  const dif = metros - esperados;
  f.hidden = false;
  f.innerHTML = `<b class="fx-cod">${lequeCode(lequeAberto)}</b>
    <span><b>${fl.length}</b> furo${fl.length===1?'':'s'}</span>
    <span><b>${fmt1(metros)}</b> m reais</span>
    ${fl.length ? `<span class="fx-dif" data-sinal="${dif>=0?'mais':'menos'}">${dif>=0?'+':'−'}${fmt1(Math.abs(dif))} m vs esperado</span>` : ''}
    ${vara ? `<span class="fx-sit varado">${vara} varado${vara===1?'':'s'}</span>` : ''}
    ${obs ? `<span class="fx-sit obstruido">${obs} obstruído${obs===1?'':'s'}</span>` : ''}`;
}
