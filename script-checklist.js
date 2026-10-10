// ---------- Checklist: filtros, grupos e seleção em lote ----------
let checklistFiltro = { status:'todos', local:'', busca:'' };
const checklistGruposFechados = new Set(); // "anelId|localização" — só na sessão
let checklistModoSelecao = false;
const checklistSelecionados = new Set();

function lequePendentePerfilagem(c){ return !c.perfilado; }
function lequePendenteTopografia(c){
  const fl = checklistFurosDoLeque(c.id);
  return !(fl.length > 0 && fl.every(f=>f.topografado));
}
function lequeTemObstruido(c){ return checklistFurosDoLeque(c.id).some(f=>f.obstruido); }

// "LQ05 F03", "5 f3", "05" -> { tipo, numero, furo }
function lerBuscaFuro(txt){
  const m = String(txt||'').trim().match(/^(lq|sl|fl|cr|inv|aux)?\s*0*(\d+)\s*(?:[-,. ]*f?\s*0*(\d+))?$/i);
  if(!m) return null;
  const tipo = m[1] ? Object.keys(PREFIXO).find(t=>PREFIXO[t].toLowerCase() === m[1].toLowerCase()) : null;
  return { tipo, numero: m[2], furo: m[3] || null };
}
function filtrarItensChecklist(itens){
  const f = checklistFiltro;
  const lida = lerBuscaFuro(f.busca);
  const busca = (lida ? lida.numero : f.busca.trim()).replace(/^0+/, '');
  return itens.filter(c=>{
    if(f.status === 'pend-perf' && !lequePendentePerfilagem(c)) return false;
    if(f.status === 'pend-topo' && !lequePendenteTopografia(c)) return false;
    if(f.status === 'obstruidos' && !lequeTemObstruido(c)) return false;
    const loc = (c.localizacao||'').trim();
    if(f.local === '__sem__' && loc) return false;
    if(f.local && f.local !== '__sem__' && loc !== f.local) return false;
    if(busca && !String(c.numero).replace(/^0+/, '').includes(busca)) return false;
    return true;
  });
}

