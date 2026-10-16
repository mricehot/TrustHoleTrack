// ---------- Início de turno: checklist da equipe + recado para o próximo turno ----------
// Os itens são da equipe (qualquer pessoa da equipe adiciona e marca). As marcações valem por "dia de
// turno": o dia só vira às 06h, para o turno da noite não perder as marcas à meia-noite.
// Tudo é opcional e vai pela mesma fila de envio das outras marcações (funciona sem sinal).
const TURNO_INICIO_KEY = 'perfilagem-inicio-turno-v1';
let turnoItens = [];   // { id, equipeId, texto, criadoPor, ordem, ts }
let turnoMarcas = [];  // { id, equipeId, itemId, data, feito, feitoPor, feitoEm }
let turnoRecados = []; // { id, equipeId, texto, criadoPor, ts }
let inicioEquipeEscolhida = '';
let inicioAdicionando = false;
const RECADO_VALIDADE_H = 36;

function mapTurnoItem(r){ return { id: r.id, equipeId: r.equipe_id, texto: r.texto || '', criadoPor: r.criado_por || '', ordem: r.ordem || 0, ts: r.criado_em }; }
function mapTurnoMarca(r){ return { id: r.id, equipeId: r.equipe_id, itemId: r.item_id, data: String(r.data || '').slice(0, 10), feito: !!r.feito, feitoPor: r.feito_por || '', feitoEm: r.feito_em }; }
function mapTurnoRecado(r){ return { id: r.id, equipeId: r.equipe_id || '', texto: r.texto || '', criadoPor: r.criado_por || '', ts: r.criado_em }; }
function salvarInicioTurnoLocal(){ try{ localStorage.setItem(TURNO_INICIO_KEY, JSON.stringify({ turnoItens, turnoMarcas, turnoRecados })); }catch(e){} }
(function(){ try{ const o = JSON.parse(localStorage.getItem(TURNO_INICIO_KEY) || '{}'); turnoItens = o.turnoItens || []; turnoMarcas = o.turnoMarcas || []; turnoRecados = o.turnoRecados || []; }catch(e){} })();

// Dia de turno: antes das 06h ainda conta como o dia anterior.
function diaDeTurno(){ return dataISOLocal(new Date(Date.now() - 6 * 3600000)); }
// Id da marcação é determinístico (item + dia): dois aparelhos marcando o mesmo item caem no mesmo registro.
function idMarcaTurno(itemId, dia){ return (parseInt(dia.replace(/-/g, ''), 10) >>> 0).toString(16).padStart(8, '0') + String(itemId).slice(8); }

function equipeDoInicio(){
  const minha = typeof minhaEquipeId === 'function' ? minhaEquipeId() : null;
  if(minha) return minha;
  const lista = equipesDoInicio();
  if(inicioEquipeEscolhida && lista.some(e=>e.id === inicioEquipeEscolhida)) return inicioEquipeEscolhida;
  return lista[0] ? lista[0].id : '';
}
function equipesDoInicio(){
  const p = typeof configApp !== 'undefined' ? configApp.projetoAtivo : '';
  const l = typeof equipesDoProjeto === 'function' ? equipesDoProjeto(p) : [];
  return l && l.length ? l : equipes;
}
function itensDoInicio(eqId){ return turnoItens.filter(i=>i.equipeId === eqId).sort((a,b)=> (a.ordem - b.ordem) || String(a.ts).localeCompare(String(b.ts))); }
function itemFeitoHoje(itemId){ const m = turnoMarcas.find(x=>x.itemId === itemId && x.data === diaDeTurno()); return m && m.feito ? m : null; }
function recadosParaMim(){
  const minha = typeof minhaEquipeId === 'function' ? minhaEquipeId() : null;
  const limite = Date.now() - RECADO_VALIDADE_H * 3600000;
  return turnoRecados.filter(r=> new Date(r.ts).getTime() > limite && (!minha || r.equipeId !== minha))
    .sort((a,b)=> new Date(b.ts) - new Date(a.ts));
}
function resumoInicioTurno(){
  const eq = equipeDoInicio(); if(!eq) return { total: 0, feitos: 0, eq };
  const itens = itensDoInicio(eq);
  return { total: itens.length, feitos: itens.filter(i=>itemFeitoHoje(i.id)).length, eq };
}

