// ---------- Filtros + lista/histórico ----------
function render(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  const lequesDoAtivo = anelAtivo ? leques.filter(l=>l.anelId===anelAtivo.id) : [];
  const idsLequesAtivo = new Set(lequesDoAtivo.map(l=>l.id));
  const furosDoAtivo = furos.filter(f=>idsLequesAtivo.has(f.lequeId));

  const totalReal = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const totalEsperada = furosDoAtivo.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const variacao = totalReal - totalEsperada;

  el('readout-label').textContent = anelAtivo ? `realce ativo: ${anelAtivo.nome}` : 'nenhum realce ativo';
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
    lista.innerHTML = htmlEstadoVazio('Nenhum realce criado', 'Crie o primeiro realce para começar a registrar leques e furos.', 'Ir para Realce', "mostrarView('aneis')", 'realce');
    return;
  }

  if(!anelAtivo){
    lista.innerHTML = htmlEstadoVazio('Nenhum realce ativo', 'Escolha qual realce você está perfilando agora.', 'Escolher realce', "mostrarView('aneis')", 'realce');
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

      const podeEditar = souDonoDoLeque(l);
      const todosFurosL = furos.filter(f=>f.lequeId===l.id);
      const nObsL = todosFurosL.filter(f=>f.situacao==='obstruido').length;
      const estL = l.status === 'aberto' ? 'and' : (!todosFurosL.length ? 'ini' : (obstrucaoAlta(nObsL, todosFurosL.length) ? 'obs' : 'ok'));
      const ROT_EST_P = { and:'aberto', ok:'fechado', obs:'fechado com obstruções', ini:'sem furos' };
      const ICO_EST_P = { and:'◐', ok:'✓', obs:'⚠', ini:'○' };
      const pctMetros = totalEspL > 0 ? Math.min(100, Math.round(totalRealL / totalEspL * 100)) : 0;

      const rows = furosDoLeque.map(f=>{
        const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
        return `
        <tr>
          <td class="c-furo"><span class="status-dot ${f.situacao}" onclick="ciclarSituacaoFuro('${f.id}')" title="clique pra mudar a situação"></span>${furoCode(l,f)}${f.precisaRefazer ? '<span class="badge-refazer" title="precisa ser refeito">refazer</span>' : ''}</td>
          <td class="c-esp" data-l="Esperada">${fmt1(Number(f.metragemEsperada))} m</td>
          <td class="c-real" data-l="Real">${fmt1(Number(f.metragemReal))} m</td>
          <td class="diff c-var ${diffClass(diff)}" data-l="Variação">${diffLabel(diff)}</td>
          <td class="c-sit"><span class="sit-chip sit-${f.situacao}"><i aria-hidden="true">${{livre:'✓',obstruido:'⛔',varado:'◎'}[f.situacao]||'•'}</i>${situacaoLabel(f.situacao)}</span></td>
          <td class="actions">
            <button class="icon icon-refazer ${f.precisaRefazer ? 'ativo' : ''}" onclick="toggleRefazerFuro('${f.id}')" title="${f.precisaRefazer ? 'desmarcar — já não precisa mais refazer' : 'marcar que precisa ser refeito'}"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
            <button class="icon icon-editar" onclick="editarFuro('${f.id}')" title="editar">✎</button>
            <button class="icon icon-remover" onclick="removerFuro('${f.id}')" title="remover">✕</button>
          </td>
        </tr>
        ${f.observacao ? `
        <tr class="linha-obs">
          <td colspan="6">obs: ${escHtml(f.observacao)}</td>
        </tr>` : ''}`;
      }).join('');

      const colapsado = lequesColapsados.has(l.id);
      const selecionado = lequesSelecionados.has(l.id);

      return `
        <div class="leque-group ${l.status === 'aberto' ? 'aberto' : ''} ${selecionado ? 'selecionado' : ''}" data-leque-id="${l.id}" data-est="${estL}" title="Leque ${ROT_EST_P[estL]}">
          <div class="leque-head">
            <div class="leque-head-line1">
              <label class="leque-select-wrap" title="selecionar para exportação combinada">
                <input type="checkbox" class="leque-select" data-id="${l.id}" ${selecionado ? 'checked' : ''}>
              </label>
              <button class="icon toggle-leque" onclick="toggleLeque('${l.id}')" title="${colapsado ? 'expandir' : 'minimizar'}">${colapsado ? '▸' : '▾'}</button>
              <div class="fan">${fanSVG(furosDoLeque, l.orientacao)}</div>
              ${l.fotoUrl ? `<a href="${l.fotoUrl}" target="_blank" rel="noopener"><img class="foto-leque-mini" src="${l.fotoUrl}" alt="foto do leque ${lequeCode(l)}" title="ver foto em tamanho maior"></a>` : ''}
              <span class="code">${lequeCode(l)}</span>
              <span class="badge-tipo ${l.tipo}">${tipoLabel(l.tipo)}</span>
              <span class="badge-orientacao ${l.orientacao}" title="orientação do leque">${l.orientacao === 'descendente' ? '↓ Descendente' : '↑ Ascendente'}</span>
              <span class="status ${l.status}"><i class="lq-ico" data-est="${estL}" aria-hidden="true">${ICO_EST_P[estL]}</i>${l.status === 'aberto' ? 'aberto' : 'fechado'}</span>
              ${l.nome ? `<span class="hint">${escHtml(l.nome)}</span>` : ''}
              ${(l.turnoNumero || l.turnoLetra) ? `<span class="hint" title="turno que abriu este leque">Turno ${l.turnoNumero || '-'}${l.turnoLetra || ''}${TECNICOS_POR_LETRA[l.turnoLetra] ? ' · ' + TECNICOS_POR_LETRA[l.turnoLetra] : ''}</span>` : ''}
            </div>
            <div class="leque-head-line2">
              <div class="stats">
                <div><b>${furosDoLeque.length}</b> furos</div>
                <div><b>${fmt1(totalEspL)}</b> m esp.</div>
                <div><b>${fmt1(totalRealL)}</b> m real</div>
                <div class="${varL < 0 ? 'neg' : (varL > 0 ? 'pos' : '')}"><b>${diffLabel(varL)}</b> var.</div>
                ${alertasL ? `<div><b>${alertasL}</b> alertas</div>` : ''}
              </div>
              ${totalEspL > 0 ? `<div class="lq-barra" title="${pctMetros}% da metragem esperada" role="img" aria-label="${pctMetros}% da metragem esperada"><i style="width:${pctMetros}%"></i></div>` : ''}
              <div class="leque-actions">
                ${podeEditar ? `<button class="icon icon-editar" onclick="editarLeque('${l.id}')" title="editar leque">✎ editar</button>` : ''}
                <button class="icon" onclick="exportarLequePDF('${l.id}')" title="exportar PDF deste leque sozinho">⬇ PDF</button>
                ${podeEditar ? `
                <div class="menu-mais-wrap">
                  <button class="icon" onclick="toggleMenuLeque(event, '${l.id}')" title="mais ações">⋮</button>
                  <div class="menu-mais" id="menu-mais-${l.id}">
                    <button onclick="selecionarFotoLeque('${l.id}')"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l2-3h7l2 3H21a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>${l.fotoUrl ? 'Trocar foto' : 'Adicionar foto'}</button>
                    ${l.fotoUrl ? `<button class="perigo" onclick="removerFotoLeque('${l.id}')"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Remover foto</button>` : ''}
                    ${l.status === 'fechado' ? `<button onclick="reabrirLeque('${l.id}')"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Reabrir leque</button>` : ''}
                    <button class="perigo" onclick="removerLeque('${l.id}')">✕ Remover leque</button>
                  </div>
                </div>` : ''}
              </div>
            </div>
          </div>
          ${colapsado ? '' : (furosDoLeque.length ? `
<div class="tabela-wrap">
<table>
            <thead><tr><th>Furo</th><th>Esperada</th><th>Real</th><th>Variação</th><th>Situação</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div> ` : `<div class="sem-furos">Nenhum furo registrado neste leque ainda.</div>`)}
        </div>
      `;
    }).join('');

    if(gruposHTML.trim()){
      algumConteudo = true;
      html += `
        <div class="anel-section">
          <div class="anel-section-head"><b>${escHtml(a.nome)}</b></div>
          <div class="ck-legenda" aria-label="legenda dos estados dos leques"><span><i class="and">◐</i>Aberto</span><span><i class="ok">✓</i>Fechado</span><span><i class="obs">⚠</i>Fechado c/ obstruções</span><span><i class="ini">○</i>Sem furos</span></div>
          ${gruposHTML}
        </div>
      `;
    }
  });

  lista.innerHTML = algumConteudo ? html : htmlEstadoVazio('Nada com esses filtros', 'Nenhum registro bate com o filtro atual. Limpe os filtros para ver tudo.', '', '', 'busca');
  aplicarEntradaCards();
}

