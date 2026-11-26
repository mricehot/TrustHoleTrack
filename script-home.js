// ---------- Início: fechamento da semana + o que fazer agora (norteamento) ----------
let homeOffset = 0;
const HOME_DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const ddmmHome = d => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
const varHome = (atual, ant) => !ant ? (atual ? null : 0) : Math.round((atual - ant) / ant * 100);

function dadosHomeInicio(offset){
  const ini = inicioDaSemana(new Date()); ini.setDate(ini.getDate() + offset * 7);
  const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
  const iniAnt = new Date(ini); iniAnt.setDate(iniAnt.getDate() - 7);
  const iniISO = dataISOLocal(ini), fimISO = dataISOLocal(fim), iniAntISO = dataISOLocal(iniAnt), fimAntISO = dataISOLocal(new Date(fim.getTime() - 7 * 86400000));
  const realcesEsc = aneisNoEscopoAtual(), idsA = new Set(realcesEsc.map(a=>a.id));
  const leques = checklistLeques.filter(c=>idsA.has(c.anelId));
  const furos = checklistFurosNoEscopoAtual();
  const dias = []; for(let i = 0; i < 7; i++){ const d = new Date(ini); d.setDate(d.getDate() + i); dias.push({ iso: dataISOLocal(d), nome: HOME_DIAS[d.getDay()], dd: ddmmHome(d), folga: d.getDay() === 0, perf:0, topo:0, az:0, trat:0, metros:0 }); }
  const cur = { perf:0, topo:0, az:0, trat:0, metros:0 }, ant = { perf:0, topo:0, az:0, trat:0, metros:0 };
  const marca = (iso, k, v)=>{ v = v === undefined ? 1 : v; if(iso >= iniISO && iso <= fimISO){ cur[k] += v; const d = dias.find(x=>x.iso === iso); if(d) d[k] += v; } else if(iso >= iniAntISO && iso <= fimAntISO) ant[k] += v; };
  furos.forEach(f=>{
    if(f.perfilado && f.perfiladoEm) marca(chaveDia(f.perfiladoEm), 'perf');
    if(f.topografado && f.topografadoEm) marca(chaveDia(f.topografadoEm), 'topo');
    if(furoTemAzimute(f) && f.azimuteEm) marca(chaveDia(f.azimuteEm), 'az');
  });
  const rel = dadosRelatorioTratativa([...idsA]).realces;
  const ymAtual = iniISO.slice(0,7); let metrosMes = 0, tratMes = 0;
  rel.forEach(r=> r.leques.forEach(l=>{ if(l.status !== 'Tratado' || !l.tratadoEm) return; const iso = chaveDia(l.tratadoEm), m = metrosDoLeque(l);
    marca(iso, 'trat'); marca(iso, 'metros', m); if(iso.slice(0,7) === ymAtual){ metrosMes += m; tratMes++; } }));
  // Situação atual (não depende da semana escolhida)
  const est = leques.map(estadoTratativaLeque);
  const uteis = furos.filter(f=>!f.obstruido), nU = uteis.length;
  const pipe = { total: nU, obst: furos.length - nU, semPerf: uteis.filter(f=>!f.perfilado).length,
    esperaTopo: uteis.filter(f=>f.perfilado && !f.topografado).length, esperaAz: uteis.filter(f=>f.topografado && !furoTemAzimute(f)).length,
    azFeito: uteis.filter(f=>furoTemAzimute(f)).length, perfFeito: uteis.filter(f=>f.perfilado).length, topoFeito: uteis.filter(f=>f.topografado).length };
  const hojeISO = dataISOLocal(new Date());
  // ritmo: furos marcados nos últimos 7 dias corridos, por dia de trabalho (seg–sáb = 6)
  const d7 = dataISOLocal(new Date(Date.now() - 6 * 86400000));
  const ult7 = k => furos.filter(f=>{ const dt = k === 'perf' ? f.perfiladoEm : k === 'topo' ? f.topografadoEm : f.azimuteEm; const ok = k === 'perf' ? f.perfilado : k === 'topo' ? f.topografado : furoTemAzimute(f); return ok && dt && chaveDia(dt) >= d7; }).length;
  const ritmo = { perf: ult7('perf') / 6, topo: ult7('topo') / 6, az: ult7('az') / 6 };
  const porRealce = realcesEsc.map(a=>{
    const es = est.filter(e=>e.c.anelId === a.id), fs = furos.filter(f=> es.some(e=>e.c.id === f.checklistLequeId)), u = fs.filter(f=>!f.obstruido);
    const ult = fs.reduce((m, f)=>{ [f.perfiladoEm, f.topografadoEm, f.azimuteEm].forEach(x=>{ if(x){ const c = chaveDia(x); if(c > m) m = c; } }); return m; }, '');
    const semana = fs.reduce((s, f)=> s + [[f.perfilado, f.perfiladoEm], [f.topografado, f.topografadoEm], [furoTemAzimute(f), f.azimuteEm]].filter(([ok, dt])=> ok && dt && chaveDia(dt) >= iniISO && chaveDia(dt) <= fimISO).length, 0);
    const n = es.length, trat = es.filter(e=>e.tratado).length;
    return { a, n, trat, prontos: es.filter(e=>e.pronto).length, nU: u.length, perf: u.filter(f=>f.perfilado).length, topo: u.filter(f=>f.topografado).length, az: u.filter(f=>furoTemAzimute(f)).length,
      ult, semana, completo: n > 0 && trat === n,
      parado: n > 0 && trat < n ? (ult ? Math.floor((new Date(hojeISO) - new Date(ult)) / 86400000) : null) : 0 };
  }).filter(r=>r.n > 0);
  return { ini, fim, iniISO, fimISO, dias, cur, ant, metrosMes, tratMes, pipe, ritmo, porRealce, prontos: est.filter(e=>e.pronto).length,
    prontosSemAz: est.filter(e=>e.pronto && !e.az).length, semArquivos: porRealce.filter(r=>!r.completo && !r.a.arquivosOk).map(r=>r.a.nome), hojeISO };
}