// ---- Iniciar turno: só o que a pessoa marca DEPOIS de iniciar entra no resumo do WhatsApp ----
const TURNO_SESSAO_KEY = 'perfilagem-turno-sessao-v1';
function turnoIniciadoEm(){
  try{ const v = JSON.parse(localStorage.getItem(TURNO_SESSAO_KEY) || 'null'); const t = v && new Date(v.inicio).getTime(); return t && !isNaN(t) ? t : 0; }catch(e){ return 0; }
}
function renderTurnoSessao(){
  const box = document.getElementById('turno-sessao'); if(!box) return;
  const t = turnoIniciadoEm();
  if(!t){
    box.className = 'turno-sessao';
    box.innerHTML = `<div class="ts-txt"><b>Turno não iniciado</b><small>Inicie para o resumo do WhatsApp trazer só o que você marcar a partir de agora.</small></div><div class="ts-botoes"><button type="button" class="steel" onclick="iniciarTurno()">▶ Iniciar turno</button><button type="button" class="ghost" onclick="abrirHistoricoTurnos()">🕘 Histórico</button></div>`;
    return;
  }
  const d = new Date(t), hh = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  const hoje = new Date().toDateString() === d.toDateString();
  box.className = 'turno-sessao ativo';
  box.innerHTML = `<div class="ts-txt"><b>Turno em andamento</b><small>desde ${hoje ? '' : d.toLocaleDateString('pt-BR') + ' '}${hh}</small></div><div class="ts-botoes"><button type="button" class="steel btn-encerrar-turno" onclick="abrirEncerrarTurno()">🏁 Encerrar turno</button><button type="button" class="ghost" onclick="abrirHistoricoTurnos()">🕘 Histórico</button></div>`;
}
// ---- Histórico de turnos: cada turno encerrado guarda o relatório pronto, para reenviar depois ----
const TURNO_HIST_KEY = 'perfilagem-turno-historico-v1';
function lerHistoricoTurnos(){ try{ const v = JSON.parse(localStorage.getItem(TURNO_HIST_KEY) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function gravarHistoricoTurnos(lista){ try{ localStorage.setItem(TURNO_HIST_KEY, JSON.stringify(lista.slice(0, 40))); }catch(e){} }
function guardarTurnoNoHistorico(){
  const ini = turnoIniciadoEm(); if(!ini) return;
  let texto = ''; try{ texto = montarResumoTurnoWhatsApp(); }catch(e){}
  let d = {}; try{ d = dadosFimDeTurno(); }catch(e){}
  const turno = (turnoInfo.turnoNumero || turnoInfo.turnoLetra) ? `${turnoInfo.turnoNumero || ''}° turno${turnoInfo.turnoLetra ? ' ' + turnoInfo.turnoLetra : ''}` : 'Turno';
  const lista = lerHistoricoTurnos();
  lista.unshift({ id: uuidv4(), inicio: new Date(ini).toISOString(), fim: new Date().toISOString(), usuario: typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '', turno, data: turnoInfo.data || '', perf: d.perf || 0, topo: d.topo || 0, texto });
  gravarHistoricoTurnos(lista);
}
function abrirHistoricoTurnos(){
  const root = document.getElementById('modal-root'); if(!root) return;
  const lista = lerHistoricoTurnos();
  const hh = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };
  const dia = iso => new Date(iso).toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
  const itens = lista.map(h=> `<div class="hist-turno" data-id="${h.id}">
      <div class="ht-cab"><b>${escHtml(h.turno)}</b><span>${dia(h.inicio)} · ${hh(h.inicio)} às ${hh(h.fim)}</span></div>
      <div class="ht-sub">${escHtml(h.usuario || '')}${h.usuario ? ' · ' : ''}<b>${h.perf}</b> perfilados · <b>${h.topo}</b> topografados</div>
      <details class="ht-det"><summary>Ver relatório</summary><pre>${escHtml(h.texto || '(sem texto guardado)')}</pre></details>
      <div class="ht-acoes"><button type="button" class="steel" data-a="enviar">Enviar no WhatsApp</button><button type="button" class="ghost" data-a="copiar">Copiar</button><button type="button" class="ghost perigo" data-a="apagar">Apagar</button></div></div>`).join('');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga">
    <h3 style="margin:0 0 10px">🕘 Histórico de turnos</h3>
    ${itens || '<div class="hint">Nenhum turno encerrado ainda. Quando você encerrar um turno (🏁), o relatório fica guardado aqui para reenviar.</div>'}
    <div class="hint" style="margin-top:8px;">Guardado neste aparelho (os 40 últimos turnos).</div>
    <div class="modal-actions"><button class="ghost" id="ht-fechar">Fechar</button></div></div></div>`;
  const fechar = ()=>{ root.innerHTML = ''; };
  document.getElementById('ht-fechar').onclick = fechar;
  document.getElementById('modal-overlay').addEventListener('click', ev=>{ if(ev.target.id === 'modal-overlay') fechar(); });
  root.querySelectorAll('.hist-turno').forEach(box=>{
    const h = lista.find(x=>x.id === box.dataset.id); if(!h) return;
    box.querySelector('[data-a=enviar]').onclick = ()=>{ const n = configApp.whatsapp; window.open(n ? `https://wa.me/${n}?text=${encodeURIComponent(h.texto)}` : `https://wa.me/?text=${encodeURIComponent(h.texto)}`, '_blank'); };
    box.querySelector('[data-a=copiar]').onclick = async ()=>{ const ok = await copiarTextoResumo(h.texto); showToast(ok ? 'Relatório copiado. É só colar onde quiser.' : 'Não foi possível copiar.', { tipo: ok ? 'ok' : 'erro' }); };
    box.querySelector('[data-a=apagar]').onclick = async ()=>{ if(!(await confirmDialog('Apagar este turno do histórico?', 'Apagar'))) return; gravarHistoricoTurnos(lerHistoricoTurnos().filter(x=>x.id !== h.id)); abrirHistoricoTurnos(); };
  });
}