function renderAll(){
  renderAneisMenu();
  renderBreadcrumb();
  renderPainelTrabalho();
  render();
  renderExportBar();
  renderTurnoLequesChecklist();
  renderChecklist();
  renderAvisoRefazer();
  preencherSelectsDeProjeto();
  renderInfografico();
  renderComunicados();
  if(document.body.dataset.view === 'turno') renderResumoTurno();
}

['f-tipo','f-situacao','f-busca'].forEach(id=> el(id).addEventListener('input', render));

// Filtros da lista: no celular ficam recolhidos atrás do botão "Filtros", que mostra quantos
// estão ativos; no computador ficam sempre à vista.
function atualizarContadorFiltros(){
  const n = ['f-tipo','f-situacao','f-busca'].filter(id=> el(id) && el(id).value.trim() !== '').length;
  const b = el('filtros-ativos'); if(!b) return;
  b.textContent = String(n); b.hidden = n === 0;
}
['f-tipo','f-situacao','f-busca'].forEach(id=>{ const c = el(id); if(c){ c.addEventListener('input', atualizarContadorFiltros); c.addEventListener('change', atualizarContadorFiltros); } });
el('btn-filtros').addEventListener('click', ()=>{
  const f = document.querySelector('.filters'); const aberto = f.classList.toggle('aberto');
  el('btn-filtros').setAttribute('aria-expanded', String(aberto));
});
atualizarContadorFiltros();

// PDF do realce ativo, a partir da mesma lista que a pessoa está vendo: respeita tipo de leque,
// situação do furo e busca. Cada leque entra inteiro, com os furos e os subtotais.
el('btn-pdf-lista').addEventListener('click', async ()=>{
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo){ showToast('Selecione um realce ativo primeiro.'); return; }
  const tipoFiltro = el('f-tipo').value, situacaoFiltro = el('f-situacao').value, busca = el('f-busca').value.trim().toUpperCase();
  let doAnel = leques.filter(l=>l.anelId===anelAtivo.id);
  if(tipoFiltro) doAnel = doAnel.filter(l=>l.tipo===tipoFiltro);
  const ids = doAnel.filter(l=>{
    let fl = furos.filter(f=>f.lequeId===l.id);
    if(situacaoFiltro) fl = fl.filter(f=>f.situacao===situacaoFiltro);
    if(busca) fl = fl.filter(f=>furoCode(l,f).includes(busca) || lequeCode(l).includes(busca));
    return fl.length > 0;
  }).map(l=>l.id);
  if(ids.length === 0){ showToast('Nenhum leque pra exportar com esse filtro.'); return; }
  const btn = el('btn-pdf-lista'); const txt = btn.textContent;
  btn.disabled = true; btn.textContent = 'Gerando PDF...';
  try{ await exportarLequesPDF(ids, { baixar:true }); }
  catch(e){ showToast('Não foi possível gerar o PDF: ' + (e && e.message ? e.message : 'erro desconhecido')); }
  finally{ btn.disabled = false; btn.textContent = txt; }
});

el('btn-csv').addEventListener('click', ()=>{
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo){ showToast('Selecione um realce ativo primeiro.'); return; }

  // Replica exatamente o mesmo filtro que a tela usa (tipo de leque, situacao do
  // furo, busca) -- pra exportar sempre o que a pessoa esta vendo, nao o app inteiro.
  const tipoFiltro = el('f-tipo').value;
  const situacaoFiltro = el('f-situacao').value;
  const busca = el('f-busca').value.trim().toUpperCase();

  let lequesDoAnel = leques.filter(l=>l.anelId===anelAtivo.id);
  if(tipoFiltro) lequesDoAnel = lequesDoAnel.filter(l=>l.tipo===tipoFiltro);

  const furosParaExportar = [];
  lequesDoAnel.forEach(l=>{
    let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
    if(situacaoFiltro) furosDoLeque = furosDoLeque.filter(f=>f.situacao===situacaoFiltro);
    if(busca) furosDoLeque = furosDoLeque.filter(f=>furoCode(l,f).includes(busca) || lequeCode(l).includes(busca));
    furosDoLeque.forEach(f=> furosParaExportar.push({ f, l }));
  });

  if(furosParaExportar.length === 0){ showToast('Nenhum furo pra exportar com esse filtro.'); return; }

  const header = 'realce,codigo_furo,tipo,metragem_esperada,metragem_real,diferenca,situacao,timestamp\n';
  const rows = furosParaExportar.map(({ f, l })=>{
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    return [anelAtivo.nome||'', furoCode(l,f), l.tipo||'', f.metragemEsperada, f.metragemReal, fmt1(diff), f.situacao, f.ts].join(',');
  }).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `perfilagem-furos-${anelAtivo.nome.replace(/[^a-zA-Z0-9_-]+/g,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${furosParaExportar.length} furo(s) exportado(s) para CSV.`);
});

['data','tecnicos','local','dds'].forEach(k=>{
  const campo = document.getElementById('turno-'+k);
  if(campo) campo.addEventListener('input', saveTurnoInfo);
});
document.querySelectorAll('#turno-numero-group .chip, #turno-letra-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
    // Cada letra tem uma dupla fixa de técnicos — preenche na hora, em vez de
    // digitar de novo a cada turno.
    if(chip.parentElement.id === 'turno-letra-group'){
      const nomes = TECNICOS_POR_LETRA[chip.dataset.val];
      if(nomes) el('turno-tecnicos').value = nomes;
      // Só ajusta o padrão da criação de leque se ninguém tinha escolhido
      // manualmente ainda — não sobrescreve uma escolha explícita.
      if(!document.querySelector('#leque-letra-group .chip.active')){
        selecionarChip('leque-letra-group', chip.dataset.val);
      }
    }
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
el('btn-baixar-selecionados').addEventListener('click', ()=>{
  exportarLequesPDF(Array.from(lequesSelecionados), { baixar:true });
});
document.querySelectorAll('#turno-incluir-leques-group .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#turno-incluir-leques-group .chip').forEach(c=> c.classList.remove('active'));
    chip.classList.add('active');
    renderTurnoLequesChecklist();
  });
});

el('turno-leques-checklist').addEventListener('change', (e)=>{
  const chk = e.target.closest('.turno-leque-check');
  if(!chk) return;
  toggleSelecaoLeque(chk.dataset.id, chk.checked);
});

async function exportarTurnoOuCombinado(){
  const grupo = el('turno-incluir-leques-group');
  const chipAtivo = grupo ? grupo.querySelector('.chip.active') : null;
  const incluirLeques = chipAtivo ? chipAtivo.dataset.val === 'sim' : false;

  if(incluirLeques){
    const idsMarcados = Array.from(document.querySelectorAll('#turno-leques-checklist .turno-leque-check:checked')).map(c=>c.dataset.id);
    if(idsMarcados.length === 0){
      showToast('Marque ao menos um leque, ou escolha "Não" pra exportar só o turno.');
      return;
    }
    await exportarLequesPDF(idsMarcados);
  }else{
    await exportarTurnoPDF();
  }

  // Depois de exportar o relatório do turno, já limpa os campos (Data, Turno,
  // Letra, Técnicos, DDS) pra deixar pronto pro próximo turno — sem precisar
  // clicar em "Limpar" à parte. Observações e fotos continuam guardadas.
  // O toast da própria exportação (ex: "PDF do turno exportado.") já apareceu
  // acima — espera ele passar antes de mostrar o da limpeza, pra não um
  // sobrescrever o outro (o toast é um elemento só, reaproveitado).
  executarLimpezaCamposTurno();
  setTimeout(()=> showToast('Dados do turno limpos, pronto pro próximo.'), 2400);
}
el('btn-exportar-turno').addEventListener('click', exportarTurnoOuCombinado);

