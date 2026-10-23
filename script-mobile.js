// ---------- Visual mobile: cartão do turno no topo da aba Turno (atalhos de 1 toque) ----------
function proximoLequePendente(){
  const itens = (typeof checklistDoAnelAtivo === 'function') ? checklistDoAnelAtivo() : [];
  for(const c of itens){
    const fs = checklistFurosDoLeque(c.id);
    if(fs.some(f=> !f.obstruido && (!f.perfilado || !f.topografado))) return c.id;
  }
  return itens.length ? itens[0].id : null;
}
function renderHeroTurno(){
  const view = document.getElementById('view-turno'); if(!view) return;
  let h = document.getElementById('turno-hero');
  if(!h){ h = document.createElement('div'); h.id = 'turno-hero'; h.className = 'turno-hero'; view.insertBefore(h, view.firstChild); }
  const ini = (typeof turnoIniciadoEm === 'function') ? turnoIniciadoEm() : 0;
  const ti = (typeof turnoInfo !== 'undefined' && turnoInfo) || {};
  const titulo = (ti.turnoNumero || ti.turnoLetra) ? `${ti.turnoNumero ? ti.turnoNumero + 'º Turno' : 'Turno'}${ti.turnoLetra ? ' · ' + ti.turnoLetra : ''}` : 'Turno';
  const d = ini ? new Date(ini) : null;
  const desde = d ? 'desde ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') : 'ainda não iniciado';
  const tec = ti.tecnicos ? escHtml(String(ti.tecnicos)) + ' · ' : '';
  const hoje = dataISOLocal(new Date()), ehHoje = v=> v && dataISOLocal(new Date(v)) === hoje;
  const itens = checklistDoAnelAtivo(), ids = new Set(itens.map(c=>c.id));
  const fr = checklistFuros.filter(f=>ids.has(f.checklistLequeId));
  const perf = fr.filter(f=>f.perfilado && ehHoje(f.perfiladoEm)).length;
  const topo = fr.filter(f=>f.topografado && ehHoje(f.topografadoEm)).length;
  const obs = fr.filter(f=>f.obstruido).length;
  const kpi = (v, r, c)=> `<div class="th-kpi"><b class="${c}">${v}</b><span>${r}</span></div>`;
  h.dataset.ativo = ini ? '1' : '0';
  h.innerHTML = `<div class="th-cartao"><div class="th-topo"><div><small>${ini ? 'Turno em andamento' : 'Turno'}</small><strong>${titulo}</strong><em>${tec}${desde}</em></div></div>
    <div class="th-botoes"><button type="button" class="th-ffa">Furo a furo</button>${ini ? '<button type="button" class="th-fim">Encerrar turno</button>' : '<button type="button" class="th-ini">Iniciar turno</button>'}</div></div>
    <div class="th-kpis">${kpi(perf,'Perfilados hoje','perf')}${kpi(topo,'Topografados hoje','topo')}${kpi(obs,'Obstruídos','obs')}</div>`;
}
document.addEventListener('click', ev=>{
  const b = ev.target.closest && ev.target.closest('#turno-hero button'); if(!b) return;
  if(b.classList.contains('th-ffa')){
    const id = proximoLequePendente();
    if(!id){ showToast('Sem leques no realce ativo.', { tipo:'aviso' }); return; }
    abrirFuroAFuro(id);
  } else if(b.classList.contains('th-fim')){ abrirEncerrarTurno(); }
  else if(b.classList.contains('th-ini')){ if(typeof iniciarTurno === 'function') iniciarTurno(); }
});
aoRenderizarTudo(renderHeroTurno);
aoRenderizarChecklist(renderHeroTurno);