// Encerrar o turno (depois de copiar/enviar o resumo ou em "Só encerrar") fecha a sessão: o quadro volta a oferecer "Iniciar turno".
function finalizarSessaoTurno(){
  guardarTurnoNoHistorico();
  try{ localStorage.removeItem(TURNO_SESSAO_KEY); }catch(e){}
  renderTurnoSessao();
  try{ renderResumoTurno(); }catch(e){}
  showToast('Turno encerrado. Para o próximo, toque em Iniciar turno.', { tipo:'ok' });
}
async function iniciarTurno(){
  if(turnoIniciadoEm() && !(await confirmDialog('Já existe um turno em andamento. Começar um novo? O resumo passa a contar só a partir de agora.', 'Começar novo'))) return;
  try{ localStorage.setItem(TURNO_SESSAO_KEY, JSON.stringify({ inicio: new Date().toISOString(), usuario: typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '' })); }catch(e){}
  renderTurnoSessao();
  try{ renderResumoTurno(); }catch(e){}
  showToast('Turno iniciado. O resumo vai contar só o que você marcar daqui para frente.', { tipo:'ok' });
}

function renderInicioTurno(){
  renderTurnoSessao();
  const corpo = document.getElementById('inicio-turno-corpo'); if(!corpo) return;
  const eq = equipeDoInicio();
  const itens = eq ? itensDoInicio(eq) : [];
  const feitos = itens.filter(i=>itemFeitoHoje(i.id)).length;
  const cont = document.getElementById('inicio-cont'); if(cont) cont.textContent = itens.length ? `${feitos}/${itens.length}` : '—';
  const eu = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  const gestor = typeof ehGestor === 'function' && ehGestor();
  const minha = typeof minhaEquipeId === 'function' ? minhaEquipeId() : null;
  const e2 = escHtml;
  const lista = equipesDoInicio();
  if(!lista.length){ corpo.innerHTML = '<div class="hint">Cadastre as equipes (Gerenciar equipes) para usar o checklist de início de turno.</div>'; return; }
  const recados = recadosParaMim();
  const quando = ts => new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  const nomeEq = id => (equipes.find(x=>x.id === id) || {}).nome || '';
  corpo.innerHTML = `
    ${minha ? '' : `<div class="field"><label for="inicio-equipe">Equipe</label><select id="inicio-equipe" onchange="inicioEquipeEscolhida=this.value;renderInicioTurno()">${lista.map(e=>`<option value="${e.id}" ${e.id===eq?'selected':''}>${e2(e.nome)}</option>`).join('')}</select></div>`}
    ${recados.length ? recados.slice(0, 3).map(r=>`<div class="inicio-recado" role="note"><b>📝 Recado${nomeEq(r.equipeId) ? ' da ' + e2(nomeEq(r.equipeId)) : ' do turno anterior'}</b><p>${e2(r.texto)}</p><small>${e2(r.criadoPor || '')}${r.criadoPor ? ' · ' : ''}${quando(r.ts)}${gestor || r.criadoPor === eu ? ` · <button type="button" class="link-obs" onclick="apagarRecadoTurno('${r.id}')">apagar</button>` : ''}</small></div>`).join('') : ''}
    ${itens.length ? `<div class="inicio-prog"><span><b>${feitos}</b> de ${itens.length} itens confirmados</span><div class="progress-track"><div class="progress-fill ${feitos === itens.length ? 'cheio' : ''}" style="width:${Math.round(feitos / itens.length * 100)}%"></div></div></div>` : '<div class="hint">Nenhum item ainda. Adicione o que a sua equipe confere ao começar o turno (bateria, rádio, área liberada…). Os itens valem para a equipe toda.</div>'}
    <div class="inicio-itens" role="group" aria-label="Itens do início de turno">
      ${itens.map(i=>{ const m = itemFeitoHoje(i.id); const meu = i.criadoPor && i.criadoPor === eu;
        return `<div class="inicio-item ${m ? 'feito' : ''}"><button type="button" class="inicio-caixa" role="checkbox" aria-checked="${!!m}" onclick="alternarItemInicio('${i.id}')"><span class="box" aria-hidden="true">${m ? '✓' : ''}</span><span class="txt">${e2(i.texto)}</span>${meu ? '<span class="meu">MEU</span>' : ''}</button>${(meu || gestor) ? `<button type="button" class="icon icon-remover" aria-label="remover item ${e2(i.texto)}" onclick="removerItemInicio('${i.id}')">✕</button>` : ''}</div>`; }).join('')}
    </div>
    ${inicioAdicionando
      ? `<form class="inicio-add" onsubmit="adicionarItemInicio();return false;"><input id="inicio-novo" type="text" maxlength="120" placeholder="ex.: Bateria do perfilador" enterkeyhint="done" autocomplete="off" aria-label="novo item do checklist de início de turno"><button type="submit">Adicionar</button><button type="button" class="ghost" onclick="inicioAdicionando=false;renderInicioTurno()">Cancelar</button></form>`
      : `<button type="button" class="inicio-add-btn" onclick="inicioAdicionando=true;renderInicioTurno();document.getElementById('inicio-novo').focus()">＋ Adicionar item</button>`}
    <details class="inicio-recado-form"><summary>📝 Deixar recado para o próximo turno</summary>
      <form onsubmit="publicarRecadoTurno();return false;"><textarea id="recado-texto" rows="3" maxlength="600" placeholder="ex.: N12 obstruído no fundo — pedir limpeza antes de perfilar" aria-label="recado para o próximo turno"></textarea><button type="submit">Publicar recado</button></form>
    </details>`;
  atualizarAvisoInicioTurno();
}