const setaHome = v => v === null ? '<small class="home-var neutro">sem base na semana passada</small>' : v === 0 ? '<small class="home-var neutro">= semana passada</small>' : `<small class="home-var ${v > 0 ? 'sobe' : 'desce'}">${v > 0 ? '▲ +' : '▼ '}${v}% vs semana passada</small>`;
const fmtHM = n => (Math.round(Number(n) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 });

function renderHome(){
  const view = document.getElementById('view-home'); if(!view) return;
  const d = dadosHomeInicio(homeOffset), e2 = escHtml, p = d.pipe;
  const atual = homeOffset === 0;
  const kpi = (rot, v, a, cor, unid)=> `<div class="home-kpi" style="--c:${cor}"><span>${rot}</span><b>${unid === 'm' ? fmtHM(v) + '<small> m</small>' : v}</b>${setaHome(varHome(v, a))}</div>`;
  const maxDia = k => Math.max(1, ...d.dias.map(x=>x[k]));
  const celula = (x, k)=> `<td class="n" style="--p:${Math.round(x[k] / maxDia(k) * 100)}%">${x[k] || '·'}</td>`;
  const linhasDia = d.dias.map(x=> `<tr class="${x.folga ? 'folga' : ''} ${x.iso === d.hojeISO ? 'hoje' : ''}"><th>${x.nome}<small>${x.dd}</small></th>${x.folga && !x.perf && !x.topo && !x.az && !x.trat ? '<td colspan="4" class="folga-t">folga</td>' : celula(x,'perf') + celula(x,'topo') + celula(x,'az') + celula(x,'trat')}</tr>`).join('');
  // O que fazer agora
  const acoes = [];
  if(d.prontos) acoes.push({ t:'ok', icone:'✓', txt:`<b>${d.prontos}</b> ${d.prontos === 1 ? 'leque pronto' : 'leques prontos'} para tratar${d.prontosSemAz ? ` · <b>${d.prontosSemAz}</b> ainda sem azimute completo` : ''}`, ir:"mostrarView('perfilagem')", rot:'Tratar' });
  if(p.esperaTopo) acoes.push({ t:'av', icone:'⏳', txt:`<b>${p.esperaTopo}</b> furos perfilados esperando topografia`, ir:"mostrarView('checklist')", rot:'Checklist' });
  if(p.esperaAz) acoes.push({ t:'av', icone:'⏳', txt:`<b>${p.esperaAz}</b> furos topografados esperando azimute`, ir:"mostrarView('checklist')", rot:'Checklist' });
  if(d.semArquivos.length) acoes.push({ t:'av', icone:'📁', txt:`Arquivos ainda não recebidos: <b>${d.semArquivos.map(e2).join(', ')}</b>`, ir:"mostrarView('perfilagem')", rot:'Ver' });
  d.porRealce.filter(r=> !r.completo && r.parado !== null && r.parado >= 3).forEach(r=> acoes.push({ t:'ruim', icone:'⚠', txt:`<b>${e2(r.a.nome)}</b> sem movimento há ${r.parado} dias`, ir:`definirAnelAtivo('${r.a.id}'); mostrarView('checklist')`, rot:'Abrir' }));
  if(p.obst) acoes.push({ t:'info', icone:'⛔', txt:`<b>${p.obst}</b> ${p.obst === 1 ? 'furo obstruído' : 'furos obstruídos'} (não contam nas etapas)`, ir:'', rot:'' });
  const prev = (k, rot, rest)=>{ const r = d.ritmo[k]; return rest > 0 && r > 0 ? `<li>${rot}: ritmo de <b>${fmtHM(r)}</b> furos/dia nos últimos 7 dias → faltam <b>${rest}</b> furos, cerca de <b>${Math.ceil(rest / r)}</b> ${Math.ceil(rest / r) === 1 ? 'dia' : 'dias'} de trabalho.</li>` : rest > 0 ? `<li>${rot}: <b>${rest}</b> furos faltando, sem marcações nos últimos 7 dias.</li>` : ''; };
  const previsao = [prev('perf', 'Perfilagem', p.semPerf), prev('topo', 'Topografia', p.total - p.topoFeito), prev('az', 'Azimute', p.total - p.azFeito)].join('');
  const pct = (v, n)=> n ? Math.round(v / n * 100) : 0;
  const seg = (v, cor, rot)=> p.total ? `<i style="width:${v / p.total * 100}%;background:${cor}" title="${rot}: ${v}"></i>` : '';
  const tabelaRealces = d.porRealce.map(r=>`<tr onclick="definirAnelAtivo('${r.a.id}'); mostrarView('perfilagem')" tabindex="0" onkeydown="if(event.key==='Enter'){ this.click(); }">
      <th>${e2(r.a.nome)}<small>${e2(r.a.nivel || '')}</small></th><td class="n">${pct(r.perf, r.nU)}%</td><td class="n">${pct(r.topo, r.nU)}%</td><td class="n">${pct(r.az, r.nU)}%</td>
      <td class="n"><b>${r.trat}</b>/${r.n}${r.prontos ? `<small class="home-pronto"> +${r.prontos} prontos</small>` : ''}</td><td class="n">${r.semana || '·'}</td><td class="n">${r.completo ? '—' : r.a.arquivosOk ? '✓' : '<span class="home-sem-arq">não</span>'}</td></tr>`).join('');
  view.innerHTML = `<div class="home-topo">
      <div><h2>Início</h2><span class="home-sub">Semana de ${ddmmHome(d.ini)} a ${ddmmHome(d.fim)}${atual ? ' · semana atual' : ''}${configApp.projetoAtivo ? ' · ' + e2(configApp.projetoAtivo) : ''}</span></div>
      <div class="home-nav"><button type="button" class="ghost" onclick="homeSemana(-1)" aria-label="Semana anterior">‹</button>
        <button type="button" class="ghost" onclick="homeSemana(0)" ${atual ? 'disabled' : ''}>Esta semana</button>
        <button type="button" class="ghost" onclick="homeSemana(1)" ${atual ? 'disabled' : ''} aria-label="Próxima semana">›</button>
        <button type="button" class="steel" onclick="abrirResumoSemanal(${homeOffset})" title="resumo da semana em imagem ou mensagem de WhatsApp">Fechamento semanal</button></div></div>
    <div class="home-kpis">${kpi('Furos perfilados', d.cur.perf, d.ant.perf, '#1f8a4c')}${kpi('Furos topografados', d.cur.topo, d.ant.topo, '#1f63b0')}${kpi('Furos azimutados', d.cur.az, d.ant.az, '#8a5cc2')}${kpi('Leques tratados', d.cur.trat, d.ant.trat, '#0f7d78')}${kpi('Metros tratados', d.cur.metros, d.ant.metros, '#e8441a', 'm')}
      <div class="home-kpi" style="--c:#7a7f8c"><span>Metros tratados no mês</span><b>${fmtHM(d.metrosMes)}<small> m</small></b><small class="home-var neutro">${d.tratMes} ${d.tratMes === 1 ? 'leque' : 'leques'} no mês</small></div></div>
    <div class="home-grade">
      <section class="home-card"><h3>Dia a dia</h3><div class="home-tab-rolagem"><table class="home-dias"><thead><tr><th></th><th class="n" title="Furos perfilados">Perf.</th><th class="n" title="Furos topografados">Topo</th><th class="n" title="Furos azimutados">Azim.</th><th class="n" title="Leques tratados">Trat.</th></tr></thead><tbody>${linhasDia}</tbody></table></div></section>
      <section class="home-card"><h3>O que fazer agora</h3>${acoes.length ? `<ul class="home-acoes">${acoes.map(a=>`<li class="${a.t}"><span class="ic">${a.icone}</span><span class="tx">${a.txt}</span>${a.ir ? `<button type="button" class="ghost" onclick="${a.ir}">${a.rot}</button>` : ''}</li>`).join('')}</ul>` : '<div class="trat-vazio">Nada pendente agora. 👏</div>'}
        ${previsao ? `<h4>Ritmo e previsão</h4><ul class="home-prev">${previsao}</ul>` : ''}</section></div>
    <section class="home-card"><h3>Fila entre as etapas <small>furos úteis (sem obstruídos)</small></h3>
      <div class="home-pipe" role="img" aria-label="Distribuição dos furos entre as etapas">${seg(p.azFeito, '#8a5cc2', 'azimutados')}${seg(p.esperaAz, '#1f63b0', 'esperando azimute')}${seg(p.esperaTopo, '#1f8a4c', 'esperando topografia')}${seg(p.semPerf, '#d6d9e2', 'sem perfilagem')}</div>
      <div class="home-pipe-leg"><span><i style="background:#8a5cc2"></i>Azimutados <b>${p.azFeito}</b></span><span><i style="background:#1f63b0"></i>Esperando azimute <b>${p.esperaAz}</b></span><span><i style="background:#1f8a4c"></i>Perfilados esperando topografia <b>${p.esperaTopo}</b></span><span><i style="background:#d6d9e2"></i>Ainda sem perfilagem <b>${p.semPerf}</b></span></div></section>
    <section class="home-card"><h3>Realces</h3>${tabelaRealces ? `<div class="home-tab-rolagem"><table class="home-realces"><thead><tr><th>Realce</th><th class="n">Perf.</th><th class="n">Topo</th><th class="n">Azim.</th><th class="n">Tratados</th><th class="n">Semana</th><th class="n">Arquivos</th></tr></thead><tbody>${tabelaRealces}</tbody></table></div>` : '<div class="trat-vazio">Nenhum realce com leques ainda.</div>'}</section>`;
}
function homeSemana(n){ homeOffset = n === 0 ? 0 : Math.min(0, homeOffset + n); renderHome(); }
aoRenderizarTudo(renderHome);
aoRenderizarChecklist(renderHome);
(function(){ const orig = window.mostrarView; if(typeof orig !== 'function') return; window.mostrarView = function(v){ const r = orig.apply(this, arguments); if(v === 'home'){ try{ renderHome(); }catch(e){ console.error(e); } } return r; }; })();