// ---------- Barra de abas: troca entre as "páginas" do app ----------
const VIEWS_SECUNDARIAS = ['historico','config','tecnico'];
const ORDEM_VIEWS = ['turno','aneis','perfilagem','checklist','infografico','historico','config','tecnico'];
const posicaoRolagemView = {};
function mostrarView(viewId){
  const viewAnterior = document.body.dataset.view;
  if(viewAnterior && viewAnterior !== viewId) posicaoRolagemView[viewAnterior] = window.scrollY;
  document.body.dataset.view = viewId; // CSS usa isto pra mostrar contadores/trilha só onde fazem sentido
  document.querySelectorAll('.view').forEach(v=> v.classList.toggle('active', v.id === 'view-'+viewId));
  document.querySelectorAll('.tab-item').forEach(b=> b.classList.toggle('active', b.dataset.view === viewId));
  const abaMais = document.getElementById('tab-mais');
  if(abaMais) abaMais.classList.toggle('active', VIEWS_SECUNDARIAS.includes(viewId));
  document.querySelectorAll('#tab-mais-sheet .sheet-item').forEach(b=> b.classList.toggle('active', b.dataset.view === viewId));
  fecharSheetMais();
  // O infográfico não recalcula sozinho a cada marcação no checklist (só
  // renderChecklist roda nesse caso) — então garante dado fresco toda vez
  // que a aba é aberta de verdade.
  if(viewId === 'infografico') renderInfografico();
  if(viewId === 'turno') renderResumoTurno();
  atualizarWakeLock();
  if(viewAnterior && viewAnterior !== viewId){
    const novo = document.getElementById('view-' + viewId);
    const dir = ORDEM_VIEWS.indexOf(viewId) >= ORDEM_VIEWS.indexOf(viewAnterior) ? 1 : -1;
    window.scrollTo(0, posicaoRolagemView[viewId] || 0);
    try{
      if(novo && novo.animate && !semMovimento()) novo.animate([{ opacity:0, transform:`translateX(${28*dir}px)` }, { opacity:1, transform:'none' }], { duration:230, easing:'cubic-bezier(.2,.7,.2,1)' });
    }catch(e){}
  }
  if(viewId === 'checklist' || viewId === 'infografico' || viewId === 'turno') requestAnimationFrame(()=> animarEntradaDaAba(viewId));
  if(viewId === 'aneis' && anelFxPendente.size){
    const ids = [...anelFxPendente]; anelFxPendente.clear();
    requestAnimationFrame(()=> ids.forEach(id=> brilharBorda(document.querySelector(`.anel-row[data-anel-id="${id}"]`), false)));
  }
}

document.querySelectorAll('.tab-item[data-view]').forEach(btn=>{
  btn.addEventListener('click', ()=> mostrarView(btn.dataset.view));
});

// "Mais": no celular a barra de baixo mostra só as abas principais; Histórico,
// Config e Técnico ficam num painel que abre acima da barra.
function fecharSheetMais(){
  const sheet = document.getElementById('tab-mais-sheet');
  const btn = document.getElementById('tab-mais');
  if(sheet) sheet.classList.remove('open');
  if(btn) btn.setAttribute('aria-expanded', 'false');
}
(function montarSheetMais(){
  const sheet = document.getElementById('tab-mais-sheet');
  const btn = document.getElementById('tab-mais');
  if(!sheet || !btn) return;
  document.querySelectorAll('.tab-item.tab-secundaria').forEach(orig=>{
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sheet-item';
    item.dataset.view = orig.dataset.view;
    item.setAttribute('role', 'menuitem');
    item.innerHTML = orig.querySelector('.tab-icon').innerHTML + '<span>' + orig.querySelector('.tab-label').textContent + '</span>';
    item.addEventListener('click', ()=> mostrarView(item.dataset.view));
    sheet.appendChild(item);
  });
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const abrir = !sheet.classList.contains('open');
    sheet.classList.toggle('open', abrir);
    btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });
  document.addEventListener('click', (e)=>{ if(!sheet.contains(e.target) && e.target !== btn && !btn.contains(e.target)) fecharSheetMais(); });
})();
document.body.dataset.view = 'perfilagem';

// O rótulo do usuário fica escondido no cabeçalho do celular; espelha no menu ⋮.
(function espelharUsuarioNoMenu(){
  const origem = document.getElementById('usuario-logado-label');
  const destino = document.getElementById('menu-usuario-info');
  if(!origem || !destino) return;
  const copiar = ()=>{ destino.textContent = origem.textContent; };
  new MutationObserver(copiar).observe(origem, { childList:true, characterData:true, subtree:true });
  copiar();
})();

// ---------- Infográfico ----------
// Data local (sem hora) no formato AAAA-MM-DD, usada pra agrupar por dia
// sem se preocupar com fuso — só compara a data "no relógio da pessoa".
function chaveDia(dataIso){
  const d = new Date(dataIso);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function inicioDaSemana(base){
  const d = new Date(base);
  const diaSemana = d.getDay(); // 0=domingo
  const deslocamento = diaSemana === 0 ? 6 : diaSemana - 1; // volta até a segunda-feira
  d.setDate(d.getDate() - deslocamento);
  d.setHours(0,0,0,0);
  return d;
}

function calcularEstatisticasInfografico(){
  const furos = checklistFurosNoEscopoAtual();
  const agora = new Date();
  const hojeChave = chaveDia(agora);
  const inicioSemana = inicioDaSemana(agora);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  let metrosHoje = 0, metrosSemana = 0, metrosMes = 0, metrosSemanaAnt = 0;
  let furosTopoHoje = 0, furosTopoSemana = 0, furosTopoMes = 0, furosTopoSemanaAnt = 0;
  const porDia = {}; // chaveDia -> soma de metros perfilados
  const porDiaTopo = {}; // chaveDia -> contagem de furos topografados (não metros)

  const iniSemanaISO = dataISOLocal(inicioSemana), iniMesISO = dataISOLocal(inicioMes);
  const inicioSemanaAnt = new Date(inicioSemana); inicioSemanaAnt.setDate(inicioSemanaAnt.getDate() - 7);
  const iniSemanaAntISO = dataISOLocal(inicioSemanaAnt);
  const somaMetros = (chave, metros)=>{
    porDia[chave] = (porDia[chave] || 0) + metros;
    if(chave === hojeChave) metrosHoje += metros;
    if(chave >= iniSemanaISO) metrosSemana += metros;
    else if(chave >= iniSemanaAntISO) metrosSemanaAnt += metros;
    if(chave >= iniMesISO) metrosMes += metros;
  };
  // 1) Metros lançados pelas equipes (cada lançamento tem data) — é o que entra no gráfico diário.
  const idsEquipesEscopo = new Set((configApp.projetoAtivo ? equipes.filter(e=>e.projeto === configApp.projetoAtivo) : equipes).map(e=>e.id));
  lancamentosProd.forEach(l=>{ if(idsEquipesEscopo.has(l.equipeId) && l.metros) somaMetros(l.data, l.metros); });
  // Topografia lançada pelas equipes (pontos por dia) entra junto com os furos marcados no checklist
  // — antes só o checklist contava, e o gráfico ficava parado quando a equipe lançava só o total do dia.
  const somaTopo = (chave, n)=>{
    porDiaTopo[chave] = (porDiaTopo[chave] || 0) + n;
    if(chave === hojeChave) furosTopoHoje += n;
    if(chave >= iniSemanaISO) furosTopoSemana += n;
    else if(chave >= iniSemanaAntISO) furosTopoSemanaAnt += n;
    if(chave >= iniMesISO) furosTopoMes += n;
  };
  lancamentosProd.forEach(l=>{ if(idsEquipesEscopo.has(l.equipeId) && l.pontos) somaTopo(l.data, Number(l.pontos)); });

  furos.forEach(f=>{
    // Topografia continua sendo contagem de furos marcados no checklist (não metros).
    if(f.topografadoEm){
      const dataMarcacaoTopo = new Date(f.topografadoEm);
      const chaveTopo = chaveDia(f.topografadoEm);
      porDiaTopo[chaveTopo] = (porDiaTopo[chaveTopo] || 0) + 1;
      if(chaveTopo === hojeChave) furosTopoHoje++;
      if(dataMarcacaoTopo >= inicioSemana) furosTopoSemana++;
      else if(dataMarcacaoTopo >= inicioSemanaAnt) furosTopoSemanaAnt++;
      if(dataMarcacaoTopo >= inicioMes) furosTopoMes++;
    }
  });

  // Últimos 14 dias, do mais antigo pro mais recente, pro gráfico.
  const serieDiaria = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(agora);
    d.setDate(d.getDate() - i);
    const chave = chaveDia(d);
    serieDiaria.push({
      dia: String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'),
      metros: porDia[chave] || 0,
      furosTopo: porDiaTopo[chave] || 0
    });
  }

  const totalFuros = furos.length;
  const totalPerfilados = furos.filter(f=>f.perfilado).length;
  const totalTopografados = furos.filter(f=>f.topografado).length;

  return {
    metrosHoje, metrosSemana, metrosMes, metrosSemanaAnt,
    furosTopoHoje, furosTopoSemana, furosTopoMes, furosTopoSemanaAnt,
    serieDiaria, totalFuros, totalPerfilados, totalTopografados
  };
}