function alternarItemInicio(itemId){
  const it = turnoItens.find(x=>x.id === itemId); if(!it) return;
  const dia = diaDeTurno(), id = idMarcaTurno(itemId, dia);
  let m = turnoMarcas.find(x=>x.id === id);
  const novo = !(m && m.feito);
  if(!m){ m = { id, equipeId: it.equipeId, itemId, data: dia, feito: novo, feitoPor: '', feitoEm: '' }; turnoMarcas.push(m); }
  m.feito = novo; m.feitoPor = nomeDoUsuario(); m.feitoEm = new Date().toISOString();
  salvarInicioTurnoLocal();
  enfileirar('turno_checklist_marcas', 'upsert', { id, equipe_id: it.equipeId, item_id: itemId, data: dia, feito: novo, feito_por: m.feitoPor, feito_em: m.feitoEm });
  if(typeof vibrarCurto === 'function') vibrarCurto(10);
  renderInicioTurno();
}
function adicionarItemInicio(){
  const inp = document.getElementById('inicio-novo'); if(!inp) return;
  const texto = inp.value.trim().slice(0, 120); const eq = equipeDoInicio();
  if(!texto){ inp.focus(); return; }
  if(!eq){ showToast('Escolha uma equipe antes.', { erro:false }); return; }
  const itens = itensDoInicio(eq);
  if(itens.some(i=>i.texto.toLowerCase() === texto.toLowerCase())){ showToast('Esse item já está na lista.', { erro:false }); return; }
  const it = { id: uuidv4(), equipeId: eq, texto, criadoPor: nomeDoUsuario(), ordem: itens.length ? Math.max(...itens.map(i=>i.ordem)) + 1 : 0, ts: new Date().toISOString() };
  turnoItens.push(it); salvarInicioTurnoLocal();
  enfileirar('turno_checklist_itens', 'insert', { id: it.id, equipe_id: eq, texto, criado_por: it.criadoPor, ordem: it.ordem });
  renderInicioTurno();
  const novo = document.getElementById('inicio-novo'); if(novo) novo.focus(); // segue adicionando, um depois do outro
}
function removerItemInicio(itemId){
  const it = turnoItens.find(x=>x.id === itemId); if(!it) return;
  const marcas = turnoMarcas.filter(m=>m.itemId === itemId);
  turnoItens = turnoItens.filter(x=>x.id !== itemId); turnoMarcas = turnoMarcas.filter(m=>m.itemId !== itemId);
  salvarInicioTurnoLocal();
  enfileirar('turno_checklist_itens', 'delete', { id: itemId });
  renderInicioTurno();
  showToast(`Item "${it.texto}" removido.`, { acaoLabel:'Desfazer', onAcao: ()=>{
    turnoItens.push(it); turnoMarcas.push(...marcas); salvarInicioTurnoLocal();
    enfileirar('turno_checklist_itens', 'insert', { id: it.id, equipe_id: it.equipeId, texto: it.texto, criado_por: it.criadoPor, ordem: it.ordem });
    marcas.filter(m=>m.feito).forEach(m=> enfileirar('turno_checklist_marcas', 'upsert', { id: m.id, equipe_id: m.equipeId, item_id: m.itemId, data: m.data, feito: true, feito_por: m.feitoPor, feito_em: m.feitoEm }));
    renderInicioTurno();
  }});
}
function publicarRecadoTurno(){
  const t = document.getElementById('recado-texto'); if(!t) return;
  const texto = t.value.trim().slice(0, 600); if(!texto){ t.focus(); return; }
  const eq = (typeof minhaEquipeId === 'function' && minhaEquipeId()) || equipeDoInicio() || '';
  const r = { id: uuidv4(), equipeId: eq, texto, criadoPor: nomeDoUsuario(), ts: new Date().toISOString() };
  turnoRecados.push(r); salvarInicioTurnoLocal();
  const reg = { id: r.id, texto, criado_por: r.criadoPor, criado_em: r.ts }; if(eq) reg.equipe_id = eq;
  enfileirar('turno_recados', 'insert', reg);
  showToast('Recado salvo. A próxima equipe vê ao abrir o turno.', { tipo:'ok' });
  renderInicioTurno();
}
function apagarRecadoTurno(id){
  const r = turnoRecados.find(x=>x.id === id); if(!r) return;
  turnoRecados = turnoRecados.filter(x=>x.id !== id); salvarInicioTurnoLocal();
  enfileirar('turno_recados', 'delete', { id });
  renderInicioTurno();
}