function renderFiltrosChecklist(itens){
  const cont = {
    todos: itens.length,
    'pend-perf': itens.filter(lequePendentePerfilagem).length,
    'pend-topo': itens.filter(lequePendenteTopografia).length,
    obstruidos: itens.filter(lequeTemObstruido).length
  };
  const chips = [
    ['todos','Todos',''], ['pend-perf','Perfilar',''], ['pend-topo','Topografar',''], ['obstruidos','Obstruídos','alerta']
  ];
  el('checklist-chips').innerHTML = chips.map(([v, rot, cls])=>
    `<button type="button" class="ck-chip ${cls} ${checklistFiltro.status===v ? 'ativo' : ''}" onclick="definirFiltroChecklist('${v}')" aria-pressed="${checklistFiltro.status===v}" title="${v==='pend-perf' ? 'leques que ainda faltam perfilar' : v==='pend-topo' ? 'leques que ainda faltam topografar' : ''}">${rot}<span class="n">${cont[v]}</span></button>`
  ).join('');

  const locais = [...new Set(itens.map(c=>(c.localizacao||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  const sel = el('checklist-filtro-local');
  const haSemLocal = itens.some(c=>!(c.localizacao||'').trim());
  if(locais.length === 0){ sel.style.display = 'none'; checklistFiltro.local = ''; }
  else{
    sel.style.display = '';
    sel.innerHTML = '<option value="">Todos os locais</option>' +
      locais.map(l=>`<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('') +
      (haSemLocal ? '<option value="__sem__">Sem localização</option>' : '');
    if(![...sel.options].some(o=>o.value === checklistFiltro.local)) checklistFiltro.local = '';
    sel.value = checklistFiltro.local;
  }
  el('btn-checklist-selecionar').textContent = checklistModoSelecao ? 'Concluir seleção' : 'Selecionar';
}

function renderSugestoesLocalChecklist(itens){
  const dl = el('checklist-locais-sugeridos');
  if(!dl) return;
  const locais = [...new Set(itens.map(c=>(c.localizacao||'').trim()).filter(Boolean))];
  dl.innerHTML = locais.map(l=>`<option value="${escHtml(l)}"></option>`).join('');
}

function definirFiltroChecklist(status){
  checklistFiltro.status = status;
  renderChecklist();
}
function alternarGrupoChecklist(idx){
  const k = (window.__ckGrupos || [])[idx];
  if(k === undefined) return;
  const chave = anelAtivoId + '|' + k;
  if(checklistGruposFechados.has(chave)) checklistGruposFechados.delete(chave);
  else checklistGruposFechados.add(chave);
  renderChecklist();
}

function horaCurta(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const hh = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  return d.toDateString() === hoje.toDateString() ? hh : String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + ' ' + hh;
}
// Etiqueta curta com a equipe que marcou o furo (perf · topo), para ver sem abrir o furo.
function siglaEquipe(id){
  const n = nomeDaEquipeId(id); if(!n) return '';
  const m = n.match(/^equipe\s+(.+)$/i); const t = (m ? m[1] : n).trim();
  return t.length <= 3 ? t.toUpperCase() : t.slice(0,3).toUpperCase();
}
function corEquipe(id){ let h = 0; for(const ch of String(id)) h = (h*31 + ch.charCodeAt(0)) % 360; return h; }
// Equipe de quem obstruiu: a gravada; nas marcas antigas, a equipe atual do autor (se vinculado).
function equipeObsEfetivaId(f){
  if(f.equipeObsId) return f.equipeObsId;
  if(!f.obstruido || !f.obstruidoPor || typeof usuariosEmpresa === 'undefined') return null;
  const a = String(f.obstruidoPor).toLowerCase();
  const u = usuariosEmpresa.find(x=> (x.nome||'').toLowerCase() === a || (x.email||'').split('@')[0].toLowerCase() === a);
  return u ? u.equipeId : null;
}
function htmlEtiquetaEquipeFuro(f){
  if(f.obstruido){
    const o = equipeObsEfetivaId(f);
    return o && siglaEquipe(o) ? `<span class="ck-eq-tags"><b class="ck-eq-tag" style="--h:${corEquipe(o)}" title="obstruiu: ${escHtml(nomeDaEquipeId(o))}">${escHtml(siglaEquipe(o))}</b></span>` : '';
  }
  const p = f.perfilado ? equipePerfEfetivaId(f) : null, t = f.topografado ? equipeTopoEfetivaId(f) : null;
  if(!p && !t) return '';
  const chip = (id, rot)=> id && siglaEquipe(id) ? `<b class="ck-eq-tag" style="--h:${corEquipe(id)}" title="${rot}: ${escHtml(nomeDaEquipeId(id))}">${escHtml(siglaEquipe(id))}</b>` : '';
  if(p && t && p === t) return `<span class="ck-eq-tags">${chip(p,'perfilou e topografou')}</span>`;
  const vazio = '<b class="ck-eq-tag vazio" title="sem equipe registrada">–</b>';
  return `<span class="ck-eq-tags">${chip(p,'perfilou') || (f.perfilado ? vazio : '')}${chip(t,'topografou') || (f.topografado ? vazio : '')}</span>`;
}
function textoQuemQuando(f){
  const partes = [];
  const eqP = nomeDaEquipeId(equipePerfEfetivaId(f)), eqT = nomeDaEquipeId(equipeTopoEfetivaId(f));
  if(f.perfilado && (f.perfiladoPor || f.perfiladoEm)) partes.push(`perfilado${f.perfiladoPor ? ' por ' + f.perfiladoPor : ''}${eqP ? ' (' + eqP + ')' : ''} ${horaCurta(f.perfiladoEm)}`.trim());
  if(f.topografado && (f.topografadoPor || f.topografadoEm)) partes.push(`topografado${f.topografadoPor ? ' por ' + f.topografadoPor : ''}${eqT ? ' (' + eqT + ')' : ''} ${horaCurta(f.topografadoEm)}`.trim());
  if(f.obstruido && f.obstruidoPor){ const eqO = nomeDaEquipeId(equipeObsEfetivaId(f)); partes.push(`obstruído por ${f.obstruidoPor}${eqO ? ' (' + eqO + ')' : ''}`); }
  return partes.join(' · ');
}
// Vários furos obstruídos no mesmo leque costumam indicar problema da região (queda de rocha,
// tela fechada), não do furo. Alerta a partir de 3 obstruídos, ou 2 se for metade do leque ou mais.
function obstrucaoAlta(obstr, total){
  return obstr >= 3 || (obstr >= 2 && total > 0 && obstr / total >= 0.5);
}
// Estado visual do leque: completo (verde), em andamento (amarelo), obstrução alta (vermelho) ou não iniciado (cinza).
function estadoDoLeque(furos){
  const obstr = furos.filter(f=>f.obstruido).length;
  if(obstrucaoAlta(obstr, furos.length)) return 'obs';
  if(furos.length && furos.every(f=> f.obstruido || (f.perfilado && f.topografado))) return 'ok';
  if(furos.some(f=> f.perfilado || f.topografado || f.obstruido)) return 'and';
  return 'ini';
}
const ICONE_ESTADO = { ok:'✓', and:'◐', obs:'⚠', ini:'○' };
const ROTULO_ESTADO = { ok:'completo', and:'em andamento', obs:'obstrução alta', ini:'não iniciado' };
function htmlCardChecklist(c, agrupado){
  const codigo = PREFIXO[c.tipo] + c.numero;
  const expandido = checklistExpandido.has(c.id);
  const furos = checklistFurosDoLeque(c.id);
  const feitos = furos.filter(f=>f.perfilado).length;
  const topo = furos.filter(f=>f.topografado).length;
  const obstr = furos.filter(f=>f.obstruido).length;
  const pct = n=> furos.length ? Math.round((n / furos.length) * 100) : 0;
  const sel = checklistSelecionados.has(c.id);
  const caixa = checklistModoSelecao
    ? `<label class="ck-check" onclick="event.stopPropagation()"><input type="checkbox" class="ck-sel" ${sel ? 'checked' : ''} onchange="alternarSelecaoLeque('${c.id}')" aria-label="selecionar ${codigo}"></label>`
    : `<label class="ck-check" onclick="event.stopPropagation()"><input type="checkbox" ${c.perfilado ? 'checked' : ''} onchange="toggleChecklistLeque('${c.id}')" aria-label="marcar ${codigo} como perfilado" title="marcar leque como perfilado"></label>`;
  const progresso = furos.length ? `
      <div class="ck-progresso">
        <div class="ck-prog-linha"><span class="rot">perf</span><span class="ck-prog-bar"><i style="width:${pct(feitos)}%"></i></span><span class="num">${feitos===furos.length ? '✓' : ''}${feitos}/${furos.length}</span></div>
        <div class="ck-prog-linha topo"><span class="rot">topo</span><span class="ck-prog-bar"><i style="width:${pct(topo)}%"></i></span><span class="num">${topo===furos.length ? '✓' : ''}${topo}/${furos.length}</span></div>
      </div>`
    : `<div class="ck-progresso"><span class="ck-sem-furos">sem furos ainda</span></div>`;
  const local = (c.localizacao||'').trim();
  const localNoResumo = local && !agrupado ? `<b>Local:</b> ${escHtml(local)}` : '';
  const eqTxt = textoEquipesLeque(c);
  const partesResumo = [localNoResumo, c.observacao ? `<b>Obs:</b> ${escHtml(c.observacao)}` : '', eqTxt].filter(Boolean);
  const resumo = partesResumo.length && !expandido
    ? `<div class="ck-resumo-texto">${partesResumo.join(' · ')}</div>` : (eqTxt ? `<div class="ck-resumo-texto">${eqTxt}</div>` : '');

  let corpo = '';
  if(expandido){
    const tabela = furos.length === 0 ? '<div class="hint">Nenhum furo nesse leque do checklist ainda.</div>' : `
          <table class="checklist-furos-tabela">
            <thead><tr><th>Furo</th><th title="perfilado">Perf.</th><th title="topografado">Topo</th><th title="obstruído (rocha ou tela)">Obstr.</th><th></th></tr></thead>
            <tbody>
              ${furos.map(f=>`
                <tr class="${f.perfilado ? 'feito' : ''} ${f.obstruido ? 'obstruido' : ''}">
                  <td><button type="button" class="ck-furo-num ${((c.equipePerfId && f.equipePerfId && f.equipePerfId !== c.equipePerfId)||(c.equipeTopoId && f.equipeTopoId && f.equipeTopoId !== c.equipeTopoId)) ? 'excecao' : ''}" onclick="alternarEquipeFuro('${f.id}')" aria-expanded="${furosComEquipeAberta.has(f.id)}" title="equipe deste furo (toque para alterar)">F${f.numero}${((c.equipePerfId && f.equipePerfId && f.equipePerfId !== c.equipePerfId)||(c.equipeTopoId && f.equipeTopoId && f.equipeTopoId !== c.equipeTopoId)) ? '<i aria-label="equipe diferente do leque">●</i>' : ''}</button>${htmlEtiquetaEquipeFuro(f)}</td>
                  <td class="${f.obstruido ? 'bloq' : ''}"><input type="checkbox" ${f.perfilado ? 'checked' : ''} ${f.obstruido ? 'disabled' : ''} onchange="toggleChecklistFuro('${f.id}')" title="perfilado" aria-label="F${f.numero} perfilado"></td>
                  <td class="${f.obstruido ? 'bloq' : ''}"><input type="checkbox" ${f.topografado ? 'checked' : ''} ${f.obstruido ? 'disabled' : ''} onchange="toggleChecklistFuroTopografado('${f.id}')" title="topografado" aria-label="F${f.numero} topografado"></td>
                  <td><input type="checkbox" class="chk-obstruido" ${f.obstruido ? 'checked' : ''} onchange="definirObstrucaoChecklistFuro('${f.id}', this.checked ? '${OBSTRUIDO_VALOR}' : '')" title="furo obstruído (rocha ou tela)" aria-label="F${f.numero} obstruído"></td>
                  <td class="ck-acoes-furo"><button type="button" class="icon icon-nota ${f.observacao ? 'tem' : ''}" onclick="editarObservacaoFuro('${f.id}')" title="${f.observacao ? 'editar anotação' : 'anotar neste furo'}" aria-label="anotação de F${f.numero}">✎</button><button type="button" class="icon icon-remover" onclick="removerChecklistFuro('${f.id}')" title="remover furo" aria-label="remover F${f.numero}">✕</button></td>
                </tr>
                ${f.observacao ? `<tr class="ck-furo-nota"><td colspan="5"><span>📝 ${escHtml(f.observacao)}</span></td></tr>` : ''}
                ${furosComEquipeAberta.has(f.id) ? `<tr class="ck-furo-eq"><td colspan="5">
                  <label>Perfilagem<select onchange="definirEquipeFuro('${f.id}','perf',this.value)" aria-label="F${f.numero} equipe da perfilagem">${htmlOpcoesEquipe(f.equipePerfId,'Igual ao leque')}</select></label>
                  <label>Topografia<select onchange="definirEquipeFuro('${f.id}','topo',this.value)" aria-label="F${f.numero} equipe da topografia">${htmlOpcoesEquipe(f.equipeTopoId,'Igual ao leque')}</select></label>
                </td></tr>` : ''}
              `).join('')}
            </tbody>
          </table>
          ${(()=>{
            const linhas = furos.map(f=>({ f, t: textoQuemQuando(f) })).filter(x=>x.t);
            return linhas.length ? `<details class="ck-quem"><summary>Quem marcou (${linhas.length})</summary>${linhas.map(x=>`<div><b>F${escHtml(x.f.numero)}</b> ${escHtml(x.t)}</div>`).join('')}</details>` : '';
          })()}`;
    corpo = `
      <div class="ck-corpo">
        ${htmlSeletoresEquipeLeque(c)}
        <div class="checklist-leque-meta">
          <div class="checklist-leque-local">
            ${c.localizacao ? `
              <span class="local-rotulo">Local:</span><span class="texto">${escHtml(c.localizacao)}</span>
              <button type="button" class="icon icon-editar" onclick="editarLocalizacaoChecklistLeque('${c.id}')" title="editar localização" aria-label="editar localização">✎</button>
            ` : `<button type="button" class="link-obs" onclick="editarLocalizacaoChecklistLeque('${c.id}')">+ localização</button>`}
          </div>
          <div class="checklist-leque-obs">
            ${c.observacao ? `
              <span class="texto">${escHtml(c.observacao)}</span>
              <button type="button" class="icon icon-editar" onclick="editarObservacaoChecklistLeque('${c.id}')" title="editar observação" aria-label="editar observação">✎</button>
              <button type="button" class="icon icon-remover" onclick="removerObservacaoChecklistLeque('${c.id}')" title="remover observação" aria-label="remover observação">✕</button>
            ` : `<button type="button" class="link-obs" onclick="editarObservacaoChecklistLeque('${c.id}')">+ observação</button>`}
          </div>
        </div>
        <div class="checklist-furos-body">
          <div class="checklist-furos-add">
            <input type="text" inputmode="numeric" placeholder="de" id="cf-de-${c.id}" aria-label="furo inicial">
            <input type="text" inputmode="numeric" placeholder="até (opcional)" id="cf-ate-${c.id}" aria-label="furo final">
            <button type="button" onclick="adicionarFurosAoChecklist('${c.id}')">+ Adicionar furos</button>
          </div>
          ${tabela}
        </div>
        <div class="ck-ferramentas">
          <button type="button" class="ghost" onclick="moverLequeChecklist('${c.id}', -1)" aria-label="mover ${codigo} para cima">▲ Subir</button>
          <button type="button" class="ghost" onclick="moverLequeChecklist('${c.id}', 1)" aria-label="mover ${codigo} para baixo">▼ Descer</button>
          ${furos.length ? `
            <button type="button" class="ghost" onclick="aplicarLoteChecklist('perfilado', ['${c.id}'])">Todos perfilados</button>
            <button type="button" class="ghost" onclick="aplicarLoteChecklist('topografado', ['${c.id}'])">Todos topografados</button>` : ''}
          <button type="button" class="ghost" onclick="enviarLequeWhatsApp('${c.id}')">Enviar no WhatsApp</button>
          <button type="button" class="ghost perigo" onclick="removerChecklistLeque('${c.id}')">Remover leque</button>
        </div>
      </div>`;
  }

  return `
    <div class="checklist-leque-card ${c.perfilado ? 'feito' : ''} ${sel ? 'selecionado' : ''} ${obstrucaoAlta(obstr, furos.length) ? 'obstr-alta' : ''}" id="ck-card-${c.id}" data-est="${estadoDoLeque(furos)}" title="Leque ${ROTULO_ESTADO[estadoDoLeque(furos)]}">
      <div class="ck-cab" role="button" tabindex="0" aria-expanded="${expandido}" onclick="toggleExpandirChecklist('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleExpandirChecklist('${c.id}')}">
        ${checklistModoSelecao ? '' : `<button type="button" class="ck-arrastar" aria-label="arrastar ${codigo} para reorganizar" title="segure e arraste para mudar a posição" onpointerdown="iniciarArrasteChecklist(event, '${c.id}')" onclick="event.stopPropagation()">⠿</button>`}
        ${caixa}
        <span class="ck-codigo">${codigo}<span class="seta">${expandido ? '▾' : '▸'}</span><span class="ck-est-ico" data-est="${estadoDoLeque(furos)}" role="img" aria-label="${ROTULO_ESTADO[estadoDoLeque(furos)]}">${ICONE_ESTADO[estadoDoLeque(furos)]}</span></span>
        ${progresso}
        ${obstr ? (obstrucaoAlta(obstr, furos.length)
          ? `<span class="ck-obstr alta" title="${obstr} de ${furos.length} furos obstruídos: possível problema na região deste leque" aria-label="atenção: ${obstr} de ${furos.length} furos obstruídos">⚠ ${obstr}/${furos.length}<span class="txt"> obstr.</span></span>`
          : `<span class="ck-obstr" title="furos obstruídos neste leque" aria-label="${obstr} furo(s) obstruído(s)">⛔ ${obstr}</span>`) : ''}
      </div>
      ${estadoDoLeque(furos) === 'ok' ? '<span class="ck-selo-ok" aria-label="leque completo" title="leque completo">✓</span>' : ''}
      ${resumo}
      ${corpo}
    </div>`;
}

// Seleção em lote: marca vários leques de uma vez (respeitando os filtros).
function alternarModoSelecaoChecklist(){
  checklistModoSelecao = !checklistModoSelecao;
  if(!checklistModoSelecao) checklistSelecionados.clear();
  renderChecklist();
}
function alternarSelecaoLeque(id){
  if(checklistSelecionados.has(id)) checklistSelecionados.delete(id);
  else checklistSelecionados.add(id);
  renderChecklist();
}
function selecionarVisiveisChecklist(){
  (window.__ckVisiveisIds || []).forEach(id=> checklistSelecionados.add(id));
  renderChecklist();
}
function renderBarraLoteChecklist(visiveis){
  const barra = el('checklist-acoes-lote');
  if(!barra) return;
  if(!checklistModoSelecao){ barra.style.display = 'none'; barra.innerHTML = ''; return; }
  barra.style.display = 'flex';
  const n = checklistSelecionados.size;
  barra.innerHTML = `
    <span class="qtd">${n} leque${n===1?'':'s'} selecionado${n===1?'':'s'}</span>
    <button type="button" class="ghost" onclick="selecionarVisiveisChecklist()">Selecionar visíveis (${visiveis.length})</button>
    <button type="button" class="steel" onclick="aplicarLoteChecklist('perfilado')" ${n?'':'disabled'}>Marcar perfilados</button>
    <button type="button" class="steel" onclick="aplicarLoteChecklist('topografado')" ${n?'':'disabled'}>Marcar topografados</button>
    <button type="button" class="ghost" onclick="aplicarLoteChecklist('limpar')" ${n?'':'disabled'}>Limpar marcas</button>`;
}

// Aplica uma marcação a todos os furos dos leques informados (ou dos selecionados).
// Furos obstruídos (rocha/tela) ficam de fora: não dá pra perfilar/topografar.
async function aplicarLoteChecklist(acao, idsExplicitos){
  const ids = idsExplicitos || [...checklistSelecionados];
  const leques = ids.map(id=> checklistLeques.find(c=>c.id===id)).filter(Boolean);
  if(!leques.length) return;
  if(acao === 'limpar' && !(await confirmDialog(`Limpar as marcas de perfilagem e topografia de ${leques.length} leque(s)?`, 'Limpar'))) return;

  const agora = new Date().toISOString();
  const snapLeques = [], snapFuros = [];
  let furosAlterados = 0, puladosObstruidos = 0, bloqueadosLimpar = 0;
  leques.forEach(c=>{
    snapLeques.push({ id:c.id, perfilado:c.perfilado });
    const furos = checklistFurosDoLeque(c.id);
    if(acao === 'perfilado' && !c.perfilado){
      c.perfilado = true; enfileirar('checklist_leques', 'update', { id:c.id, perfilado:true });
    }
    if(acao === 'limpar' && c.perfilado && podeDesmarcar(c.perfiladoPor, c.equipePerfId)){
      c.perfilado = false; enfileirar('checklist_leques', 'update', { id:c.id, perfilado:false });
    }
    furos.forEach(f=>{
      const antes = { id:f.id, perfilado:f.perfilado, perfiladoEm:f.perfiladoEm, topografado:f.topografado, topografadoEm:f.topografadoEm };
      let mudou = false;
      if(acao === 'limpar'){
        if((f.perfilado && !podeDesmarcarFuro(f,'perf')) || (f.topografado && !podeDesmarcarFuro(f,'topo'))){ bloqueadosLimpar++; }
        else if(f.perfilado || f.topografado){
          f.perfilado = false; f.perfiladoEm = null; f.topografado = false; f.topografadoEm = null; mudou = true;
        }
      }else if(f.obstruido){
        puladosObstruidos++;
      }else if(acao === 'perfilado' && !f.perfilado){
        f.perfilado = true; f.perfiladoEm = agora; mudou = true;
      }else if(acao === 'topografado' && !f.topografado){
        f.topografado = true; f.topografadoEm = agora; mudou = true;
      }
      if(mudou){
        snapFuros.push(antes); furosAlterados++;
        const reg = { id:f.id };
        if(acao !== 'topografado'){ reg.perfilado = f.perfilado; reg.perfilado_em = f.perfiladoEm; }
        if(acao !== 'perfilado'){ reg.topografado = f.topografado; reg.topografado_em = f.topografadoEm; }
        enfileirar('checklist_furos', 'update', reg);
      }
    });
  });
  salvarChecklistLocal();
  salvarChecklistFurosLocal();
  if(!idsExplicitos){ checklistSelecionados.clear(); checklistModoSelecao = false; }
  renderChecklist();

  const rot = acao === 'perfilado' ? 'perfilados' : acao === 'topografado' ? 'topografados' : 'limpos';
  showToast(`${furosAlterados} furo(s) de ${leques.length} leque(s) marcados como ${rot}.${puladosObstruidos ? ' ('+puladosObstruidos+' obstruído(s) ignorado(s))' : ''}${bloqueadosLimpar ? ' ('+bloqueadosLimpar+' de outra equipe mantido(s))' : ''}`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerLoteChecklist(snapLeques, snapFuros)
  });
}
function desfazerLoteChecklist(snapLeques, snapFuros){
  snapLeques.forEach(s=>{
    const c = checklistLeques.find(x=>x.id===s.id);
    if(c && c.perfilado !== s.perfilado){ c.perfilado = s.perfilado; enfileirar('checklist_leques', 'update', { id:c.id, perfilado:c.perfilado }); }
  });
  snapFuros.forEach(s=>{
    const f = checklistFuros.find(x=>x.id===s.id);
    if(!f) return;
    f.perfilado = s.perfilado; f.perfiladoEm = s.perfiladoEm; f.topografado = s.topografado; f.topografadoEm = s.topografadoEm;
    enfileirar('checklist_furos', 'update', { id:f.id, perfilado:f.perfilado, perfilado_em:f.perfiladoEm, topografado:f.topografado, topografado_em:f.topografadoEm });
  });
  salvarChecklistLocal();
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast('Desfeito.');
}

(function ligarFiltrosChecklist(){
  const busca = document.getElementById('checklist-busca');
  const local = document.getElementById('checklist-filtro-local');
  const sel = document.getElementById('btn-checklist-selecionar');
  const det = document.getElementById('checklist-adicionar');
  if(busca) busca.addEventListener('input', ()=>{ checklistFiltro.busca = busca.value; renderChecklist(); });
  if(busca) busca.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); irParaFuroBuscado(busca.value); } });
  if(local) local.addEventListener('change', ()=>{ checklistFiltro.local = local.value; renderChecklist(); });
  if(sel) sel.addEventListener('click', alternarModoSelecaoChecklist);
  if(det) det.addEventListener('toggle', ()=>{ if(det.dataset.prog){ delete det.dataset.prog; return; } det.dataset.tocado = '1'; });
})();

// Agrupa códigos consecutivos do mesmo tipo em intervalos (LQ01, LQ02, LQ03,
// LQ04, LQ05 vira "LQ01 ao LQ05") — reduz bastante a poluição visual de
// listas longas na mensagem do WhatsApp. Só vira intervalo a partir de 3
// seguidos; com 1 ou 2, listar direto já é igual de curto ou mais claro.
function compactarCodigosEmIntervalos(itens){
  const porTipo = {};
  itens.forEach(it=>{
    if(!porTipo[it.tipo]) porTipo[it.tipo] = [];
    porTipo[it.tipo].push(it.numero);
  });

  const blocos = [];
  Object.keys(porTipo).forEach(tipo=>{
    const prefixo = PREFIXO[tipo] || tipo;
    // Ordena numericamente mas guarda o texto original (com zero à esquerda,
    // tipo "01") pra exibir igual foi digitado.
    const numeros = porTipo[tipo]
      .map(n=> ({ texto: n, valor: parseInt(n, 10) }))
      .sort((a,b)=> a.valor - b.valor);

    let inicio = 0;
    for(let i = 1; i <= numeros.length; i++){
      const fimDaSequencia = i === numeros.length || numeros[i].valor !== numeros[i-1].valor + 1;
      if(fimDaSequencia){
        const grupo = numeros.slice(inicio, i);
        if(grupo.length >= 3){
          blocos.push(`${prefixo}${grupo[0].texto} ao ${prefixo}${grupo[grupo.length-1].texto}`);
        }else{
          grupo.forEach(g=> blocos.push(`${prefixo}${g.texto}`));
        }
        inicio = i;
      }
    }
  });
  return blocos;
}

// Monta o bloco de resumo (leques + furos) de UM realce — reaproveitado tanto
// pra mandar um realce só quanto pra combinar vários no mesmo relatório.
// Furos obstruídos (rocha ou tela) dos leques informados, um leque por linha:
// "LQ01 (Galeria Norte): F02, F05". Vazio se não houver nenhum.
function blocoObstruidosWhatsApp(itens){
  const linhas = [];
  itens.forEach(c=>{
    const obs = checklistFurosDoLeque(c.id).filter(f=>f.obstruido);
    if(!obs.length) return;
    const local = (c.localizacao||'').trim();
    const furos = obs.map(f=>`F${f.numero}`).join(', ');
    const total = checklistFurosDoLeque(c.id).length;
    const alerta = obstrucaoAlta(obs.length, total) ? ` ⚠️ ATENCAO: ${obs.length} de ${total} furos obstruidos` : '';
    linhas.push(`${PREFIXO[c.tipo]}${c.numero}${local ? ' ('+semAcento(local)+')' : ''}: ${furos}${alerta}`);
  });
  return linhas.length ? `⛔ *FUROS OBSTRUIDOS*\n${linhas.join('\n')}` : '';
}
function blocoNotasFurosWhatsApp(itens){
  const linhas = [];
  itens.forEach(c=> checklistFurosDoLeque(c.id).filter(f=>f.observacao).forEach(f=> linhas.push(`${PREFIXO[c.tipo]}${c.numero} F${f.numero}: ${semAcento(f.observacao)}`)));
  return linhas.length ? `📝 *NOTAS DOS FUROS*\n${linhas.join('\n')}` : '';
}

function barraWa(pct){ const n = Math.round(Math.max(0,Math.min(100,pct))/10); return '▓'.repeat(n) + '░'.repeat(10-n); }
function semAcento(t){ return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Resumo (leques + furos + listas) de um conjunto de leques do checklist.
function resumoChecklistItens(itens){
  const feitos = itens.filter(c=>c.perfilado).length;
  const ids = new Set(itens.map(c=>c.id));
  const todosFuros = checklistFuros.filter(f=>ids.has(f.checklistLequeId));
  const fp = todosFuros.filter(f=>f.perfilado).length;
  const ft = todosFuros.filter(f=>f.topografado).length;
  const total = todosFuros.length;
  const pf = total > 0 ? Math.round((fp / total) * 100) : 0;
  const pt = total > 0 ? Math.round((ft / total) * 100) : 0;
  const topo = c=>{ const fl = checklistFurosDoLeque(c.id); return fl.length > 0 && fl.every(f=>f.topografado); };
  const lista = (rotulo, codigos)=> codigos.length ? `*${rotulo}*\n${codigos.join('\n')}\n` : '';
  let t = `Leques: ${feitos}/${itens.length} perfilados\n`;
  t += `Furos perfilados: ${fp}/${total} (${pf}%)\n${barraWa(pf)}\nFuros topografados: ${ft}/${total} (${pt}%)\n${barraWa(pt)}\n`;
  t += lista('✅ PERFILADOS', compactarCodigosEmIntervalos(itens.filter(c=>c.perfilado)));
  t += lista('🟡 PENDENTES', compactarCodigosEmIntervalos(itens.filter(c=>!c.perfilado)));
  t += `\n`;
  t += lista('✅ TOPOGRAFADOS', compactarCodigosEmIntervalos(itens.filter(topo)));
  t += lista('🟡 PENDENTES TOPOGRAFIA', compactarCodigosEmIntervalos(itens.filter(c=>!topo(c))));
  return t.trim();
}

// Realce com leques em áreas diferentes: cada localização vira uma seção própria
// (o mesmo número de leque pode existir em mais de uma área).
function montarBlocoRealceComLocais(anelId, itens, nomeRealce){
  const grupos = new Map();
  itens.forEach(c=>{
    const chave = (c.localizacao || '').trim();
    if(!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(c);
  });
  const chaves = [...grupos.keys()]; // ordem em que cada localização apareceu pela primeira vez
  let bloco = `📍 *Realce ${semAcento(nomeRealce)}*\n`;
  const partes = chaves.map(k=>{
    const titulo = k ? `*Local: ${semAcento(k)}*` : `*Local nao informado*`;
    return `${titulo}\n${resumoChecklistItens(grupos.get(k))}`;
  });
  bloco += partes.join('\n\n');
  const obstruidos = blocoObstruidosWhatsApp(itens);
  if(obstruidos) bloco += `\n\n${obstruidos}`;
  const notasF = blocoNotasFurosWhatsApp(itens);
  if(notasF) bloco += `\n\n${notasF}`;
  const porEquipe = blocoEquipesWhatsApp(itens);
  if(porEquipe) bloco += `\n\n${porEquipe}`;
  const comObs = itens.filter(c=>c.observacao);
  if(comObs.length){
    bloco += `\n\n📝 *OBSERVACOES DOS LEQUES*\n`;
    bloco += comObs.map(c=> `${PREFIXO[c.tipo]}${c.numero}${c.localizacao ? ' ('+semAcento(c.localizacao)+')' : ''}: ${c.observacao}`).join('\n');
  }
  const obsGerais = checklistObsGeraisDoAnel(anelId);
  if(obsGerais.length){
    bloco += `\n\n📝 *OBSERVACOES GERAIS*\n`;
    bloco += obsGerais.map(o=> `- ${o.texto}`).join('\n');
  }
  return bloco.trim();
}

function montarBlocoRealceParaWhatsApp(anelId){
  const anel = aneis.find(a=>a.id===anelId);
  const nomeRealce = anel ? anel.nome : '-';
  const itens = checklistDoAnel(anelId);
  if(itens.some(c=>(c.localizacao||'').trim())) return montarBlocoRealceComLocais(anelId, itens, nomeRealce);
  const feitos = itens.filter(c=>c.perfilado).length;

  const idsLequesChecklist = new Set(itens.map(c=>c.id));
  const todosFuros = checklistFuros.filter(f=>idsLequesChecklist.has(f.checklistLequeId));
  const furosPerfilados = todosFuros.filter(f=>f.perfilado).length;
  const furosTopografados = todosFuros.filter(f=>f.topografado).length;
  const totalFuros = todosFuros.length;
  const pctFuros = totalFuros > 0 ? Math.round((furosPerfilados / totalFuros) * 100) : 0;
  const pctTopo = totalFuros > 0 ? Math.round((furosTopografados / totalFuros) * 100) : 0;

  const codigosPerfilados = compactarCodigosEmIntervalos(itens.filter(c=>c.perfilado));
  const codigosPendentes = compactarCodigosEmIntervalos(itens.filter(c=>!c.perfilado));

  // Topografia por leque — usa os furos já marcados no checklist (não é um
  // campo novo): um leque conta como topografado quando tem furo lançado e
  // TODOS os furos dele já estão marcados como topografados.
  const codigosTopografados = compactarCodigosEmIntervalos(itens.filter(c=>{
    const furosDoLeque = checklistFurosDoLeque(c.id);
    return furosDoLeque.length > 0 && furosDoLeque.every(f=>f.topografado);
  }));
  const codigosPendentesTopografia = compactarCodigosEmIntervalos(itens.filter(c=>{
    const furosDoLeque = checklistFurosDoLeque(c.id);
    return !(furosDoLeque.length > 0 && furosDoLeque.every(f=>f.topografado));
  }));

  if(itens.length === 0 && checklistObsGeraisDoAnel(anelId).length === 0){
    return `📍 *Realce ${nomeRealce}*\nNada no checklist ainda.`;
  }

  let bloco = `📍 *Realce ${nomeRealce}*\n`;
  if(itens.length > 0){
    bloco += `Leques: ${feitos}/${itens.length} perfilados\n`;
    bloco += `Furos perfilados: ${furosPerfilados}/${totalFuros} (${pctFuros}%)\n${barraWa(pctFuros)}\nFuros topografados: ${furosTopografados}/${totalFuros} (${pctTopo}%)\n${barraWa(pctTopo)}\n`;
    // Cada intervalo (ou leque avulso) vai numa linha própria, pra ler de relance.
    const lista = (rotulo, codigos)=> codigos.length ? `*${rotulo}*\n${codigos.join('\n')}\n` : '';
    bloco += lista('✅ PERFILADOS', codigosPerfilados);
    bloco += lista('🟡 PENDENTES', codigosPendentes);
    bloco += `\n`;
    bloco += lista('✅ TOPOGRAFADOS', codigosTopografados);
    bloco += lista('🟡 PENDENTES TOPOGRAFIA', codigosPendentesTopografia);
    bloco = bloco.trim();
  }

  // Observações lançadas em cada leque do checklist — ajuda quem lê a
  // entender o "porquê" por trás dos números, não só o placar.
  const obstruidosTxt = blocoObstruidosWhatsApp(itens);
  if(obstruidosTxt) bloco += `\n\n${obstruidosTxt}`;
  const notasFTxt = blocoNotasFurosWhatsApp(itens);
  if(notasFTxt) bloco += `\n\n${notasFTxt}`;
  const porEquipeTxt = blocoEquipesWhatsApp(itens);
  if(porEquipeTxt) bloco += `\n\n${porEquipeTxt}`;
  const lequesComObs = itens.filter(c=>c.observacao);
  if(lequesComObs.length){
    bloco += `\n\n📝 *OBSERVACOES DOS LEQUES*\n`;
    bloco += lequesComObs.map(c=> `${PREFIXO[c.tipo]}${c.numero}: ${c.observacao}`).join('\n');
  }

  // Observações gerais do realce (não ligadas a nenhum leque específico).
  const obsGerais = checklistObsGeraisDoAnel(anelId);
  if(obsGerais.length){
    bloco += `\n\n📝 *OBSERVACOES GERAIS*\n`;
    bloco += obsGerais.map(o=> `- ${o.texto}`).join('\n');
  }

  return bloco.trim();
}

// Monta o relatório completo — um ou vários realces, cada um no seu bloco,
// pra equipe se orientar mesmo quando turnos diferentes perfilaram realces
// diferentes.
function montarRelatorioChecklistParaWhatsApp(idsRealces){
  let msg = `📋 *CHECKLIST DE PERFILAGEM*\n`;
  msg += `${new Date().toLocaleString('pt-BR')}\n`;
  msg += `${idsRealces.length} realce${idsRealces.length>1?'s':''}\n\n`;
  msg += idsRealces.map(id=> montarBlocoRealceParaWhatsApp(id)).join('\n\n----------\n\n');
  msg += '\n\n==========\n\n' + montarBlocoProdutividadeSemanalWhatsApp();
  msg += '\n\n----------\n\n' + montarBlocoProdutividadeMensalWhatsApp();
  return msg.trim();
}

// Rodape do relatorio: produtividade da SEMANA ATUAL por equipe, com os nomes
// dos integrantes. Texto so em ASCII (sem acentos), como o resto da mensagem.
function montarBlocoProdutividadeSemanalWhatsApp(){
  const inicio = inicioDaSemana(new Date());
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 6);
  const semana = dataISOLocal(inicio);
  const projeto = configApp.projetoAtivo || '';
  const dd = d => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  const num = n => (Math.round(n*10)/10).toFixed(1).replace('.', ',');
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const semAcento = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = equipesDoProjeto();
  let out = `📈 *PRODUTIVIDADE SEMANAL*\n${dd(inicio)} a ${dd(fim)}${projeto ? ' - Projeto ' + semAcento(projeto) : ''}\n\n`;
  if(lista.length === 0) return out + 'Nenhuma equipe cadastrada neste projeto.';
  let totM = 0, totP = 0;
  out += lista.map(e=>{
    const r = somaLancamentos(e.id, dataISOLocal(inicio), dataISOLocal(fim));
    const m = r.metros, p = r.pontos;
    totM += m; totP += p;
    const dados = (r.qtd === 0) ? 'sem lancamento' : `${num(m)} m perfilados | ${plural(p, 'ponto topografado', 'pontos topografados')}`;
    return `*${semAcento(e.nome)}*${e.integrantes ? ' (' + semAcento(e.integrantes) + ')' : ''}\n${dados}`;
  }).join('\n\n');
  out += `\n\n*Total da semana:* ${num(totM)} m perfilados | ${plural(totP, 'ponto topografado', 'pontos topografados')}`;
  return out;
}

function montarBlocoProdutividadeMensalWhatsApp(){
  const chave = chaveMesComOffset(0);
  const semAcento = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = n => (Math.round(n*10)/10).toFixed(1).replace('.', ',');
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const { lista, porEquipe, semanas } = calcularProdutividadeMensal(chave);
  const projeto = configApp.projetoAtivo || '';
  let out = `📈 *PRODUTIVIDADE MENSAL*\n${semAcento(nomeMesDaChave(chave))}${projeto ? ' - Projeto ' + semAcento(projeto) : ''}\n\n`;
  if(lista.length === 0) return out + 'Nenhuma equipe cadastrada neste projeto.';
  let totM = 0, totP = 0;
  out += lista.map(e=>{
    const d = porEquipe[e.id]; totM += d.metros; totP += d.pontos;
    return `*${semAcento(e.nome)}*${e.integrantes ? ' (' + semAcento(e.integrantes) + ')' : ''}\n${num(d.metros)} m perfilados | ${plural(d.pontos, 'ponto topografado', 'pontos topografados')}`;
  }).join('\n\n');
  out += `\n\n*Total do mes:* ${num(totM)} m perfilados | ${plural(totP, 'ponto topografado', 'pontos topografados')}`;
  out += `\n(${semanas.length} ${semanas.length === 1 ? 'dia com lancamento' : 'dias com lancamento'})`;
  return out;
}

// ---------- Resumo de fim de turno (um toque) ----------
// Junta num só texto: dados do turno, o que foi feito HOJE (por pessoa), metros das
// equipes, situação do realce ativo (pendentes, obstruídos) e as observações do turno.
function montarResumoTurnoWhatsApp(){
  const A = semAcento;
  const num = n => (Math.round(n*10)/10).toFixed(1).replace('.', ',');
  const dia = dataBRParaISO(turnoInfo.data) || chaveDia(new Date());
  const [ano, mes, dd] = dia.split('-');
  const noDia = iso => iso && chaveDia(iso) === dia;
  const turnoTxt = turnoInfo.turnoNumero ? `Turno ${turnoInfo.turnoNumero}${turnoInfo.turnoLetra ? ' ' + turnoInfo.turnoLetra : ''}` : 'Turno nao informado';
  let t = `📋 *RESUMO DO TURNO*\n${dd}/${mes}/${ano} - ${turnoTxt}\n`;
  if(turnoInfo.projeto) t += `Projeto: ${A(turnoInfo.projeto)}\n`;
  if(turnoInfo.local) t += `Local: ${A(turnoInfo.local)}\n`;
  if(turnoInfo.tecnicos) t += `Tecnicos: ${A(turnoInfo.tecnicos)}\n`;
  if(turnoInfo.supervisor) t += `Supervisor: ${A(turnoInfo.supervisor)}\n`;
  if(turnoInfo.dds) t += `DDS: ${A(turnoInfo.dds)}\n`;

  // O que foi marcado no dia, por pessoa
  const escopo = new Set(aneisNoEscopoAtual().map(a=>a.id));
  const lequesEscopo = new Set(checklistLeques.filter(c=>escopo.has(c.anelId)).map(c=>c.id));
  const furosEscopo = checklistFuros.filter(f=>lequesEscopo.has(f.checklistLequeId));
  const porPessoa = new Map();
  const pessoa = nome => { const k = nome || '(sem nome)'; if(!porPessoa.has(k)) porPessoa.set(k, { perf:0, topo:0 }); return porPessoa.get(k); };
  let perfDia = 0, topoDia = 0;
  furosEscopo.forEach(f=>{
    if(f.perfilado && noDia(f.perfiladoEm)){ perfDia++; pessoa(f.perfiladoPor).perf++; }
    if(f.topografado && noDia(f.topografadoEm)){ topoDia++; pessoa(f.topografadoPor).topo++; }
  });
  t += `\n🔧 *FEITO NO DIA*\nFuros perfilados: ${perfDia}\nFuros topografados: ${topoDia}\n`;
  if(porPessoa.size > 1 || (porPessoa.size === 1 && !porPessoa.has('(sem nome)'))){
    t += [...porPessoa.entries()].map(([n, v])=> `- ${A(n)}: ${v.perf} perf. / ${v.topo} topo.`).join('\n') + '\n';
  }

  // Detalhe: o que cada equipe (dupla) fez no dia, leque a leque
  const multiAneis = escopo.size > 1;
  const porEquipe = new Map(); // chave -> { nome, integ, itens: Map(leque -> {perf:[], topo:[]}) }
  const reg = (f, c, tipo, eqId)=>{
    const nome = nomeDaEquipeId(eqId) || '';
    const chave = eqId || '_sem';
    if(!porEquipe.has(chave)){
      const eq = (typeof equipes !== 'undefined' ? equipes : []).find(e=>e.id === eqId);
      porEquipe.set(chave, { nome: nome || 'Sem equipe', integ: eq && eq.integrantes ? eq.integrantes : '', itens: new Map() });
    }
    const g = porEquipe.get(chave);
    if(!g.itens.has(c.id)) g.itens.set(c.id, { c, perf: [], topo: [] });
    g.itens.get(c.id)[tipo].push(f);
  };
  checklistLeques.filter(c=>lequesEscopo.has(c.id)).forEach(c=>{
    furosEscopo.filter(f=>f.checklistLequeId === c.id).forEach(f=>{
      if(f.perfilado && noDia(f.perfiladoEm)) reg(f, c, 'perf', equipePerfEfetivaId(f));
      if(f.topografado && noDia(f.topografadoEm)) reg(f, c, 'topo', equipeTopoEfetivaId(f));
    });
  });
  const ordF = (x,y)=> (parseInt(x.numero,10)||0) - (parseInt(y.numero,10)||0);
  const blocosEq = [];
  porEquipe.forEach(g=>{
    const linhas = [...g.itens.values()].map(({c, perf, topo})=>{
      const an = multiAneis ? (aneis.find(a=>a.id===c.anelId) || {}).nome : '';
      const lst = arr => arr.sort(ordF).map(f=>'F'+f.numero).join(', ');
      return `  ${PREFIXO[c.tipo]}${c.numero}${an ? ' (' + A(an) + ')' : ''}:` + (perf.length ? ` perf. ${lst(perf)}` : '') + (perf.length && topo.length ? ' |' : '') + (topo.length ? ` topo. ${lst(topo)}` : '');
    });
    blocosEq.push(`*${A(g.nome)}*${g.integ ? ' (' + A(g.integ) + ')' : ''}\n${linhas.join('\n')}`);
  });
  if(blocosEq.length) t += `\n✅ *O QUE FOI FEITO NO TURNO*\n${blocosEq.join('\n')}\n`;

  // Metros lançados pelas equipes no dia
  const eqs = equipesDoProjeto();
  const linhasEq = eqs.map(e=>{
    let m = 0, p = 0;
    lancamentosProd.forEach(l=>{ if(l.equipeId === e.id && l.data === dia){ m += l.metros; p += l.pontos; } });
    return (m || p) ? `- ${A(e.nome)}: ${num(m)} m perfilados | ${Math.round(p)} pontos topografados` : '';
  }).filter(Boolean);
  if(linhasEq.length) t += `\n👷 *PRODUCAO DAS EQUIPES*\n${linhasEq.join('\n')}\n`;

  // Situação do realce ativo (pendências e obstruídos)
  const anel = aneis.find(a=>a.id===anelAtivoId);
  if(anel){
    const itens = checklistDoAnel(anel.id);
    if(itens.length){
      t += `\n📍 *SITUACAO DO REALCE ${A(anel.nome)}*\n`;
      const temLocal = itens.some(c=>(c.localizacao||'').trim());
      if(temLocal) t += montarBlocoRealceComLocais(anel.id, itens, anel.nome).replace(/^📍 \*Realce [^\n]*\*\n/, '') + '\n';
      else{
        t += resumoChecklistItens(itens) + '\n';
        const obstr = blocoObstruidosWhatsApp(itens);
        if(obstr) t += `\n${obstr}\n`;
        const porEq = blocoEquipesWhatsApp(itens);
        if(porEq) t += `\n${porEq}\n`;
        const notasF = blocoNotasFurosWhatsApp(itens);
        if(notasF) t += `\n${notasF}\n`;
        const obsG = checklistObsGeraisDoAnel(anel.id);
        if(obsG.length) t += `\n📝 *OBSERVACOES GERAIS*\n${obsG.map(o=>'- '+A(o.texto)).join('\n')}\n`;
      }
    }
  }

  const obs = observacoesDoTurnoAtual();
  if(obs.length) t += `\n📝 *OBSERVACOES DO TURNO*\n${obs.map(o=>'- '+A(o.texto)).join('\n')}\n`;
  const nFotos = fotosDoTurnoAtual().length;
  if(nFotos) t += `\n📷 Fotos registradas no turno: ${nFotos}\n`;
  return A(t.trim());
}
function renderResumoTurno(){
  renderPainelTurno(); atualizarContagensTurno(); aplicarSecoesTurno();
  const pre = el('resumo-turno-texto');
  if(pre) pre.textContent = montarResumoTurnoWhatsApp();
}
// ---------- Página Turno: painel, seções recolhíveis e atalhos de observação ----------
const TURNO_SECOES_KEY = 'perfilagem-turno-secoes-v1';
let turnoSecoes = {};
try{ turnoSecoes = JSON.parse(localStorage.getItem(TURNO_SECOES_KEY) || '{}') || {}; }catch(e){ turnoSecoes = {}; }
function salvarTurnoSecoes(){ try{ localStorage.setItem(TURNO_SECOES_KEY, JSON.stringify(turnoSecoes)); }catch(e){} }
function secaoTurnoRecolhida(chave){
  if(chave in turnoSecoes) return !!turnoSecoes[chave];
  if(chave === 'comunicados') return comunicadosVigentesNoEscopo().length === 0; // vazio: começa recolhido
  return false;
}
function aplicarSecoesTurno(){
  document.querySelectorAll('#view-turno > .view-card[data-secao]').forEach(card=>{
    const rec = secaoTurnoRecolhida(card.dataset.secao);
    card.classList.toggle('recolhido', rec);
    const cab = card.querySelector('.view-card-header');
    if(cab){ cab.setAttribute('aria-expanded', String(!rec)); }
  });
  document.querySelectorAll('#view-turno details.sec-det[data-secao]').forEach(det=>{
    const rec = secaoTurnoRecolhida(det.dataset.secao);
    if(det.open === rec) det.open = !rec;
  });
}
function alternarSecaoTurno(card){
  const chave = card.dataset.secao;
  const vaiRecolher = !card.classList.contains('recolhido');
  turnoSecoes[chave] = vaiRecolher; salvarTurnoSecoes();
  const corpo = card.querySelector(':scope > .turno-body'), chev = card.querySelector('.sec-chev');
  const cab = card.querySelector('.view-card-header'); if(cab) cab.setAttribute('aria-expanded', String(!vaiRecolher));
  if(vaiRecolher) animarFechar(corpo, chev, ()=> card.classList.add('recolhido'));
  else{ card.classList.remove('recolhido'); animarAbrir(corpo, chev); }
}
(function iniciarSecoesTurno(){
  document.querySelectorAll('#view-turno > .view-card[data-secao]').forEach(card=>{
    const cab = card.querySelector('.view-card-header'); if(!cab) return;
    const chev = document.createElement('span'); chev.className = 'sec-chev'; chev.setAttribute('aria-hidden', 'true'); chev.textContent = '▾';
    cab.insertBefore(chev, cab.firstChild);
    cab.classList.add('sec-cab'); cab.setAttribute('role', 'button'); cab.tabIndex = 0;
    cab.addEventListener('click', ev=>{
      if(ev.target.closest('button, input, select, a')){
        if(ev.target.closest('#btn-novo-comunicado') && card.classList.contains('recolhido')){ turnoSecoes.comunicados = false; salvarTurnoSecoes(); aplicarSecoesTurno(); }
        return;
      }
      alternarSecaoTurno(card);
    });
    cab.addEventListener('keydown', ev=>{ if((ev.key === 'Enter' || ev.key === ' ') && ev.target === cab){ ev.preventDefault(); alternarSecaoTurno(card); } });
  });
  document.querySelectorAll('#view-turno details.sec-det[data-secao]').forEach(det=>{
    det.addEventListener('toggle', ()=>{ turnoSecoes[det.dataset.secao] = !det.open; salvarTurnoSecoes(); });
  });
  window.addEventListener("load", aplicarSecoesTurno); // depois que todos os scripts carregaram
})();
function atualizarContagensTurno(){
  const o = el('sec-obs-cont'), f = el('sec-fotos-cont');
  if(o) o.textContent = observacoesDoTurnoAtual().length;
  if(f) f.textContent = fotosDoTurnoAtual().length;
}

// Painel do turno: o que foi feito HOJE no realce ativo, por equipe, e o que ainda pende.
function renderPainelTurno(){
  const kpis = el('pt-kpis'); if(!kpis) return;
  const hoje = dataISOLocal(new Date());
  const ehHoje = v=> v && dataISOLocal(new Date(v)) === hoje;
  const itens = checklistDoAnelAtivo();
  const ids = new Set(itens.map(c=>c.id));
  const furosR = checklistFuros.filter(f=>ids.has(f.checklistLequeId));
  const perfHoje = furosR.filter(f=>f.perfilado && ehHoje(f.perfiladoEm)).length;
  const topoHoje = furosR.filter(f=>f.topografado && ehHoje(f.topografadoEm)).length;
  const obstr = furosR.filter(f=>f.obstruido).length;
  const pend = itens.filter(c=> estadoDoLeque(checklistFurosDoLeque(c.id)) !== 'ok').length;
  const tile = (valor, rotulo, cls)=> `<div class="pt-kpi ${cls||''}"><span class="valor">${valor}</span><span class="rot">${rotulo}</span></div>`;
  kpis.innerHTML = tile(perfHoje, 'perfilados hoje') + tile(topoHoje, 'topografados hoje') + tile(pend, 'leques pendentes', pend ? 'aviso' : 'ok') + tile(obstr, 'obstruídos', obstr ? 'perigo' : '');
  const mapa = new Map();
  const lin = id=>{ if(!mapa.has(id)) mapa.set(id, { p:0, t:0 }); return mapa.get(id); };
  furosR.forEach(f=>{
    if(f.perfilado && ehHoje(f.perfiladoEm)){ const id = equipePerfEfetivaId(f); if(id && nomeDaEquipeId(id)) lin(id).p++; }
    if(f.topografado && ehHoje(f.topografadoEm)){ const id = equipeTopoEfetivaId(f); if(id && nomeDaEquipeId(id)) lin(id).t++; }
  });
  const box = el('pt-equipes');
  const eqs = equipes.filter(e=> mapa.has(e.id));
  box.innerHTML = eqs.length ? `<div class="ck-pe-titulo">Por equipe hoje</div>` + eqs.map(e=>{
    const l = mapa.get(e.id), m = somaLancamentos(e.id, hoje, hoje).metros;
    return `<div class="ck-pe-linha" style="--eq-cor:${corDaEquipe(e)}"><span class="ck-pe-nome">${marcaDaEquipe(e)}${escHtml(e.nome)}</span><span class="ck-pe-num">Perf. <b>${l.p}</b></span><span class="ck-pe-num">Topo <b>${l.t}</b></span>${m > 0 ? `<span class="ck-pe-num"><b>${fmt1(m).replace('.', ',')}</b> m</span>` : ''}</div>`;
  }).join('') : '';
  const esc = el('painel-escopo'); if(esc){ const a = aneis.find(x=>x.id===anelAtivoId); esc.textContent = 'hoje · ' + (a ? a.nome : 'sem realce ativo'); }
}
el('pt-ir-checklist').addEventListener('click', ()=> mostrarView('checklist'));

// Observações em um toque.
const ATALHOS_OBS = ['Infiltração de água', 'Rocha solta', 'Equipamento parado', 'Falta de ventilação', 'Aguardando liberação', 'Acesso bloqueado'];
(function iniciarAtalhosObs(){
  const box = el('obs-atalhos'); if(!box) return;
  box.innerHTML = ATALHOS_OBS.map((t,i)=> `<button type="button" class="obs-atalho" data-i="${i}">${t}</button>`).join('');
  box.addEventListener('click', ev=>{ const b = ev.target.closest('.obs-atalho'); if(b) adicionarObservacaoTurno(ATALHOS_OBS[+b.dataset.i], true); });
})();

async function copiarTextoResumo(texto){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(texto); return true; }
  }catch(e){}
  try{
    const ta = document.createElement('textarea'); ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
  }catch(e){ return false; }
}
el('btn-resumo-turno-copiar').addEventListener('click', async ()=>{
  const ok = await copiarTextoResumo(montarResumoTurnoWhatsApp());
  showToast(ok ? 'Resumo copiado. É só colar onde quiser.' : 'Não foi possível copiar. Use "Enviar no WhatsApp".', { erro:false });
});
el('btn-resumo-turno-whatsapp').addEventListener('click', ()=>{
  const texto = montarResumoTurnoWhatsApp();
  const numero = configApp.whatsapp;
  window.open(numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
});
el('btn-resumo-turno-atualizar').addEventListener('click', ()=>{ renderResumoTurno(); showToast('Resumo atualizado.', { erro:false }); });

function enviarRelatorioWhatsApp(idsRealces){
  if(!configApp.whatsapp){
    showToast('Cadastre um número de WhatsApp em Config antes de enviar.');
    return;
  }
  const mensagem = montarRelatorioChecklistParaWhatsApp(idsRealces);
  const url = `https://wa.me/${configApp.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
}

// Antes de enviar, deixa escolher quais realces entram no relatório — útil
// porque um turno pode ter perfilado um realce e outro turno, outro; a
// equipe se orienta melhor vendo tudo junto, não só o realce ativo agora.
// Manda uma imagem do infográfico pelo WhatsApp. Diferente do relatório de
// texto do checklist: não existe um jeito de anexar arquivo automaticamente
// num link "wa.me" (só texto pré-preenchido dá pra fazer assim). Então o
// caminho é: gerar a imagem na hora (html2canvas) e usar o compartilhamento
// nativo do aparelho — no celular, isso abre a folha de compartilhar com a
// imagem já pronta, só falta escolher o WhatsApp na lista. Em telas sem esse
// recurso (a maioria dos desktops), baixa a imagem e abre o WhatsApp Web,
// pra colar manualmente.
// Gera a imagem do infográfico: sempre em tema claro, largura fixa (igual em celular e
// computador), sem botões, campos de lançamento nem textos de ajuda — só o que é relatório.
async function gerarImagemInfografico(){
  const cardEl = document.querySelector('#view-infografico .view-card');
  if(!cardEl) throw new Error('infográfico não encontrado');
  if(typeof html2canvas !== 'function') throw new Error('biblioteca de imagem não carregou (precisa de internet na primeira vez)');
  const agora = new Date();
  const dataTxt = String(agora.getDate()).padStart(2,'0') + '/' + String(agora.getMonth()+1).padStart(2,'0') + '/' + agora.getFullYear()
    + ' ' + String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');
  const escopo = configApp.projetoAtivo ? 'Projeto ' + configApp.projetoAtivo : 'Todos os projetos';
  const quem = nomeDoUsuario();
  const canvas = await html2canvas(cardEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    windowWidth: 900,
    onclone: (doc)=>{
      doc.body.classList.remove('dark-mode');
      doc.body.style.background = '#ffffff';
      const card = doc.querySelector('#view-infografico .view-card');
      if(!card) return;
      card.style.width = '860px'; card.style.maxWidth = 'none'; card.style.margin = '0'; card.style.border = 'none'; card.style.boxShadow = 'none';
      // Tira tudo que é controle (botões, lançamento, ajuda, navegação) — fica só o relatório.
      card.querySelectorAll('button, .ajuda, .inp-somar, .equipe-soma, .ck-form-topo, .view-card-header .spacer, #infografico-vazio').forEach(n=> n.remove());
      card.querySelectorAll('.equipe-semana-nav').forEach(n=>{ n.style.justifyContent = 'center'; });
      // Gráficos SVG: o html2canvas não resolve var(--cor) dentro do SVG nem respeita
      // preserveAspectRatio="none" (cortava a direita e deixava o gráfico vazio). Aqui
      // fixamos cores reais (tema claro) e um tamanho em pixels proporcional ao viewBox.
      card.querySelectorAll('svg.infografico-chart').forEach(s=>{
        const larg = 800; // card tem 860px de largura menos o padding interno
        const vb = (s.getAttribute('viewBox') || '0 0 900 170').split(/\s+/).map(Number);
        const alt = Math.round(larg * (vb[3] || 170) / (vb[2] || 900));
        s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        s.setAttribute('width', String(larg)); s.setAttribute('height', String(alt));
        s.style.width = larg + 'px'; s.style.height = alt + 'px';
        // O html2canvas copia as cores já calculadas (do tema escuro, se for o caso) para dentro
        // do SVG; aqui cada parte volta para as cores do tema claro da imagem.
        const cor = s.dataset.corExport || '#ff431d';
        const pinta = (sel, props)=> s.querySelectorAll(sel).forEach(n=> Object.entries(props).forEach(([k,v])=> n.style.setProperty(k, v)));
        pinta('[data-exp="stop"]', { 'stop-color': cor });
        pinta('[data-exp="linha"]', { stroke: cor });
        pinta('[data-exp="ponto"]', { fill: '#ffffff', stroke: cor });
        pinta('[data-exp="ponto-ultimo"]', { fill: cor, stroke: cor });
        pinta('[data-exp="valor"]', { fill: '#191231' });
        pinta('[data-exp="meta"]', { fill: '#565668', stroke: '#565668' });
        s.querySelectorAll('line[data-exp="meta"]').forEach(n=> n.style.setProperty('fill', 'none'));
      });
      // Campos de total viram texto simples (no PDF/imagem não se digita).
      card.querySelectorAll('.equipe-campo input').forEach(i=>{ i.style.border = 'none'; i.style.background = 'transparent'; });
      const topo = doc.createElement('div');
      topo.style.cssText = 'padding:18px 20px 12px; border-bottom:2px solid #ff431d; margin-bottom:6px; font-family:Segoe UI,system-ui,sans-serif; color:#191231;';
      topo.innerHTML = '<div style="font-size:22px;font-weight:800;letter-spacing:.3px;">BlastHole Manager &mdash; Infogr&aacute;fico</div>'
        + '<div style="font-size:13px;color:#565668;margin-top:4px;">' + escHtml(escopo) + ' &middot; gerado em ' + dataTxt + (quem ? ' &middot; por ' + escHtml(quem) : '') + '</div>';
      card.insertBefore(topo, card.firstChild);
    }
  });
  const blob = await new Promise(res=> canvas.toBlob(res, 'image/png'));
  if(!blob) throw new Error('não foi possível gerar a imagem');
  const nomeArquivo = `infografico-${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}.png`;
  return { blob, nomeArquivo };
}

function baixarBlob(blob, nomeArquivo){
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = nomeArquivo;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(()=> URL.revokeObjectURL(url), 4000);
}

// Baixa a imagem como arquivo PNG (computador ou celular), sem abrir WhatsApp.
async function baixarImagemInfografico(){
  const btn = el('btn-baixar-imagem-infografico');
  const original = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Gerando imagem...'; }
  try{
    const { blob, nomeArquivo } = await gerarImagemInfografico();
    baixarBlob(blob, nomeArquivo);
    showToast('Imagem baixada: ' + nomeArquivo, { erro:false });
  }catch(err){
    showToast('Erro ao gerar a imagem: ' + (err && err.message ? err.message : err));
  }finally{
    if(btn){ btn.disabled = false; btn.innerHTML = original; }
  }
}
el('btn-baixar-imagem-infografico').addEventListener('click', baixarImagemInfografico);

async function enviarFotoInfograficoWhatsApp(){
  if(!configApp.whatsapp){
    showToast('Cadastre um número de WhatsApp em Config antes de enviar.');
    return;
  }
  const btn = el('btn-enviar-foto-infografico-whatsapp');
  if(!btn) return;
  const htmlOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Gerando imagem...';
  try{
    const { blob, nomeArquivo } = await gerarImagemInfografico();
    const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [arquivo] })){
      try{
        await navigator.share({ files: [arquivo], title: 'Infográfico' });
      }catch(err){
        if(err.name !== 'AbortError') showToast('Não foi possível compartilhar a imagem.');
      }
    }else{
      baixarBlob(blob, nomeArquivo);
      window.open(`https://wa.me/${configApp.whatsapp}`, '_blank');
      showToast('Imagem baixada — anexe ela na conversa do WhatsApp que abriu.', { erro:false });
    }
  }catch(err){
    showToast('Erro ao gerar a imagem: ' + (err && err.message ? err.message : err));
  }finally{
    btn.disabled = false;
    btn.innerHTML = htmlOriginal;
  }
}
el('btn-enviar-foto-infografico-whatsapp').addEventListener('click', enviarFotoInfograficoWhatsApp);

function abrirModalEscolherRealcesWhatsApp(){
  // só os realces do projeto ativo (ou todos, se nenhum projeto estiver selecionado)
  const aneisDoEscopo = aneisNoEscopoAtual();
  const realcesVisiveis = aneisDoEscopo.filter(a=>!a.ocultoWhatsapp);
  if(realcesVisiveis.length === 0){
    showToast(aneisDoEscopo.length === 0
      ? (configApp.projetoAtivo ? `Nenhum realce no projeto "${configApp.projetoAtivo}".` : 'Nenhum realce cadastrado ainda.')
      : 'Todos os realces estão ocultos da lista de WhatsApp — libere algum em Realce › editar.');
    return;
  }
  if(!configApp.whatsapp){
    showToast('Cadastre um número de WhatsApp em Config antes de enviar.');
    return;
  }
  const root = el('modal-root');
  const linhas = realcesVisiveis.map(a=>{
    const qtd = checklistDoAnel(a.id).length;
    const qtdObsGerais = checklistObsGeraisDoAnel(a.id).length;
    const marcadoPorPadrao = qtd > 0 || qtdObsGerais > 0; // já vem marcado quem tem algo no checklist ou alguma observação geral
    return `
      <label class="realce-whatsapp-item">
        <input type="checkbox" value="${a.id}" ${marcadoPorPadrao ? 'checked' : ''}>
        <span>${escHtml(a.nome)}</span>
        <span class="hint">${qtd > 0 ? qtd + ' no checklist' : 'sem checklist'}${qtdObsGerais > 0 ? ' · ' + qtdObsGerais + ' obs.' : ''}</span>
      </label>
    `;
  }).join('');

  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <p style="font-weight:700;">Escolher realces para o relatório</p>
        <p class="hint">Marque os realces que devem entrar na mensagem do WhatsApp.${configApp.projetoAtivo ? ' Projeto: <b>' + configApp.projetoAtivo + '</b>.' : ''}</p>
        <div class="realce-whatsapp-lista">${linhas}</div>
        <div class="modal-actions">
          <button class="ghost" id="modal-cancelar">Cancelar</button>
          <button class="steel" id="modal-confirmar-whatsapp">Gerar e enviar</button>
        </div>
      </div>
    </div>
  `;
  const fechar = ()=>{ root.innerHTML = ''; };
  el('modal-cancelar').addEventListener('click', fechar);
  el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(); });
  el('modal-confirmar-whatsapp').addEventListener('click', ()=>{
    const idsSelecionados = Array.from(root.querySelectorAll('.realce-whatsapp-item input:checked')).map(i=>i.value);
    if(idsSelecionados.length === 0){ showToast('Marque ao menos um realce.'); return; }
    fechar();
    enviarRelatorioWhatsApp(idsSelecionados);
  });
}
el('btn-enviar-whatsapp').addEventListener('click', abrirModalEscolherRealcesWhatsApp);

// ---------- Movimento de entrada ----------
// 1) Barras crescem do zero e os números contam até o valor ao abrir a aba.
function contarNumeros(el, ms){
  const final = el._finalTexto || el.textContent;
  if(!/\d/.test(final)) return;
  el._finalTexto = final;
  const token = (el._tokenContar = (el._tokenContar || 0) + 1);
  let ini = null;
  const passo = agora=>{
    if(token !== el._tokenContar) return; // outra contagem assumiu
    if(ini === null) ini = agora;
    const t = Math.max(0, Math.min(1, (agora - ini) / ms)), e = 1 - Math.pow(1 - t, 3);
    el.textContent = final.replace(/\d+(?:[.,]\d+)?/g, m=>{
      const dec = (m.split(/[.,]/)[1] || '').length, sep = m.includes(',') ? ',' : '.';
      const v = parseFloat(m.replace(',', '.')) * e;
      return dec ? v.toFixed(dec).replace('.', sep) : String(Math.round(v));
    });
    if(t < 1 && el.isConnected) requestAnimationFrame(passo); else { el.textContent = final; el._finalTexto = null; }
  };
  requestAnimationFrame(passo);
}
function animarEntradaDaAba(viewId){
  try{
    if(semMovimento()) return;
    const raiz = document.getElementById('view-' + viewId); if(!raiz) return;
    let i = 0;
    raiz.querySelectorAll('.progress-fill, .ck-prog-bar i, .equipe-barra').forEach(b=>{
      const alvo = b.style.width; if(!alvo || alvo === '0%' || alvo === '0px') return;
      b.animate([{ width:'0%' }, { width:alvo }], { duration:650, delay: Math.min(i++, 14) * 25, easing:'cubic-bezier(.2,.7,.2,1)', fill:'backwards' });
    });
    raiz.querySelectorAll('#checklist-progresso-furos-texto, #checklist-progresso-topo-texto, .ck-prog-linha .num, .infografico-kpi .valor, .equipe-valor, .pt-kpi .valor').forEach(n=> contarNumeros(n, 650));
  }catch(e){}
}
// 2) Leque novo desliza para dentro; ao mover para cima/baixo os cards trocam de lugar suavemente (FLIP).
const CARDS_NOVOS = new Set();
function aplicarEntradaCards(){
  if(!CARDS_NOVOS.size) return;
  const ids = [...CARDS_NOVOS]; CARDS_NOVOS.clear();
  if(semMovimento()) return;
  ids.forEach(id=>{
    const c = document.getElementById('ck-card-' + id) || document.querySelector(`.leque-group[data-leque-id="${id}"]`);
    if(c) c.animate([{ opacity:0, transform:'translateY(-14px) scale(.98)' }, { opacity:1, transform:'none' }], { duration:320, easing:'cubic-bezier(.2,.8,.3,1.1)' });
  });
}
function posicoesCards(){
  const m = new Map();
  document.querySelectorAll('.checklist-leque-card').forEach(c=> m.set(c.id, c.getBoundingClientRect().top));
  return m;
}
function animarTrocaCards(antes){
  if(semMovimento()) return;
  document.querySelectorAll('.checklist-leque-card').forEach(c=>{
    const y0 = antes.get(c.id); if(y0 == null) return;
    const dy = y0 - c.getBoundingClientRect().top;
    if(Math.abs(dy) > 2) c.animate([{ transform:`translateY(${dy}px)` }, { transform:'none' }], { duration:280, easing:'cubic-bezier(.2,.7,.2,1)' });
  });
}
// 3) Furo obstruído: a linha treme uma vez e o risco se desenha da esquerda para a direita.
function animarObstrucao(furoId){
  try{
    if(semMovimento()) return;
    const inp = document.querySelector(`input[onchange*="definirObstrucaoChecklistFuro('${furoId}'"]`);
    const tr = inp && inp.closest('tr'); if(!tr) return;
    tr.classList.add('obstr-entra');
    setTimeout(()=> tr.classList.remove('obstr-entra'), 800);
  }catch(e){}
}
// Abrir/fechar com movimento curto: o conteúdo desliza e a seta gira. Respeita "reduzir movimento".
function semMovimento(){ return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || !document.body.animate; }
function animarAbrir(corpo, seta){
  try{
    if(semMovimento()) return;
    if(corpo){
      corpo.getAnimations().forEach(x=>x.cancel()); // limpa o 'fill: forwards' do fechamento anterior (deixava o corpo com altura 0)
      const h = corpo.getBoundingClientRect().height;
      corpo.style.overflow = 'hidden';
      const a = corpo.animate([{ height:'0px', opacity:0, transform:'translateY(-6px)' }, { height:h+'px', opacity:1, transform:'none' }], { duration:260, easing:'cubic-bezier(.2,.7,.2,1)' });
      a.onfinish = a.oncancel = ()=>{ corpo.style.overflow = ''; };
    }
    if(seta) seta.animate([{ transform:'rotate(-90deg)' }, { transform:'none' }], { duration:220, easing:'ease-out' });
  }catch(e){}
}
function animarFechar(corpo, seta, depois){
  try{
    if(semMovimento() || !corpo){ depois(); return; }
    const h = corpo.getBoundingClientRect().height;
    corpo.style.overflow = 'hidden';
    if(seta) seta.animate([{ transform:'none' }, { transform:'rotate(-90deg)' }], { duration:180, fill:'forwards' });
    const a = corpo.animate([{ height:h+'px', opacity:1 }, { height:'0px', opacity:0, transform:'translateY(-6px)' }], { duration:180, easing:'ease-in', fill:'forwards' });
    a.onfinish = ()=>{ depois(); try{ a.cancel(); }catch(e){} corpo.style.overflow = ''; if(seta) seta.getAnimations().forEach(x=>x.cancel()); };
    setTimeout(()=>{ if(corpo.isConnected && a.playState !== 'finished'){ try{ a.finish(); }catch(e){ depois(); } } }, 400);
  }catch(e){ depois(); }
}
document.addEventListener('click', ev=>{
  // Célula inteira é alvo de toque: quem usa luva não precisa acertar a caixa pequena.
  const td = ev.target.closest && ev.target.closest('table.checklist-furos-tabela td');
  if(!td || ev.target.closest('input, button')) return;
  const cx = td.querySelector('input[type="checkbox"]:not(:disabled)');
  if(cx) cx.click();
});
function toggleExpandirChecklist(id){
  const sel = '#ck-card-' + id;
  if(checklistExpandido.has(id)){
    animarFechar(document.querySelector(sel + ' .ck-corpo'), document.querySelector(sel + ' .ck-codigo .seta'), ()=>{ checklistExpandido.delete(id); renderChecklist(); });
    return;
  }
  checklistExpandido.add(id); salvarUltimo({});
  renderChecklist();
  animarAbrir(document.querySelector(sel + ' .ck-corpo'), document.querySelector(sel + ' .ck-codigo .seta'));
}


// Leques e furos criados juntos: o furo depende do leque já existir no servidor,
// então vão em duas etapas (leques, depois furos), em lotes. Se algo falhar, tudo
// que faltou entra na lista de pendências na mesma ordem pro "Tentar de novo".
async function inserirLequesEFuros(regsLeques, regsFuros){
  const registrarFalha = (tabela, regs, motivo)=> regs.forEach(r=>{
    const chave = tabela + ':insert:' + r.id;
    falhasDeEnvio.set(chave, { chave, tabela, acao:'insert', registro:r, motivo });
  });
  // Tudo entra na fila guardada antes de ir: se o app fechar no meio, o resto sobe depois.
  const todos = [['checklist_leques', regsLeques], ['checklist_furos', regsFuros]];
  todos.forEach(([t, regs])=> regs.forEach(r=> enviosEmVoo.set(t + ':insert:' + r.id, { chave: t + ':insert:' + r.id, tabela:t, acao:'insert', registro:r })));
  persistirFila();
  if(navigator.onLine === false){
    todos.forEach(([t, regs])=> registrarFalha(t, regs, 'sem conexão'));
    todos.forEach(([t, regs])=> regs.forEach(r=> enviosEmVoo.delete(t + ':insert:' + r.id)));
    persistirFila(); atualizarIndicadorSalvamento();
    return;
  }
  enviosEmAndamento++;
  atualizarIndicadorSalvamento();
  let motivo = '';
  try{
    for(let i = 0; i < regsLeques.length; i += 500){
      const { error } = await db.from('checklist_leques').insert(regsLeques.slice(i, i + 500));
      if(error){ motivo = error.message || 'erro'; registrarFalha('checklist_leques', regsLeques.slice(i), motivo); registrarFalha('checklist_furos', regsFuros, motivo); return; }
    }
    for(let i = 0; i < regsFuros.length; i += 500){
      const { error } = await db.from('checklist_furos').insert(regsFuros.slice(i, i + 500));
      if(error){ motivo = error.message || 'erro'; registrarFalha('checklist_furos', regsFuros.slice(i), motivo); return; }
    }
  }catch(err){
    motivo = err && err.message ? err.message : 'sem conexão';
    registrarFalha('checklist_leques', regsLeques, motivo);
    registrarFalha('checklist_furos', regsFuros, motivo);
  }finally{
    todos.forEach(([t, regs])=> regs.forEach(r=> enviosEmVoo.delete(t + ':insert:' + r.id)));
    enviosEmAndamento = Math.max(0, enviosEmAndamento - 1);
    persistirFila();
    atualizarIndicadorSalvamento();
    if(motivo){
      if(ehErroDeRede(motivo)){ if(Date.now() - ultimoToastFalha > 30000){ ultimoToastFalha = Date.now(); showToast('Sem sinal: o checklist fica guardado neste aparelho e sobe quando a conexão voltar.', { erro:false }); } }
      else showToast(`Não foi possível salvar o checklist: ${motivo}`);
    }
  }
}

function adicionarAoChecklist(){
  const anelAtivo = aneis.find(a=>a.id===anelAtivoId);
  if(!anelAtivo){ showToast('Selecione um realce primeiro.'); return; }
  const tipo = el('checklist-tipo').value;
  const de = parseInt(el('checklist-numero-de').value, 10);
  const ateTexto = el('checklist-numero-ate').value.trim();
  const ate = ateTexto ? parseInt(ateTexto, 10) : de;
  if(isNaN(de)){ showToast('Preencha o número (ou a faixa) pra adicionar.'); return; }
  if(isNaN(ate) || ate < de){ showToast('O "até" precisa ser maior ou igual ao "de".'); return; }
  if(ate - de > 200){ showToast('Faixa grande demais pra adicionar de uma vez (máximo 200).'); return; }

  const localizacao = (el('checklist-localizacao').value || '').trim();
  const chaveLocal = localizacao.toLowerCase();

  // Furos criados junto com os leques (opcional)
  const furoDeTxt = el('checklist-furo-de').value.trim();
  const furoAteTxt = el('checklist-furo-ate').value.trim();
  let furoDe = null, furoAte = null;
  if(furoDeTxt || furoAteTxt){
    furoDe = parseInt(furoDeTxt || furoAteTxt, 10);
    furoAte = furoAteTxt ? parseInt(furoAteTxt, 10) : furoDe;
    if(isNaN(furoDe) || isNaN(furoAte) || furoAte < furoDe){ showToast('Confira os números dos furos ("de" menor ou igual a "até").'); return; }
    if(furoAte - furoDe > 200){ showToast('Furos demais por leque (máximo 200).'); return; }
  }
  const base = Date.now(); // carimbos crescentes: guardam a ordem em que os leques foram colocados
  const regsLeques = [], regsFuros = [];
  let ultimoCriado = null;
  let adicionados = 0, duplicados = 0;
  for(let n = de; n <= ate; n++){
    const numero = normalizarNumero(String(n));
    // O mesmo leque pode existir em áreas diferentes do realce: só é duplicado
    // se tipo, número E localização forem iguais.
    const jaExiste = checklistLeques.some(c=>c.anelId===anelAtivo.id && c.tipo===tipo && c.numero===numero && (c.localizacao||'').trim().toLowerCase()===chaveLocal);
    if(jaExiste){ duplicados++; continue; }
    const novoId = uuidv4();
    const tsLeque = new Date(base + adicionados).toISOString();
    const novoItem = { id: novoId, anelId: anelAtivo.id, tipo, numero, perfilado: false, observacao: '', localizacao, ts: tsLeque };
    checklistLeques.push(novoItem);
    CARDS_NOVOS.add(novoId);
    regsLeques.push({ id: novoId, anel_id: anelAtivo.id, tipo, numero, perfilado: false, localizacao: localizacao || null, criado_em: tsLeque });
    if(furoDe !== null){
      for(let fn = furoDe; fn <= furoAte; fn++){
        const fid = uuidv4();
        const numeroFuro = normalizarNumero(String(fn));
        const tsFuro = new Date(base + 100000 + regsFuros.length).toISOString();
        checklistFuros.push({ id: fid, checklistLequeId: novoId, numero: numeroFuro, perfilado: false, topografado: false, metragem: null, perfiladoEm: null, topografadoEm: null, obstruido: '', ts: tsFuro });
        regsFuros.push({ id: fid, checklist_leque_id: novoId, numero: numeroFuro, perfilado: false, topografado: false, criado_em: tsFuro });
      }
    }
    ultimoCriado = novoId;
    adicionados++;
  }
  if(regsLeques.length) inserirLequesEFuros(regsLeques, regsFuros);
  // Um leque só: já abre pra mexer nos furos, sem precisar procurar na lista.
  if(adicionados === 1) checklistExpandido.add(ultimoCriado);
  salvarChecklistLocal();
  salvarChecklistFurosLocal();
  renderChecklist();
  if(ultimoCriado){
    const cartao = document.getElementById('ck-card-' + ultimoCriado);
    if(cartao) cartao.scrollIntoView({ block:'center', behavior:'smooth' });
  }
  el('checklist-numero-de').value = '';
  el('checklist-numero-ate').value = '';
  lembrarFormChecklist();
  const totalFuros = regsFuros.length;
  if(adicionados === 0) showToast('Nada adicionado — todos já estavam no checklist.');
  else showToast(`${adicionados} leque(s) adicionado(s)${totalFuros ? ' com '+totalFuros+' furo(s)' : ''}.${duplicados ? ' ('+duplicados+' já existiam)' : ''}`);
}
el('btn-add-checklist').addEventListener('click', adicionarAoChecklist);

// Lembra o último tipo e a última localização usados (por aparelho) — quem
// cadastra 30 leques da mesma galeria não precisa escolher tudo de novo.
const CK_FORM_KEY = 'perfilagem-checklist-form-v1';
function lembrarFormChecklist(){
  try{
    localStorage.setItem(CK_FORM_KEY, JSON.stringify({ tipo: el('checklist-tipo').value, localizacao: (el('checklist-localizacao').value || '').trim() }));
  }catch(e){}
}
function restaurarFormChecklist(){
  try{
    const m = JSON.parse(localStorage.getItem(CK_FORM_KEY) || 'null');
    if(!m) return;
    if(m.tipo && Array.from(el('checklist-tipo').options).some(o=>o.value===m.tipo)) el('checklist-tipo').value = m.tipo;
    if(m.localizacao && !el('checklist-localizacao').value) el('checklist-localizacao').value = m.localizacao;
  }catch(e){}
}
restaurarFormChecklist();

// Aviso de equipe errada: marcar um leque que é de outra equipe pede confirmação.
function equipeDivergente(f, tipo){
  const minha = (typeof minhaEquipeId === 'function') ? minhaEquipeId() : null;
  if(!minha) return null;
  const c = checklistLeques.find(x=>x.id===f.checklistLequeId); if(!c) return null;
  const dona = tipo === 'perf' ? c.equipePerfId : c.equipeTopoId;
  return (dona && dona !== minha) ? dona : null;
}
const equipeConfirmada = new Set();
async function confirmarEquipeErrada(f, tipo, donaId, depois){
  renderChecklist(); // devolve o checkbox ao estado anterior enquanto pergunta
  const c = checklistLeques.find(x=>x.id===f.checklistLequeId);
  const msg = `${PREFIXO[c.tipo]}${c.numero} está com a ${nomeDaEquipeId(donaId)} (${tipo === 'perf' ? 'perfilagem' : 'topografia'}). Marcar F${f.numero} como ${nomeDaEquipeId(minhaEquipeId())} mesmo assim?`;
  if(!(await confirmDialog(msg, 'Marcar mesmo assim'))) return;
  const k = f.id + ':' + tipo; equipeConfirmada.add(k);
  try{ depois(); } finally{ equipeConfirmada.delete(k); }
}
// Só quem marcou (a mesma pessoa ou alguém da mesma equipe) pode desmarcar. Marcas sem autor registrado (antigas) ficam livres.
function podeDesmarcar(autor, equipeId){
  if(!autor) return true;
  const eu = (typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '').toLowerCase();
  if(eu && String(autor).toLowerCase() === eu) return true;
  const minha = (typeof minhaEquipeId === 'function') ? minhaEquipeId() : null;
  return !!(minha && equipeId && minha === equipeId);
}
function avisarSoQuemMarcou(autor, equipeId){
  const eq = nomeDaEquipeId(equipeId);
  showToast(`Só ${autor ? autor : 'quem marcou'}${eq ? ' ou a ' + eq : ''} pode desmarcar.`, { tipo:'aviso' });
  renderChecklist();
}
function podeDesmarcarFuro(f, tipo){
  if(tipo === 'perf') return podeDesmarcar(f.perfiladoPor, equipePerfEfetivaId(f));
  if(tipo === 'topo') return podeDesmarcar(f.topografadoPor, equipeTopoEfetivaId(f));
  return podeDesmarcar(f.obstruidoPor, equipeObsEfetivaId(f));
}
function toggleChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  if(c.perfilado && !podeDesmarcar(c.perfiladoPor, c.equipePerfId)){ avisarSoQuemMarcou(c.perfiladoPor, c.equipePerfId); return; }
  const antes = c.perfilado;
  c.perfilado = !c.perfilado;
  enfileirar('checklist_leques', 'update', { id: c.id, perfilado: c.perfilado });
  salvarChecklistLocal();
  renderChecklist();
  showToast(`${PREFIXO[c.tipo]}${c.numero} ${c.perfilado ? 'marcado como perfilado' : 'desmarcado'}.`, { acaoLabel:'Desfazer', onAcao: ()=>{
    c.perfilado = antes;
    enfileirar('checklist_leques', 'update', { id: c.id, perfilado: antes });
    salvarChecklistLocal(); renderChecklist();
    showToast(`${PREFIXO[c.tipo]}${c.numero} voltou ao que estava.`);
  }});
}

async function editarObservacaoChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  const novoTexto = await editarObservacaoModal(c.observacao);
  if(novoTexto === null || novoTexto === c.observacao) return;
  c.observacao = novoTexto;
  enfileirar('checklist_leques', 'update', { id: c.id, observacao: novoTexto });
  salvarChecklistLocal();
  renderChecklist();
  showToast('Observação salva.');
}

function editarLocalizacaoModal(valorAtual){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Localização do leque</p>
          <div class="field" style="margin-bottom:16px;">
            <label for="local-leque-input">Onde fica (deixe vazio para limpar)</label>
            <input id="local-leque-input" type="text" maxlength="120" placeholder="ex: galeria norte, nível 540" value="${escHtml(valorAtual || '')}">
          </div>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="steel" id="modal-salvar">Salvar</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (r)=>{ root.innerHTML = ''; resolve(r); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(null));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(null); });
    const salvar = ()=> fechar(el('local-leque-input').value.trim());
    el('modal-salvar').addEventListener('click', salvar);
    el('local-leque-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    el('local-leque-input').focus();
  });
}

// ---------- Equipe que perfilou / que topografou (por leque, com exceção por furo) ----------
const furosComEquipeAberta = new Set();
function nomeDaEquipeId(id){ const e = id ? equipes.find(x=>x.id===id) : null; return e ? e.nome : ''; }
function equipePerfEfetivaId(f){ if(f.equipePerfId) return f.equipePerfId; const c = checklistLeques.find(x=>x.id===f.checklistLequeId); return c ? (c.equipePerfId||null) : null; }
function equipeTopoEfetivaId(f){ if(f.equipeTopoId) return f.equipeTopoId; const c = checklistLeques.find(x=>x.id===f.checklistLequeId); return c ? (c.equipeTopoId||null) : null; }
function htmlOpcoesEquipe(selecionado, rotuloVazio){
  const lista = equipesDoProjeto();
  const ids = new Set(lista.map(e=>e.id));
  let extra = '';
  if(selecionado && !ids.has(selecionado) && nomeDaEquipeId(selecionado)) extra = `<option value="${selecionado}" selected>${escHtml(nomeDaEquipeId(selecionado))}</option>`;
  return `<option value="">${rotuloVazio}</option>` + extra + lista.map(e=>`<option value="${e.id}" ${e.id===selecionado ? 'selected' : ''}>${escHtml(e.nome)}</option>`).join('');
}
function htmlSeletoresEquipeLeque(c){
  if(!equipesDoProjeto().length && !c.equipePerfId && !c.equipeTopoId){
    return `<div class="ck-equipes"><span class="hint">Cadastre equipes na aba Produtividade para marcar quem perfilou e quem topografou.</span></div>`;
  }
  return `<div class="ck-equipes">
    <label>Equipe da perfilagem<select onchange="definirEquipeLeque('${c.id}','perf',this.value)" aria-label="equipe da perfilagem">${htmlOpcoesEquipe(c.equipePerfId,'—')}</select></label>
    <label>Equipe da topografia<select onchange="definirEquipeLeque('${c.id}','topo',this.value)" aria-label="equipe da topografia">${htmlOpcoesEquipe(c.equipeTopoId,'—')}</select></label>
  </div>`;
}
function definirEquipeLeque(id, campo, valor){
  const c = checklistLeques.find(x=>x.id===id); if(!c) return;
  const v = valor || null;
  if(campo === 'perf'){ c.equipePerfId = v; enfileirar('checklist_leques', 'update', { id, equipe_perfilagem_id: v }); }
  else { c.equipeTopoId = v; enfileirar('checklist_leques', 'update', { id, equipe_topografia_id: v }); }
  salvarChecklistLocal();
  renderChecklist();
}
function definirEquipeFuro(id, campo, valor){
  const f = checklistFuros.find(x=>x.id===id); if(!f) return;
  const v = valor || null;
  if(campo === 'perf'){ f.equipePerfId = v; enfileirar('checklist_furos', 'update', { id, equipe_perfilagem_id: v }); }
  else { f.equipeTopoId = v; enfileirar('checklist_furos', 'update', { id, equipe_topografia_id: v }); }
  salvarChecklistFurosLocal();
  renderChecklist();
}
function alternarEquipeFuro(id){
  if(furosComEquipeAberta.has(id)) furosComEquipeAberta.delete(id); else furosComEquipeAberta.add(id);
  renderChecklist();
}
// Bloco para o WhatsApp: furos por equipe (exceções por furo valem sobre a equipe do leque).
function blocoEquipesWhatsApp(itens){
  const perf = new Map(), topo = new Map();
  itens.forEach(c=> checklistFurosDoLeque(c.id).forEach(f=>{
    if(f.perfilado){ const n = nomeDaEquipeId(equipePerfEfetivaId(f)); if(n) perf.set(n, (perf.get(n)||0)+1); }
    if(f.topografado){ const n = nomeDaEquipeId(equipeTopoEfetivaId(f)); if(n) topo.set(n, (topo.get(n)||0)+1); }
  }));
  const linhas = [];
  perf.forEach((q,n)=> linhas.push(`Perfilagem - ${semAcento(n)}: ${q} furo(s)`));
  topo.forEach((q,n)=> linhas.push(`Topografia - ${semAcento(n)}: ${q} furo(s)`));
  return linhas.length ? `👷 *POR EQUIPE*\n${linhas.join('\n')}` : '';
}
function textoEquipesLeque(c){
  // Equipe do leque; se não houver, as equipes que de fato marcaram os furos (preenchidas pelo usuário logado).
  const fl = checklistFurosDoLeque(c.id);
  const nomes = (fixaId, efetivaFn, filtro)=>{
    const f0 = nomeDaEquipeId(fixaId); if(f0) return [f0];
    return [...new Set(fl.filter(filtro).map(f=>nomeDaEquipeId(efetivaFn(f))).filter(Boolean))];
  };
  const p = nomes(c.equipePerfId, equipePerfEfetivaId, f=>f.perfilado).join(' + ');
  const t = nomes(c.equipeTopoId, equipeTopoEfetivaId, f=>f.topografado).join(' + ');
  const partes = [];
  if(p) partes.push(`<b>Perf.:</b> ${escHtml(p)}`);
  if(t) partes.push(`<b>Topo:</b> ${escHtml(t)}`);
  return partes.join(' · ');
}

async function editarLocalizacaoChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  const novo = await editarLocalizacaoModal(c.localizacao);
  if(novo === null || novo === (c.localizacao || '')) return;
  const chave = novo.toLowerCase();
  if(checklistLeques.some(x=>x.id!==c.id && x.anelId===c.anelId && x.tipo===c.tipo && x.numero===c.numero && (x.localizacao||'').trim().toLowerCase()===chave)){
    showToast(`Já existe ${PREFIXO[c.tipo]}${c.numero} com essa localização neste realce.`);
    return;
  }
  c.localizacao = novo;
  enfileirar('checklist_leques', 'update', { id: c.id, localizacao: novo || null });
  salvarChecklistLocal();
  renderChecklist();
  showToast(novo ? 'Localização salva.' : 'Localização removida.');
}

async function removerObservacaoChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  if(!(await confirmDialog('Remover esta observação?', 'Remover'))) return;
  c.observacao = '';
  enfileirar('checklist_leques', 'update', { id: c.id, observacao: '' });
  salvarChecklistLocal();
  renderChecklist();
  showToast('Observação removida.');
}

async function removerChecklistLeque(id){
  const c = checklistLeques.find(x=>x.id===id);
  if(!c) return;
  const codigo = PREFIXO[c.tipo] + c.numero;
  const furosDoLeque = checklistFurosDoLeque(id);
  if(!(await confirmDialog(`Remover ${codigo} do checklist${furosDoLeque.length ? ' e seus '+furosDoLeque.length+' furo(s)' : ''}?`, 'Remover'))) return;

  const furosRemovidos = furosDoLeque.map(f=>({ ...f }));
  checklistLeques = checklistLeques.filter(x=>x.id!==id);
  checklistFuros = checklistFuros.filter(f=>f.checklistLequeId!==id);
  furosDoLeque.forEach(f=> removerDaFila('checklist_furos', f.id));
  enfileirar('checklist_leques', 'delete', { id });
  checklistExpandido.delete(id);

  salvarChecklistLocal();
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast(`${codigo} removido do checklist.`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoChecklist(c, furosRemovidos)
  });
}

function desfazerRemocaoChecklist(itemRemovido, furosRemovidos){
  if(checklistLeques.some(x=>x.id===itemRemovido.id)) return; // já foi restaurado
  checklistLeques.push(itemRemovido);
  restaurarNaFila('checklist_leques', itemRemovido.id, {
    id: itemRemovido.id, anel_id: itemRemovido.anelId, tipo: itemRemovido.tipo,
    numero: itemRemovido.numero, perfilado: itemRemovido.perfilado,
    observacao: itemRemovido.observacao || null, localizacao: itemRemovido.localizacao || null
  });
  (furosRemovidos || []).forEach(f=>{
    checklistFuros.push(f);
    restaurarNaFila('checklist_furos', f.id, {
      id: f.id, checklist_leque_id: f.checklistLequeId, numero: f.numero, perfilado: f.perfilado, topografado: f.topografado,
      obstruido: f.obstruido || null
    });
  });
  salvarChecklistLocal();
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast('Restaurado no checklist.');
}

function adicionarFurosAoChecklist(checklistLequeId){
  const c = checklistLeques.find(x=>x.id===checklistLequeId);
  if(!c) return;
  const campoDe = el(`cf-de-${checklistLequeId}`);
  const campoAte = el(`cf-ate-${checklistLequeId}`);
  const de = parseInt(campoDe.value, 10);
  const ateTexto = campoAte.value.trim();
  const ate = ateTexto ? parseInt(ateTexto, 10) : de;
  if(isNaN(de)){ showToast('Preencha o número (ou a faixa) do furo.'); return; }
  if(isNaN(ate) || ate < de){ showToast('O "até" precisa ser maior ou igual ao "de".'); return; }
  if(ate - de > 200){ showToast('Faixa grande demais pra adicionar de uma vez (máximo 200).'); return; }

  let adicionados = 0, duplicados = 0;
  for(let n = de; n <= ate; n++){
    const numero = normalizarNumero(String(n));
    const jaExiste = checklistFuros.some(f=>f.checklistLequeId===checklistLequeId && f.numero===numero);
    if(jaExiste){ duplicados++; continue; }
    const novoId = uuidv4();
    checklistFuros.push({ id: novoId, checklistLequeId, numero, perfilado: false, topografado: false, ts: new Date().toISOString() });
    enfileirar('checklist_furos', 'insert', { id: novoId, checklist_leque_id: checklistLequeId, numero, perfilado: false, topografado: false });
    adicionados++;
  }
  salvarChecklistFurosLocal();
  renderChecklist();
  if(adicionados === 0) showToast('Nada adicionado — todos já estavam no checklist desse leque.');
  else showToast(`${adicionados} furo(s) adicionado(s).${duplicados ? ' ('+duplicados+' já existiam)' : ''}`);
}

// Foto do estado de um furo antes de uma marcação, pra poder desfazer só aquele toque (com luva
// e tela suja, marcar o furo errado acontece). Vale só pra última marcação: o aviso some em 7 s.
function fotoFuro(f){ return { id:f.id, perfilado:f.perfilado, perfiladoEm:f.perfiladoEm, topografado:f.topografado, topografadoEm:f.topografadoEm, obstruido:f.obstruido || '' }; }
function avisoDesfazerFuro(f, antes, texto){
  showToast(texto, { acaoLabel:'Desfazer', onAcao: ()=> desfazerMarcaFuro(antes) });
}
function desfazerMarcaFuro(antes){
  const f = checklistFuros.find(x=>x.id===antes.id);
  if(!f) return;
  f.perfilado = antes.perfilado; f.perfiladoEm = antes.perfiladoEm;
  f.topografado = antes.topografado; f.topografadoEm = antes.topografadoEm;
  f.obstruido = antes.obstruido;
  enfileirar('checklist_furos', 'update', { id:f.id, perfilado:f.perfilado, perfilado_em:f.perfiladoEm, topografado:f.topografado, topografado_em:f.topografadoEm, obstruido:f.obstruido || null });
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast(`F${f.numero} voltou ao que estava.`);
}

// Pulso curto na caixa marcada e nos contadores do leque: confirma o toque sem depender do aviso.
// Brilho que percorre a borda de um elemento (leque completo, realce 100%, meta batida...).
function brilharBorda(elemento, vibrar, cor){
  try{
    if(!elemento) return;
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    elemento.classList.remove('fx-borda'); void elemento.offsetWidth; // reinicia se já estava rodando
    if(cor) elemento.style.setProperty('--fx-cor', cor); else elemento.style.removeProperty('--fx-cor');
    elemento.classList.add('fx-borda');
    setTimeout(()=>{ elemento.classList.remove('fx-borda'); }, 1400);
    if(vibrar) vibrarCurto([18, 40, 28]);
  }catch(e){}
}
// Leque a 100%: brilho na borda + selo ✓ que "salta"; vibração leve no celular.
function celebrarLequeCompleto(card, lequeId){
  try{
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    card.classList.add('completo-fx');
    setTimeout(()=>{ card.classList.remove('completo-fx'); }, 1400);
    brilharBorda(card, true);
  }catch(e){}
}
// Realce inteiro: todos os leques do checklist completos.
function realceChecklistCompleto(anelId){
  const lq = checklistLeques.filter(c=>c.anelId===anelId);
  return lq.length > 0 && lq.every(c=> estadoDoLeque(checklistFuros.filter(f=>f.checklistLequeId===c.id)) === 'ok');
}
const ANEL_COMPLETO_ANTES = new Map();
const anelFxPendente = new Set();
const ESTADO_ANTERIOR_LEQUE = new Map();
function guardarEstadoLeque(lequeId){
  const furos = checklistFuros.filter(x=>x.checklistLequeId===lequeId);
  ESTADO_ANTERIOR_LEQUE.set(lequeId, estadoDoLeque(furos));
  const c = checklistLeques.find(x=>x.id===lequeId);
  if(c) ANEL_COMPLETO_ANTES.set(c.anelId, realceChecklistCompleto(c.anelId));
}
// Movimento curto e discreto ao marcar: caixa "estala", a barra cresce a partir do valor anterior
// e, se o leque mudou de estado (ex.: ficou completo), a borda dá um brilho. Respeita "reduzir movimento".
function pulsarMarcaFuro(f, funcao, anterior){
  try{
    const alvo = document.querySelector(`input[onchange*="${funcao}('${f.id}')"]`);
    if(alvo) alvo.classList.add('pulso');
    const card = document.getElementById('ck-card-' + f.checklistLequeId);
    if(!card) return;
    card.querySelectorAll('.ck-prog-linha .num').forEach(n=> n.classList.add('pulso'));
    const topo = funcao === 'toggleChecklistFuroTopografado';
    const barra = card.querySelector(topo ? '.ck-prog-linha.topo .ck-prog-bar i' : '.ck-prog-linha:not(.topo) .ck-prog-bar i');
    const furos = checklistFuros.filter(x=>x.checklistLequeId===f.checklistLequeId);
    const marcado = topo ? f.topografado : f.perfilado;
    const agora = furos.filter(x=> topo ? x.topografado : x.perfilado).length;
    const antes = agora + (marcado ? -1 : 1);
    if(barra && furos.length){
      const de = Math.max(0, antes) / furos.length * 100, para = agora / furos.length * 100;
      barra.style.setProperty('--de', de + '%');
      barra.style.setProperty('--para', para + '%');
      barra.classList.add('cresce');
    }
    const est = estadoDoLeque(furos);
    if(anterior && anterior !== est){ card.classList.add('brilho'); }
    if(est === 'ok' && anterior !== 'ok') celebrarLequeCompleto(card, f.checklistLequeId);
    const lq = checklistLeques.find(x=>x.id===f.checklistLequeId);
    if(lq && realceChecklistCompleto(lq.anelId) && ANEL_COMPLETO_ANTES.get(lq.anelId) === false){
      brilharBorda(document.querySelector('.checklist-progresso-resumo'), false);
      anelFxPendente.add(lq.anelId);
      showToast('Realce 100%: todos os leques completos.');
    }
  }catch(e){}
}
function toggleChecklistFuro(id){
  const f = checklistFuros.find(x=>x.id===id);
  if(!f) return;
  if(f.obstruido){ renderChecklist(); return; } // furo obstruído não aceita outra marcação
  if(f.perfilado && !podeDesmarcarFuro(f,'perf')){ avisarSoQuemMarcou(f.perfiladoPor, equipePerfEfetivaId(f)); return; }
  if(!f.perfilado && !equipeConfirmada.has(f.id+':perf')){ const d = equipeDivergente(f,'perf'); if(d){ confirmarEquipeErrada(f,'perf',d,()=>toggleChecklistFuro(id)); return; } }
  const antes = fotoFuro(f);
  guardarEstadoLeque(f.checklistLequeId);
  f.perfilado = !f.perfilado;
  vibrarCurto(10);
  // Guarda quando foi marcado (ou limpa, se desmarcar) — é isso que permite
  // depois calcular "quanto foi perfilado hoje/essa semana/esse mês" de
  // verdade, em vez de só o total acumulado até agora.
  f.perfiladoEm = f.perfilado ? new Date().toISOString() : null;
  enfileirar('checklist_furos', 'update', { id: f.id, perfilado: f.perfilado, perfilado_em: f.perfiladoEm });
  salvarChecklistFurosLocal();
  renderChecklist();
  pulsarMarcaFuro(f, 'toggleChecklistFuro', ESTADO_ANTERIOR_LEQUE.get(f.checklistLequeId));
  destacarProximoFuro(f, 'perf');
  avisoDesfazerFuro(f, antes, `F${f.numero} ${f.perfilado ? 'perfilado' : 'perfilado desmarcado'}.`);
}

function toggleChecklistFuroTopografado(id){
  const f = checklistFuros.find(x=>x.id===id);
  if(!f) return;
  if(f.obstruido){ renderChecklist(); return; }
  if(f.topografado && !podeDesmarcarFuro(f,'topo')){ avisarSoQuemMarcou(f.topografadoPor, equipeTopoEfetivaId(f)); return; }
  if(!f.topografado && !equipeConfirmada.has(f.id+':topo')){ const d = equipeDivergente(f,'topo'); if(d){ confirmarEquipeErrada(f,'topo',d,()=>toggleChecklistFuroTopografado(id)); return; } }
  const antes = fotoFuro(f);
  guardarEstadoLeque(f.checklistLequeId);
  f.topografado = !f.topografado;
  vibrarCurto(10);
  f.topografadoEm = f.topografado ? new Date().toISOString() : null;
  enfileirar('checklist_furos', 'update', { id: f.id, topografado: f.topografado, topografado_em: f.topografadoEm });
  salvarChecklistFurosLocal();
  renderChecklist();
  pulsarMarcaFuro(f, 'toggleChecklistFuroTopografado', ESTADO_ANTERIOR_LEQUE.get(f.checklistLequeId));
  destacarProximoFuro(f, 'topo');
  avisoDesfazerFuro(f, antes, `F${f.numero} ${f.topografado ? 'topografado' : 'topografado desmarcado'}.`);
}

// Rocha e tela são um motivo só ("obstruído"). No banco o valor continua 'rocha' (a coluna só
// aceita 'rocha'/'tela'), então não precisa mexer no Supabase; na tela aparece só "Obstruído".
const OBSTRUIDO_VALOR = 'rocha';
function definirObstrucaoChecklistFuro(id, motivo){
  const f = checklistFuros.find(x=>x.id===id);
  if(!f) return;
  const valor = motivo ? OBSTRUIDO_VALOR : '';
  if(!valor && f.obstruido && !podeDesmarcarFuro(f,'obs')){ avisarSoQuemMarcou(f.obstruidoPor, equipeObsEfetivaId(f)); return; }
  vibrarCurto(valor ? [12, 40, 12] : 10);
  const antes = fotoFuro(f);
  f.obstruido = valor;
  enfileirar('checklist_furos', 'update', { id: f.id, obstruido: valor || null });
  salvarChecklistFurosLocal();
  renderChecklist();
  if(valor) animarObstrucao(f.id);
  avisoDesfazerFuro(f, antes, valor ? `F${f.numero} marcado como obstruído.` : `F${f.numero} liberado.`);
}

function atualizarMetragemChecklistFuro(id, valorTexto){
  const f = checklistFuros.find(x=>x.id===id);
  if(!f) return;
  const valor = valorTexto.trim().replace(',', '.');
  const numero = valor === '' ? null : parseFloat(valor);
  f.metragem = (numero !== null && !isNaN(numero)) ? numero : null;
  enfileirar('checklist_furos', 'update', { id: f.id, metragem: f.metragem });
  salvarChecklistFurosLocal();
  renderChecklist();
}

async function removerChecklistFuro(id){
  const f = checklistFuros.find(x=>x.id===id);
  if(!f) return;
  if(!(await confirmDialog(`Remover o furo F${f.numero} do checklist?`, 'Remover'))) return;
  checklistFuros = checklistFuros.filter(x=>x.id!==id);
  enfileirar('checklist_furos', 'delete', { id });
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast(`Furo F${f.numero} removido.`, {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoChecklistFuro(f)
  });
}

function desfazerRemocaoChecklistFuro(furoRemovido){
  if(checklistFuros.some(x=>x.id===furoRemovido.id)) return; // já foi restaurado
  checklistFuros.push(furoRemovido);
  restaurarNaFila('checklist_furos', furoRemovido.id, {
    id: furoRemovido.id, checklist_leque_id: furoRemovido.checklistLequeId,
    numero: furoRemovido.numero, perfilado: furoRemovido.perfilado, topografado: furoRemovido.topografado,
    obstruido: furoRemovido.obstruido || null
  });
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast('Furo restaurado no checklist.');
}
function mapFuro(row){ return { id: row.id, lequeId: row.leque_id, numero: row.numero, metragemEsperada: row.metragem_esperada, metragemReal: row.metragem_real, situacao: row.situacao, observacao: row.observacao || '', precisaRefazer: !!row.precisa_refazer, ts: row.criado_em }; }



// ---------- Busca rápida: "LQ05 F03" abre o leque e destaca o furo ----------
function destacarLinhaFuro(furoId){
  requestAnimationFrame(()=>{
    const inp = document.querySelector(`input[onchange*="toggleChecklistFuro('${furoId}'"]`);
    const tr = inp && inp.closest('tr'); if(!tr) return;
    document.querySelectorAll('tr.ck-proximo').forEach(x=>x.classList.remove('ck-proximo'));
    tr.classList.add('ck-proximo');
    const r = tr.getBoundingClientRect();
    if(r.top < 90 || r.bottom > innerHeight - 90) tr.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block:'center' });
    setTimeout(()=> tr.classList.remove('ck-proximo'), 4000);
  });
}
function irParaFuroBuscado(txt){
  const l = lerBuscaFuro(txt);
  if(!l){ showToast('Digite assim: LQ05 F03 (leque e furo).'); return; }
  const itens = checklistDoAnelAtivo().filter(c=> String(c.numero).replace(/^0+/,'') === l.numero.replace(/^0+/,'') && (!l.tipo || c.tipo === l.tipo));
  if(!itens.length){ showToast(`Leque ${l.numero} não encontrado neste realce.`); return; }
  const c = itens[0];
  checklistExpandido.add(c.id);
  if(!l.furo){ renderChecklist(); const card = document.getElementById('ck-card-' + c.id); if(card) card.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
  const f = checklistFurosDoLeque(c.id).find(x=> String(x.numero).replace(/^0+/,'') === l.furo.replace(/^0+/,''));
  renderChecklist();
  if(!f){ showToast(`${PREFIXO[c.tipo]}${c.numero} não tem o furo F${l.furo}.`); return; }
  destacarLinhaFuro(f.id);
}

// ---------- Próximo furo: depois de marcar, destaca o próximo pendente do mesmo leque ----------
function destacarProximoFuro(f, coluna){
  const lista = checklistFurosDoLeque(f.checklistLequeId);
  const campo = coluna === 'topo' ? 'topografado' : 'perfilado';
  if(!f[campo]) return; // só ao marcar, não ao desmarcar
  const i = lista.findIndex(x=>x.id === f.id);
  const prox = lista.slice(i + 1).concat(lista.slice(0, i)).find(x=> !x[campo] && !x.obstruido);
  if(prox) destacarLinhaFuro(prox.id);
}

// ---------- Continuar de onde parei ----------
const ULTIMO_KEY = 'perfilagem-ultimo-v1';
function salvarUltimo(extra){
  try{
    const atual = JSON.parse(localStorage.getItem(ULTIMO_KEY) || '{}');
    localStorage.setItem(ULTIMO_KEY, JSON.stringify(Object.assign(atual, extra, { exp:[...checklistExpandido].slice(0, 12) })));
  }catch(e){}
}
function lerUltimo(){ try{ return JSON.parse(localStorage.getItem(ULTIMO_KEY) || '{}'); }catch(e){ return {}; } }
(function(){ const u = lerUltimo(); (u.exp || []).forEach(id=> checklistExpandido.add(id)); })();


// ---------- Anotação por furo e compartilhar um leque ----------
async function editarObservacaoFuro(id){
  const f = checklistFuros.find(x=>x.id===id); if(!f) return;
  const novo = await editarObservacaoModal(f.observacao || '');
  if(novo === null || novo === (f.observacao || '')) return;
  f.observacao = novo.slice(0, 200);
  enfileirar('checklist_furos', 'update', { id: f.id, observacao: f.observacao || null });
  salvarChecklistFurosLocal();
  renderChecklist();
  showToast(f.observacao ? `Anotação de F${f.numero} salva.` : `Anotação de F${f.numero} removida.`);
}
function montarResumoLequeWhatsApp(c){
  const fl = checklistFurosDoLeque(c.id);
  const cod = PREFIXO[c.tipo] + c.numero;
  const perf = fl.filter(f=>f.perfilado).length, topo = fl.filter(f=>f.topografado).length, tot = fl.length;
  const pf = tot ? Math.round(perf / tot * 100) : 0, pt = tot ? Math.round(topo / tot * 100) : 0;
  const anel = aneis.find(a=>a.id===c.anelId);
  let t = `📍 *${cod}*${c.localizacao ? ' (' + semAcento(c.localizacao) + ')' : ''}${anel ? ' - Realce ' + semAcento(anel.nome) : ''}\n`;
  t += `Furos perfilados: ${perf}/${tot} (${pf}%)\n${barraWa(pf)}\nFuros topografados: ${topo}/${tot} (${pt}%)\n${barraWa(pt)}\n`;
  const pend = fl.filter(f=>!f.perfilado && !f.obstruido).map(f=>'F'+f.numero);
  const pendT = fl.filter(f=>!f.topografado && !f.obstruido).map(f=>'F'+f.numero);
  const obs = fl.filter(f=>f.obstruido).map(f=>'F'+f.numero);
  if(pend.length) t += `\n*🟡 PENDENTES PERFILAGEM*\n${pend.join(', ')}\n`;
  if(pendT.length) t += `\n*🟡 PENDENTES TOPOGRAFIA*\n${pendT.join(', ')}\n`;
  if(obs.length) t += `\n⛔ *OBSTRUIDOS*\n${obs.join(', ')}\n`;
  const notas = blocoNotasFurosWhatsApp([c]); if(notas) t += `\n${notas}\n`;
  if(c.observacao) t += `\n📝 *OBSERVACAO*\n${semAcento(c.observacao)}\n`;
  return semAcento(t.trim()).replace(/\u0301/g, '');
}
function enviarLequeWhatsApp(id){
  const c = checklistLeques.find(x=>x.id===id); if(!c) return;
  const texto = montarResumoLequeWhatsApp(c);
  const numero = configApp.whatsapp;
  window.open(numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}