// Desenha um gráfico de área+linha genérico dentro de um <svg> — reaproveitado
// pros dois gráficos do infográfico (metros perfilados e furos topografados),
// que têm unidades diferentes e por isso não podem dividir o mesmo eixo.
function desenharGraficoAreaInfografico(idSvg, idEixoX, serie, chaveValor, corVar, meta){
  const svg = el(idSvg);
  if(!svg) return;
  // Usa a largura real do gráfico na tela (sem esticar), pra textos e círculos não distorcerem.
  const w = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 900), h = 170, pad = 18, topo = 22;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const maxSerie = Math.max(1, ...serie.map(d=>d[chaveValor]));
  const max = Math.max(maxSerie, meta || 0) * 1.1;
  const passoX = (w - pad*2) / (serie.length - 1);
  const yDe = v => h - pad - ((v / max) * (h - pad - topo));
  const pontos = serie.map((d,i)=> [pad + i * passoX, yDe(d[chaveValor])]);
  const linhaPath = pontos.map((p,i)=> (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = linhaPath + ` L${pontos[pontos.length-1][0]},${h-pad} L${pontos[0][0]},${h-pad} Z`;
  const idGrad = 'grad-' + idSvg;
  const fmtV = v => chaveValor === 'metros' ? (Math.round(v*10)/10).toString().replace('.', ',') : String(v);

  let svgHTML = `
    <defs>
      <linearGradient id="${idGrad}" x1="0" y1="0" x2="0" y2="1">
        <stop data-exp="stop" offset="0%" style="stop-color:${corVar}; stop-opacity:0.35;"/>
        <stop data-exp="stop" offset="100%" style="stop-color:${corVar}; stop-opacity:0;"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" style="fill:url(#${idGrad});"/>
    <path data-exp="linha" d="${linhaPath}" style="fill:none; stroke:${corVar}; stroke-width:2.5px; stroke-linecap:round; stroke-linejoin:round;"/>
  `;
  // Linha de meta tracejada (só quando existe meta)
  if(meta && meta > 0){
    const ym = yDe(meta);
    svgHTML += `<line data-exp="meta" x1="${pad}" x2="${w-pad}" y1="${ym}" y2="${ym}" style="stroke:var(--muted); stroke-width:1.5px; stroke-dasharray:6 5;"/>`
      + `<text data-exp="meta" x="${pad+2}" y="${ym-5}" style="fill:var(--muted); font-size:12px; font-family:var(--mono);">meta/dia ${fmtV(meta)}</text>`;
  }
  pontos.forEach((p,i)=>{
    const ultimo = i === pontos.length - 1;
    svgHTML += `<circle data-exp="${ultimo?'ponto-ultimo':'ponto'}" cx="${p[0]}" cy="${p[1]}" r="${ultimo?5:3}" style="fill:${ultimo?corVar:'var(--surface)'}; stroke:${corVar}; stroke-width:2px;"/>`;
  });
  // Valores marcados: o maior e o último dia (quando maiores que zero)
  const iMax = serie.reduce((b,d,i)=> d[chaveValor] > serie[b][chaveValor] ? i : b, 0);
  const marcar = new Set([serie.length - 1]); if(serie[iMax][chaveValor] > 0) marcar.add(iMax);
  marcar.forEach(i=>{
    const v = serie[i][chaveValor]; if(!v) return;
    const x = Math.min(w - pad - 4, Math.max(pad + 4, pontos[i][0]));
    const ancora = x > w - 40 ? 'end' : (x < 40 ? 'start' : 'middle');
    svgHTML += `<text data-exp="valor" x="${ancora==='end' ? pontos[i][0]+4 : x}" y="${pontos[i][1]-9}" text-anchor="${ancora}" style="fill:var(--text); font-size:13px; font-weight:700; font-family:var(--mono);">${fmtV(v)}</text>`;
  });
  svg.innerHTML = svgHTML;
  svg.dataset.corExport = corVar === 'var(--amber)' ? '#ff431d' : '#2f6690'; // cor da série na imagem (tema claro)

  const eixoX = el(idEixoX);
  if(eixoX){
    // Um rótulo a cada 2 dias, contando de trás pra frente: o último dia (hoje)
    // sempre aparece. Cada rótulo mostra o valor do dia em cima da data.
    eixoX.innerHTML = serie.map((d,i)=>{
      const visivel = (serie.length - 1 - i) % 2 === 0;
      return `<span class="${visivel ? '' : 'oculto'}"><b>${d[chaveValor] ? fmtV(d[chaveValor]) : '·'}</b>${d.dia}</span>`;
    }).join('');
  }
}

// ---------- Equipes por projeto ----------
// Cada projeto tem as suas equipes (nome + integrantes), cadastradas pelo próprio
// app. A produtividade é lançada por equipe, então fica separada por projeto.
// Escopo "sem projeto" (nenhum projeto ativo) = chave '' — vale como um grupo "Geral".
const EQUIPES_LOCAL_KEY = 'perfilagem-equipes-v1';
const PRODUTIVIDADE_LOCAL_KEY = 'perfilagem-lancamentos-produtividade-v3';
let equipes = [];               // { id, projeto, nome, integrantes, ordem }
let lancamentosProd = [];  // { id, equipeId, data (AAAA-MM-DD), metros, pontos } — cada lançamento do turno, com data
let infoSemanaOffset = 0;       // 0 = semana atual, -1 = semana passada...

function mapEquipe(row){ return { id: row.id, projeto: row.projeto || '', nome: row.nome, integrantes: row.integrantes || '', ordem: row.ordem != null ? Number(row.ordem) : 0, metaSemanal: row.meta_semanal_metros != null ? Number(row.meta_semanal_metros) : null }; }
function mapLancamento(row){ return { id: row.id, equipeId: row.equipe_id, data: String(row.data).slice(0,10), metros: Number(row.metros || 0), pontos: Number(row.pontos || 0) }; }
function carregarEquipesLocal(){
  try{ equipes = JSON.parse(localStorage.getItem(EQUIPES_LOCAL_KEY) || '[]'); }catch(e){ equipes = []; }
  try{ lancamentosProd = JSON.parse(localStorage.getItem(PRODUTIVIDADE_LOCAL_KEY) || '[]'); }catch(e){ lancamentosProd = []; }
}
function salvarEquipesLocal(){
  try{ localStorage.setItem(EQUIPES_LOCAL_KEY, JSON.stringify(equipes)); }catch(e){}
}
function salvarProdutividadeLocal(){
  try{ localStorage.setItem(PRODUTIVIDADE_LOCAL_KEY, JSON.stringify(lancamentosProd)); }catch(e){}
}
carregarEquipesLocal();

function projetoDoEscopo(){ return configApp.projetoAtivo || ''; }
function equipesDoProjeto(projeto){
  const p = projeto == null ? projetoDoEscopo() : projeto;
  return equipes.filter(e=> e.projeto === p).sort((x,y)=> (x.ordem - y.ordem) || x.nome.localeCompare(y.nome, 'pt-BR'));
}
function nomeEscopoEquipes(){ return projetoDoEscopo() || 'Geral (sem projeto)'; }
// Estado vazio com ícone e botão de ação (em vez de só um texto cinza solto).
const ILUSTRA_VAZIO = {
  realce: '<svg class="ilustra-vazio" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 72V34C8 16 30 6 60 6s52 10 52 28v38"/><path d="M24 72V38c0-11 15-18 36-18s36 7 36 18v34" stroke-opacity=".55"/><path d="M42 72V44c0-6 8-10 18-10s18 4 18 10v28" stroke-opacity=".35"/><path d="M4 72h112"/><circle cx="60" cy="58" r="4" class="ponto"/></svg>',
  leque: '<svg class="ilustra-vazio" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M60 72 14 18M60 72 34 10M60 72 60 6M60 72 86 10M60 72 106 18" stroke-opacity=".6"/><circle cx="14" cy="18" r="3.5" class="ponto"/><circle cx="34" cy="10" r="3.5" class="ponto"/><circle cx="60" cy="6" r="3.5" class="ponto"/><circle cx="86" cy="10" r="3.5" class="ponto"/><circle cx="106" cy="18" r="3.5" class="ponto"/><path d="M44 74h32"/></svg>',
  lista: '<svg class="ilustra-vazio" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="30" y="6" width="60" height="68" rx="6"/><path d="M42 24h8M58 24h22M42 40h8M58 40h22M42 56h8M58 56h14" stroke-opacity=".6"/><path d="m41 24 2 2 4-4" class="ponto"/></svg>',
  busca: '<svg class="ilustra-vazio" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="54" cy="36" r="22"/><path d="m71 53 24 20"/><path d="M44 36h20" stroke-opacity=".6"/></svg>'
};
// Estado vazio ilustrado, com texto e botão de ação (em vez de só um texto cinza solto).
function htmlEstadoVazio(titulo, texto, rotuloBotao, acaoJs, ilustracao){
  return `<div class="estado-vazio">${ILUSTRA_VAZIO[ilustracao || 'realce']}
    <strong>${titulo}</strong><span>${texto}</span>${rotuloBotao ? `<button type="button" onclick="${acaoJs}">${rotuloBotao}</button>` : ''}</div>`;
}
function escHtml(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function criarEquipe(projeto, nome, integrantes){
  const ordem = equipesDoProjeto(projeto).reduce((m,e)=> Math.max(m, e.ordem), 0) + 1;
  const e = { id: uuidv4(), projeto, nome, integrantes, ordem };
  equipes.push(e);
  enfileirar('equipes', 'insert', { id: e.id, projeto: e.projeto, nome: e.nome, integrantes: e.integrantes, ordem: e.ordem });
  return e;
}

function dataISOLocal(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function intervaloSemanaInfografico(){
  const inicio = inicioDaSemana(new Date()); // segunda-feira
  inicio.setDate(inicio.getDate() + infoSemanaOffset * 7);
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 6); // domingo
  return { inicio, fim, semana: dataISOLocal(inicio) };
}
const arred2 = n => Math.round(n * 100) / 100;
function somaLancamentos(equipeId, iniISO, fimISO){
  let m = 0, p = 0, q = 0;
  lancamentosProd.forEach(l=>{
    if(l.equipeId === equipeId && l.data >= iniISO && l.data <= fimISO){ m += l.metros; p += l.pontos; q++; }
  });
  return { metros: arred2(m), pontos: Math.round(p), qtd: q };
}
function somaDaSemanaSelecionada(equipeId){
  const { inicio, fim } = intervaloSemanaInfografico();
  return somaLancamentos(equipeId, dataISOLocal(inicio), dataISOLocal(fim));
}
// Data em que um novo lançamento é gravado: hoje, se a semana mostrada é a atual;
// senão o último dia (domingo) da semana que está na tela.
function dataLancamentoAtual(){
  const { inicio, fim } = intervaloSemanaInfografico();
  const hoje = dataISOLocal(new Date());
  return (hoje >= dataISOLocal(inicio) && hoje <= dataISOLocal(fim)) ? hoje : dataISOLocal(fim);
}
// Cada lançamento fica com a DATA — é isso que alimenta o gráfico diário do infográfico.
function registrarLancamento(equipeId, metros, pontos){
  const l = { id: uuidv4(), equipeId, data: dataLancamentoAtual(), metros: arred2(metros), pontos: Math.round(pontos) };
  lancamentosProd.push(l);
  salvarProdutividadeLocal();
  enfileirar('produtividade_lancamentos', 'insert', { id: l.id, equipe_id: l.equipeId, data: l.data, metros: l.metros, pontos: l.pontos });
  return l;
}
function desfazerLancamento(id){
  const l = lancamentosProd.find(x=>x.id === id);
  if(!l) return;
  lancamentosProd = lancamentosProd.filter(x=>x.id !== id);
  salvarProdutividadeLocal();
  enfileirar('produtividade_lancamentos', 'delete', { id });
}
// Quem digita o TOTAL da semana: grava a diferença como um lançamento (pode ser negativo, p/ corrigir).
function lancarProdutividade(equipeId, campo, valorTexto){
  const limpo = String(valorTexto).trim().replace(',', '.');
  let num = limpo === '' ? 0 : parseFloat(limpo);
  if(isNaN(num) || num < 0){ showToast('Digite um número válido (0 ou mais).'); renderProdutividadeEquipes(); return; }
  if(campo === 'pontos') num = Math.round(num);
  const atual = somaDaSemanaSelecionada(equipeId)[campo];
  const delta = arred2(num - atual);
  if(Math.abs(delta) < 0.005){ atualizarBarrasEResumoProdutividade(); return; }
  registrarLancamento(equipeId, campo === 'metros' ? delta : 0, campo === 'pontos' ? delta : 0);
  atualizarBarrasEResumoProdutividade();
}
// Soma um valor ao total (ex.: +45 m no fim do turno). Entra no gráfico diário na hora.
function somarProdutividade(equipeId, campo, valorTexto){
  const limpo = String(valorTexto).trim().replace(',', '.');
  let add = parseFloat(limpo);
  if(limpo === '' || isNaN(add) || add <= 0){ showToast('Digite quanto somar (maior que 0).'); return; }
  if(campo === 'pontos') add = Math.round(add);
  const l = registrarLancamento(equipeId, campo === 'metros' ? add : 0, campo === 'pontos' ? add : 0);
  renderProdutividadeEquipes();
  const total = somaDaSemanaSelecionada(equipeId)[campo];
  const eq = equipes.find(e=>e.id===equipeId);
  const unidade = campo === 'metros' ? 'm' : (add === 1 ? 'ponto' : 'pontos');
  const fmtV = v => String(v).replace('.', ',');
  showToast(`+${fmtV(add)} ${unidade} em ${eq ? eq.nome : 'equipe'} (total da semana ${fmtV(total)})`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=>{ desfazerLancamento(l.id); renderProdutividadeEquipes(); }
  });
}
function somarDoCampo(botao){
  const wrap = botao.closest('.equipe-soma');
  somarProdutividade(wrap.dataset.equipe, wrap.dataset.campo, wrap.querySelector('.inp-somar').value);
}
function mudarSemanaInfografico(delta){
  infoSemanaOffset = Math.min(0, infoSemanaOffset + delta); // não deixa ir pro futuro
  renderInfografico();
}
const fmtPontos = n => n + (n === 1 ? ' ponto' : ' pontos');

// Atualiza só barras/total (sem recriar os campos — não tira o foco de quem está digitando).
const META_BATIDA_ANTES = new Map();
function atualizarBarrasEResumoProdutividade(){
  const dados = equipesDoProjeto().map(e=>{ const r = somaDaSemanaSelecionada(e.id); return { id: e.id, m: r.metros, p: r.pontos, meta: e.metaSemanal > 0 ? e.metaSemanal : 0 }; });
  const maxM = Math.max(1, ...dados.map(d=>d.m)), maxP = Math.max(1, ...dados.map(d=>d.p));
  const lider = dados.reduce((best,d)=> d.m > (best ? best.m : 0) ? d : best, null);
  dados.forEach(d=>{
    const bm = document.getElementById('barra-metros-' + d.id), bp = document.getElementById('barra-pontos-' + d.id), tag = document.getElementById('lider-' + d.id);
    // Com meta semanal cadastrada, a barra é "realizado ÷ meta"; sem meta, compara com a melhor equipe.
    if(bm){
      const chaveMeta = d.id + '|' + dataISOLocal(intervaloSemanaInfografico().inicio);
      const bateuAgora = !!d.meta && d.m >= d.meta;
      if(META_BATIDA_ANTES.has(chaveMeta) && !META_BATIDA_ANTES.get(chaveMeta) && bateuAgora) brilharBorda(bm.closest('.equipe-linha'), true);
      META_BATIDA_ANTES.set(chaveMeta, bateuAgora);
      bm.style.width = (d.meta ? Math.min(100, Math.max(0, d.m) / d.meta * 100) : Math.max(0, d.m) / maxM * 100) + '%';
      bm.classList.toggle('meta-batida', !!d.meta && d.m >= d.meta);
    }
    const mt = document.getElementById('meta-txt-' + d.id);
    if(mt){
      if(d.meta){
        const pct = Math.round(d.m / d.meta * 100);
        mt.innerHTML = `<b>${fmt1(d.m).replace('.', ',')}</b> / ${String(d.meta).replace('.', ',')} m · ${d.m >= d.meta ? '✓ ' : ''}${pct}%`;
      }else{
        mt.innerHTML = `<b>${fmt1(d.m).replace('.', ',')}</b> m <span class="sem-meta">· sem meta</span>`;
      }
    }
    if(bp) bp.style.width = (Math.max(0, d.p) / maxP * 100) + '%';
    if(tag) tag.style.display = lider && lider.id === d.id && d.m > 0 ? 'inline' : 'none';
  });
  const totM = dados.reduce((a,d)=>a+d.m,0), totP = dados.reduce((a,d)=>a+d.p,0);
  el('infografico-equipes-total').innerHTML = dados.length ? `Total da semana: <b>${fmt1(totM).replace('.', ',')} m</b> perfilados · <b>${fmtPontos(totP)}</b> topografados` : '';
  renderProdutividadeMensal();
  renderInfograficoResumo(); // KPIs e gráficos diários acompanham o lançamento
}

// Mensagem quando o projeto ainda não tem equipes.
// Cada equipe ganha uma cor fixa pela posição dela no projeto (1ª, 2ª, 3ª...), pra bater o olho
// e saber quem é quem sem ler o nome. As cores são da paleta do sistema e mudam com o tema.
function corDaEquipe(e){
  const irmas = equipes.filter(x=> x.projeto === e.projeto).sort((a,b)=> (a.ordem||0) - (b.ordem||0));
  const i = Math.max(0, irmas.findIndex(x=> x.id === e.id));
  return `var(--eq-${(i % 6) + 1})`;
}
function marcaDaEquipe(e){ return `<span class="eq-ponto" aria-hidden="true"></span>`; }

function htmlSemEquipes(){
  return `<div class="equipe-vazio-box">
    <div>O escopo <b>${escHtml(nomeEscopoEquipes())}</b> ainda não tem equipes cadastradas.</div>
    <div class="equipe-vazio-acoes">
      <button type="button" class="steel" onclick="abrirModalEquipes()">+ Cadastrar equipes</button>
    </div></div>`;
}
// Furos do checklist atribuídos a uma equipe (perfilados / topografados) dentro de um período.
function furosChecklistDaEquipe(equipeId, iniISO, fimISO){
  let p = 0, t = 0;
  const dentro = v=>{ if(!v) return false; const d = dataISOLocal(new Date(v)); return d >= iniISO && d <= fimISO; };
  checklistFuros.forEach(f=>{
    if(f.perfilado && dentro(f.perfiladoEm) && equipePerfEfetivaId(f) === equipeId) p++;
    if(f.topografado && dentro(f.topografadoEm) && equipeTopoEfetivaId(f) === equipeId) t++;
  });
  return { p, t };
}
function htmlLinhaChecklistEquipe(equipeId, iniISO, fimISO){
  const { p, t } = furosChecklistDaEquipe(equipeId, iniISO, fimISO);
  if(!p && !t) return '';
  return `<div class="equipe-checklist" data-exp="1">Checklist: <b>${p}</b> furo${p===1?'':'s'} perfilado${p===1?'':'s'} · <b>${t}</b> topografado${t===1?'':'s'}</div>`;
}
function renderProdutividadeEquipes(){
  const box = el('infografico-equipes');
  if(!box) return;
  const escopoTag = el('infografico-equipes-escopo');
  if(escopoTag) escopoTag.textContent = nomeEscopoEquipes();
  const { inicio, fim, semana } = intervaloSemanaInfografico();
  const f2 = d => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  el('infografico-semana-label').textContent = (infoSemanaOffset === 0 ? 'Esta semana' : infoSemanaOffset === -1 ? 'Semana passada' : `${-infoSemanaOffset} semanas atrás`) + ` · ${f2(inicio)} a ${f2(fim)}`;
  el('infografico-semana-prox').disabled = infoSemanaOffset >= 0;
  const lista = equipesDoProjeto();
  if(lista.length === 0){ box.innerHTML = htmlSemEquipes(); atualizarBarrasEResumoProdutividade(); return; }
  const valorInput = v => (v == null || v === 0) ? '' : String(v).replace('.', ',');
  box.innerHTML = lista.map(e=>{
    const r = somaDaSemanaSelecionada(e.id);
    const _iv = intervaloSemanaInfografico();
    const linhaCk = htmlLinhaChecklistEquipe(e.id, dataISOLocal(_iv.inicio), dataISOLocal(_iv.fim));
    return `
      <div class="equipe-linha" style="--eq-cor:${corDaEquipe(e)}">
        <div class="equipe-topo">
          <span class="equipe-nome">${marcaDaEquipe(e)}${escHtml(e.nome)} <span class="equipe-lider" id="lider-${e.id}" style="display:none;">▲ mais metros</span></span>
          <span class="equipe-tecnicos">${escHtml(e.integrantes)}</span>
        </div>
        <div class="equipe-bloco">
          <div class="equipe-bloco-topo"><span class="equipe-rotulo">Perfilado</span><span class="equipe-meta-txt" id="meta-txt-${e.id}"></span></div>
          <div class="equipe-trilho"><div class="equipe-barra equipe-barra-amber" id="barra-metros-${e.id}"></div></div>
          <div class="equipe-soma" data-equipe="${e.id}" data-campo="metros">
            <span class="equipe-campo"><input type="text" inputmode="decimal" placeholder="0" value="${valorInput(r.metros)}" aria-label="Total de metros perfilados de ${escHtml(e.nome)} na semana" onchange="lancarProdutividade('${e.id}','metros',this.value)"><small>m</small></span>
            <input type="text" class="inp-somar" inputmode="decimal" placeholder="+ m" aria-label="Somar metros em ${escHtml(e.nome)}" onkeydown="if(event.key==='Enter'){event.preventDefault();somarDoCampo(this)}">
            <button type="button" class="steel btn-somar" onclick="somarDoCampo(this)" aria-label="Somar metros em ${escHtml(e.nome)}">＋</button>
          </div>
        </div>
        <div class="equipe-bloco">
          <div class="equipe-bloco-topo"><span class="equipe-rotulo">Topografado</span></div>
          <div class="equipe-trilho"><div class="equipe-barra equipe-barra-steel" id="barra-pontos-${e.id}"></div></div>
          <div class="equipe-soma" data-equipe="${e.id}" data-campo="pontos">
            <span class="equipe-campo"><input type="text" inputmode="numeric" placeholder="0" value="${valorInput(r.pontos)}" aria-label="Total de pontos topografados de ${escHtml(e.nome)} na semana" onchange="lancarProdutividade('${e.id}','pontos',this.value)"><small>pts</small></span>
            <input type="text" class="inp-somar" inputmode="numeric" placeholder="+ pts" aria-label="Somar pontos em ${escHtml(e.nome)}" onkeydown="if(event.key==='Enter'){event.preventDefault();somarDoCampo(this)}">
            <button type="button" class="steel btn-somar" onclick="somarDoCampo(this)" aria-label="Somar pontos em ${escHtml(e.nome)}">＋</button>
          </div>
        </div>
        ${linhaCk}
      </div>`;
  }).join('');
  atualizarBarrasEResumoProdutividade();
}

// ---------- Produtividade mensal por equipe ----------
// Soma das semanas lançadas. Uma semana (segunda a domingo) pode ficar entre dois
// meses; ela conta no mês em que cai a MAIORIA dos dias — o mês da quinta-feira.
let infoMesOffset = 0; // 0 = mês atual, -1 = mês passado...
const NOMES_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function chaveMesDaSemana(semanaISO){
  const [a,m,d] = semanaISO.split('-').map(Number);
  const quinta = new Date(a, m-1, d + 3);
  return quinta.getFullYear() + '-' + String(quinta.getMonth()+1).padStart(2,'0');
}
function chaveMesComOffset(offset){
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function nomeMesDaChave(chave){
  const [a,m] = chave.split('-').map(Number);
  return NOMES_MESES[m-1] + '/' + a;
}
function calcularProdutividadeMensal(chaveMes){
  const lista = equipesDoProjeto();
  const porEquipe = {}; lista.forEach(e=> porEquipe[e.id] = { metros: 0, pontos: 0 });
  const dias = new Set();
  lancamentosProd.forEach(l=>{
    if(!porEquipe[l.equipeId] || l.data.slice(0,7) !== chaveMes) return;
    porEquipe[l.equipeId].metros += l.metros;
    porEquipe[l.equipeId].pontos += l.pontos;
    dias.add(l.data);
  });
  lista.forEach(e=>{ porEquipe[e.id].metros = arred2(porEquipe[e.id].metros); porEquipe[e.id].pontos = Math.round(porEquipe[e.id].pontos); });
  return { lista, porEquipe, semanas: Array.from(dias).sort() }; // "semanas" agora = dias com lançamento
}
function mudarMesInfografico(delta){
  infoMesOffset = Math.min(0, infoMesOffset + delta);
  renderProdutividadeMensal();
}
function renderProdutividadeMensal(){
  const box = el('infografico-equipes-mes');
  if(!box) return;
  const chave = chaveMesComOffset(infoMesOffset);
  el('infografico-mes-label').textContent = nomeMesDaChave(chave) + (infoMesOffset === 0 ? ' · mês atual' : '');
  el('infografico-mes-prox').disabled = infoMesOffset >= 0;
  const { lista, porEquipe, semanas } = calcularProdutividadeMensal(chave);
  if(lista.length === 0){ box.innerHTML = ''; el('infografico-equipes-mes-total').innerHTML = ''; return; }
  const maxM = Math.max(1, ...lista.map(e=>porEquipe[e.id].metros)), maxP = Math.max(1, ...lista.map(e=>porEquipe[e.id].pontos));
  const lider = lista.reduce((best,e)=> porEquipe[e.id].metros > (best ? porEquipe[best.id].metros : 0) ? e : best, null);
  const fm = n => fmt1(n).replace('.', ',');
  box.innerHTML = lista.map(e=>{
    const d = porEquipe[e.id];
    const linhaCk = htmlLinhaChecklistEquipe(e.id, chave + '-01', chave + '-31');
    return `
      <div class="equipe-linha${d.metros === 0 && d.pontos === 0 ? ' equipe-vazia' : ''}" style="--eq-cor:${corDaEquipe(e)}">
        <div class="equipe-topo">
          <span class="equipe-nome">${marcaDaEquipe(e)}${escHtml(e.nome)}${lider && e.id === lider.id && d.metros > 0 ? ' <span class="equipe-lider">▲ mais metros</span>' : ''}</span>
          <span class="equipe-tecnicos">${escHtml(e.integrantes)}</span>
        </div>
        <div class="equipe-metrica">
          <span class="equipe-rotulo">Perfilado</span>
          <div class="equipe-trilho"><div class="equipe-barra equipe-barra-amber" style="width:${d.metros / maxM * 100}%"></div></div>
          <span class="equipe-valor">${fm(d.metros)} m</span>
        </div>
        <div class="equipe-metrica">
          <span class="equipe-rotulo">Topografado</span>
          <div class="equipe-trilho"><div class="equipe-barra equipe-barra-steel" style="width:${d.pontos / maxP * 100}%"></div></div>
          <span class="equipe-valor">${fmtPontos(d.pontos)}</span>
        </div>
        ${linhaCk}
      </div>`;
  }).join('');
  const totM = lista.reduce((a,e)=>a+porEquipe[e.id].metros,0), totP = lista.reduce((a,e)=>a+porEquipe[e.id].pontos,0);
  const ddmm = iso => iso.slice(8,10) + '/' + iso.slice(5,7);
  el('infografico-equipes-mes-total').innerHTML = `Total do mês: <b>${fm(totM)} m</b> perfilados · <b>${fmtPontos(totP)}</b> topografados`
    + `<br><span class="equipe-semanas-lista">${semanas.length ? 'Dias com lançamento: ' + semanas.map(ddmm).join(', ') : 'Nenhum lançamento neste mês.'}</span>`;
}

// ---------- Gerenciar equipes (adicionar / editar / apagar) ----------
function abrirModalEquipes(){
  const root = el('modal-root');
  const projeto = projetoDoEscopo();
  const lista = equipesDoProjeto(projeto);
  const linhas = lista.map(e=>`
    <div class="equipe-edit-item" data-id="${e.id}">
      <div class="field"><label>Nome da equipe</label><input type="text" class="eq-nome" value="${escHtml(e.nome)}" maxlength="40"></div>
      <div class="field"><label>Integrantes</label><input type="text" class="eq-integrantes" value="${escHtml(e.integrantes)}" maxlength="120" placeholder="ex.: João / Maria"></div>
      <div class="field"><label>Meta semanal de metros (opcional)</label><input type="text" inputmode="decimal" class="eq-meta" value="${e.metaSemanal > 0 ? String(e.metaSemanal).replace('.', ',') : ''}" maxlength="8" placeholder="ex.: 120"></div>
      <button type="button" class="ghost perigo eq-apagar" data-id="${e.id}">Apagar equipe</button>
    </div>`).join('');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box modal-box-larga">
        <p style="font-weight:700;">Equipes do projeto: ${escHtml(nomeEscopoEquipes())}</p>
        <p class="hint">Cada projeto tem as suas equipes. Alterar o nome ou os integrantes vale para a produtividade já lançada.</p>
        <div class="equipe-edit-lista">${linhas || '<div class="hint">Nenhuma equipe ainda — adicione abaixo.</div>'}</div>
        <div class="equipe-edit-item equipe-edit-nova">
          <div class="field"><label>Nova equipe — nome</label><input type="text" id="eq-novo-nome" maxlength="40" placeholder="ex.: Equipe F"></div>
          <div class="field"><label>Integrantes</label><input type="text" id="eq-novo-integrantes" maxlength="120" placeholder="ex.: João / Maria"></div>
          <div class="field"><label>Meta semanal de metros (opcional)</label><input type="text" inputmode="decimal" id="eq-novo-meta" maxlength="8" placeholder="ex.: 120"></div>
          <button type="button" class="steel" id="eq-adicionar">+ Adicionar equipe</button>
        </div>
        <div class="modal-actions">
          <button class="ghost" id="modal-cancelar">Cancelar</button>
          <button class="steel" id="modal-salvar-equipes">Salvar</button>
        </div>
      </div>
    </div>`;
  const fechar = ()=>{ root.innerHTML = ''; renderInfografico(); };
  el('modal-cancelar').addEventListener('click', fechar);
  el('modal-overlay').addEventListener('click', (ev)=>{ if(ev.target.id === 'modal-overlay') fechar(); });

  // Salva nome/integrantes editados de todas as equipes listadas.
  const salvarEdicoes = ()=>{
    let alterou = false;
    root.querySelectorAll('.equipe-edit-lista .equipe-edit-item').forEach(item=>{
      const e = equipes.find(x=>x.id === item.dataset.id);
      if(!e) return;
      const nome = item.querySelector('.eq-nome').value.trim();
      const integrantes = item.querySelector('.eq-integrantes').value.trim();
      if(!nome) return; // nome vazio: mantém o anterior
      const metaTxt = item.querySelector('.eq-meta').value.trim().replace(',', '.');
      const metaNum = parseFloat(metaTxt);
      const meta = metaTxt !== '' && !isNaN(metaNum) && metaNum > 0 ? metaNum : null;
      if(nome !== e.nome || integrantes !== e.integrantes || meta !== (e.metaSemanal > 0 ? e.metaSemanal : null)){
        e.nome = nome; e.integrantes = integrantes; e.metaSemanal = meta; alterou = true;
        enfileirar('equipes', 'update', { id: e.id, nome: e.nome, integrantes: e.integrantes, meta_semanal_metros: meta });
      }
    });
    if(alterou) salvarEquipesLocal();
    return alterou;
  };
  const adicionarDaLinhaNova = ()=>{
    const nome = el('eq-novo-nome').value.trim();
    if(!nome) return false;
    if(equipesDoProjeto(projeto).some(e=> e.nome.toLowerCase() === nome.toLowerCase())){ showToast('Já existe uma equipe com esse nome neste projeto.'); return null; }
    const nova = criarEquipe(projeto, nome, el('eq-novo-integrantes').value.trim());
    const mTxt = el('eq-novo-meta').value.trim().replace(',', '.'), mNum = parseFloat(mTxt);
    if(mTxt !== '' && !isNaN(mNum) && mNum > 0){
      nova.metaSemanal = mNum;
      enfileirar('equipes', 'update', { id: nova.id, meta_semanal_metros: mNum });
    }
    salvarEquipesLocal();
    return true;
  };
  el('eq-adicionar').addEventListener('click', ()=>{
    salvarEdicoes();
    if(!el('eq-novo-nome').value.trim()){ showToast('Digite o nome da nova equipe.'); return; }
    const r = adicionarDaLinhaNova();
    if(r){ showToast('Equipe adicionada.'); abrirModalEquipes(); }
  });
  el('modal-salvar-equipes').addEventListener('click', ()=>{
    salvarEdicoes();
    if(el('eq-novo-nome').value.trim()){ const r = adicionarDaLinhaNova(); if(r === null) return; }
    showToast('Equipes salvas.');
    fechar();
  });
  root.querySelectorAll('.eq-apagar').forEach(btn=> btn.addEventListener('click', async ()=>{
    salvarEdicoes();
    const e = equipes.find(x=>x.id === btn.dataset.id);
    if(!e) return;
    const qtd = lancamentosProd.filter(r=>r.equipeId === e.id).length;
    const msg = `Apagar "${e.nome}"?` + (qtd > 0 ? ` Os ${qtd} lançamento(s) dela também serão apagados.` : '');
    if(!(await confirmDialog(msg, 'Apagar'))){ abrirModalEquipes(); return; }
    const lancamentos = lancamentosProd.filter(r=>r.equipeId === e.id);
    equipes = equipes.filter(x=>x.id !== e.id);
    lancamentosProd = lancamentosProd.filter(r=>r.equipeId !== e.id);
    enfileirar('equipes', 'delete', { id: e.id }); // no servidor, os lançamentos saem em cascata
    salvarEquipesLocal(); salvarProdutividadeLocal();
    abrirModalEquipes();
    showToast('Equipe apagada.', { acaoLabel: 'Desfazer', onAcao: ()=>{
      if(equipes.some(x=>x.id === e.id)) return;
      equipes.push(e);
      enfileirar('equipes', 'insert', { id: e.id, projeto: e.projeto, nome: e.nome, integrantes: e.integrantes, ordem: e.ordem, meta_semanal_metros: e.metaSemanal > 0 ? e.metaSemanal : null });
      lancamentos.forEach(r=>{
        lancamentosProd.push(r);
        enfileirar('produtividade_lancamentos', 'insert', { id: r.id, equipe_id: r.equipeId, data: r.data, metros: r.metros, pontos: r.pontos });
      });
      salvarEquipesLocal(); salvarProdutividadeLocal();
      renderInfografico();
      showToast('Equipe restaurada.');
    }});
  }));
}

function renderInfografico(){
  const svg = el('infografico-chart-dia');
  if(!svg) return; // view ainda não foi montada na tela

  const tagEscopo = el('infografico-escopo-tag');
  if(tagEscopo) tagEscopo.textContent = configApp.projetoAtivo ? `projeto: ${configApp.projetoAtivo}` : 'todos os projetos';

  renderProdutividadeEquipes(); // já atualiza o resumo (KPIs e gráficos) no fim
}

function renderInfograficoResumo(){
  if(!el('infografico-chart-dia')) return;
  const stats = calcularEstatisticasInfografico();

  el('infografico-metros-hoje').innerHTML = `${fmt1(stats.metrosHoje)}<span class="unidade">m</span>`;
  el('infografico-metros-semana').innerHTML = `${fmt1(stats.metrosSemana)}<span class="unidade">m</span>`;
  el('infografico-metros-mes').innerHTML = `${fmt1(stats.metrosMes)}<span class="unidade">m</span>`;
  // Topografia é contagem de furos, não metros — número inteiro, sem casa decimal.
  el('infografico-topo-hoje').innerHTML = `${stats.furosTopoHoje}<span class="unidade">furos</span>`;
  el('infografico-topo-semana').innerHTML = `${stats.furosTopoSemana}<span class="unidade">furos</span>`;
  el('infografico-topo-mes').innerHTML = `${stats.furosTopoMes}<span class="unidade">furos</span>`;
  el('infografico-metros-ant').innerHTML = `${fmt1(stats.metrosSemanaAnt)}<span class="unidade">m</span>`;
  el('infografico-topo-ant').innerHTML = `${stats.furosTopoSemanaAnt}<span class="unidade">furos</span>`;
  // Compara a semana atual (até agora) com a semana passada inteira.
  const setaVs = (idEl, atual, anterior)=>{
    const e = el(idEl); if(!e) return;
    if(!anterior && !atual){ e.className = 'kpi-vs igual'; e.textContent = ''; return; }
    if(!anterior){ e.className = 'kpi-vs subiu'; e.textContent = '▲ sem base ant.'; return; }
    const pct = Math.round(((atual - anterior) / anterior) * 100);
    if(pct === 0){ e.className = 'kpi-vs igual'; e.textContent = '= igual à semana passada'; return; }
    e.className = 'kpi-vs ' + (pct > 0 ? 'subiu' : 'desceu');
    e.textContent = (pct > 0 ? '▲ +' : '▼ ') + pct + '% vs semana passada';
  };
  setaVs('infografico-metros-semana-vs', stats.metrosSemana, stats.metrosSemanaAnt);
  setaVs('infografico-topo-semana-vs', stats.furosTopoSemana, stats.furosTopoSemanaAnt);

  // Percentuais de perfilagem/topografia — mesma base do checklist.
  const pctPerfilado = stats.totalFuros > 0 ? Math.round((stats.totalPerfilados/stats.totalFuros)*100) : 0;
  const pctTopografado = stats.totalFuros > 0 ? Math.round((stats.totalTopografados/stats.totalFuros)*100) : 0;
  el('infografico-pct-perfilado-texto').textContent = `${stats.totalPerfilados}/${stats.totalFuros}`;
  el('infografico-pct-perfilado-barra').style.width = pctPerfilado + '%';
  el('infografico-pct-topografado-texto').textContent = `${stats.totalTopografados}/${stats.totalFuros}`;
  el('infografico-pct-topografado-barra').style.width = pctTopografado + '%';

  const vazio = el('infografico-vazio');
  if(vazio) vazio.style.display = (stats.totalFuros === 0 && !stats.serieDiaria.some(d=>d.metros > 0)) ? 'block' : 'none';

  // Dois gráficos separados — metros e contagem de furos não dividem o
  // mesmo eixo, senão um dos dois fica ilegível na escala do outro.
  const metaSemanalTotal = equipesDoProjeto().reduce((t,e)=> t + (e.metaSemanal > 0 ? e.metaSemanal : 0), 0);
  desenharGraficoAreaInfografico('infografico-chart-dia', 'infografico-eixo-x', stats.serieDiaria, 'metros', 'var(--amber)', metaSemanalTotal > 0 ? metaSemanalTotal / 7 : 0);
  desenharGraficoAreaInfografico('infografico-chart-topo-dia', 'infografico-eixo-x-topo', stats.serieDiaria, 'furosTopo', 'var(--steel)');
}