// Aviso discreto no topo do Checklist: uma linha só, que some por hoje se a pessoa dispensar.
const AVISO_INICIO_KEY = 'perfilagem-aviso-inicio-v1';
function avisoInicioDispensadoHoje(){ try{ return localStorage.getItem(AVISO_INICIO_KEY) === diaDeTurno(); }catch(e){ return false; } }
function dispensarAvisoInicio(){ try{ localStorage.setItem(AVISO_INICIO_KEY, diaDeTurno()); }catch(e){} atualizarAvisoInicioTurno(); }
function abrirInicioTurno(){
  if(typeof mostrarView === 'function') mostrarView('turno');
  const c = document.getElementById('card-inicio-turno');
  if(c){ turnoSecoes.inicio = false; salvarTurnoSecoes(); aplicarSecoesTurno(); setTimeout(()=> c.scrollIntoView({ behavior:'smooth', block:'start' }), 60); }
}
function atualizarAvisoInicioTurno(){
  const view = document.getElementById('view-checklist'); if(!view) return;
  let box = document.getElementById('aviso-inicio-turno');
  if(!box){ box = document.createElement('div'); box.id = 'aviso-inicio-turno'; box.className = 'aviso-inicio'; box.hidden = true; view.insertBefore(box, view.firstChild); }
  const r = resumoInicioTurno(), nRec = recadosParaMim().length;
  const falta = r.total - r.feitos;
  if(avisoInicioDispensadoHoje() || (falta <= 0 && !nRec)){ box.hidden = true; box.innerHTML = ''; return; }
  const partes = [];
  if(falta > 0) partes.push(`☐ Início de turno: ${falta === r.total ? r.total + ' ite' + (r.total === 1 ? 'm' : 'ns') : 'faltam ' + falta}`);
  if(nRec) partes.push(`📝 ${nRec} recado${nRec === 1 ? '' : 's'} do turno anterior`);
  box.hidden = false;
  box.innerHTML = `<span>${partes.join(' · ')}</span><button type="button" class="ghost" onclick="abrirInicioTurno()">Abrir</button><button type="button" class="aviso-inicio-x" aria-label="dispensar aviso por hoje" onclick="dispensarAvisoInicio()">✕</button>`;
}

// ---- servidor ----
async function carregarInicioTurnoServidor(){
  if(!navigator.onLine || typeof buscarTudo !== 'function') return;
  if(falhasDeEnvio.size > 0 || debouncesPendentes.size > 0 || enviosEmAndamento > 0) return;
  try{
    const [a, b, c] = await Promise.all([buscarTudo('turno_checklist_itens'), buscarTudo('turno_checklist_marcas'), buscarTudo('turno_recados')]);
    if(a.error || b.error || c.error) return;
    turnoItens = a.data.map(mapTurnoItem); turnoMarcas = b.data.map(mapTurnoMarca); turnoRecados = c.data.map(mapTurnoRecado);
    salvarInicioTurnoLocal(); renderInicioTurno();
  }catch(e){}
}
(function(){
  if(typeof atualizarDoServidor === 'function'){
    const orig = atualizarDoServidor;
    atualizarDoServidor = async function(){ const r = await orig.apply(this, arguments); carregarInicioTurnoServidor(); return r; };
  }
  let t = null, canal = null;
  const agendar = ()=>{ clearTimeout(t); t = setTimeout(carregarInicioTurnoServidor, 500); };
  function ouvir(){
    if(canal || typeof db.channel !== 'function' || !usuarioAtual) return;
    try{ canal = db.channel('inicio-turno').on('postgres_changes', { event:'*', schema:'public', table:'turno_checklist_itens' }, agendar).on('postgres_changes', { event:'*', schema:'public', table:'turno_checklist_marcas' }, agendar).on('postgres_changes', { event:'*', schema:'public', table:'turno_recados' }, agendar).subscribe(); }catch(e){ canal = null; }
  }
  setInterval(ouvir, 4000); // assim que houver usuário logado
  window.addEventListener('load', ()=>{ renderInicioTurno(); carregarInicioTurnoServidor(); });
})();
// Redesenha junto com o checklist e ao abrir a página Turno.
(function(){
  const orig = renderChecklist;
  renderChecklist = function(){ const r = orig.apply(this, arguments); try{ renderInicioTurno(); }catch(e){} return r; };
})();
