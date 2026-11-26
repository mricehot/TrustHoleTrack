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
  const ymAtual = iniISO.slice(0,7); let metrosMes = 0, tratMes = 0; const tratadosSemana = [];
  rel.forEach(r=> r.leques.forEach(l=>{ if(l.status !== 'Tratado' || !l.tratadoEm) return; const iso = chaveDia(l.tratadoEm), m = metrosDoLeque(l);
    if(iso >= iniISO && iso <= fimISO) tratadosSemana.push({ realce: r.realce.nome, codigo: l.codigo, metros: m, iso });
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
  tratadosSemana.sort((x,y)=> x.iso.localeCompare(y.iso) || x.realce.localeCompare(y.realce) || x.codigo.localeCompare(y.codigo, undefined, { numeric:true }));
  return { ini, fim, iniISO, fimISO, dias, cur, ant, tratadosSemana, metrosMes, tratMes, pipe, ritmo, porRealce, prontos: est.filter(e=>e.pronto).length,
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
        <button type="button" class="steel" onclick="exportarFechamentoSemanalPDF(${homeOffset})" title="PDF do fechamento desta semana">⬇ Fechamento semanal (PDF)</button>
        <button type="button" class="ghost" onclick="abrirResumoSemanal(${homeOffset})" title="resumo da semana em imagem ou mensagem de WhatsApp">Imagem / WhatsApp</button></div></div>
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

// PDF do fechamento da semana: números, dia a dia, realces, leques tratados e pendências.
async function exportarFechamentoSemanalPDF(offset){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const d = dadosHomeInicio(offset === undefined ? homeOffset : offset), p = d.pipe;
  const doc = new window.jspdf.jsPDF();
  let y = await desenharCabecalhoTurnoPDF(doc, { titulo:'FECHAMENTO SEMANAL' });
  const novaPagina = ()=>{ doc.addPage(); y = 20; };
  const garantir = h=>{ if(y + h > 282) novaPagina(); };
  const titulo = t=>{ garantir(14); doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(0); doc.text(t, 15, y); doc.setDrawColor(200); doc.line(15, y + 1.8, 195, y + 1.8); y += 8; };
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.text(`Semana de ${ddmmHome(d.ini)} a ${ddmmHome(d.fim)}/${d.fim.getFullYear()}`, 15, y); y += 9;
  // 1) números
  const sv = (a, b)=>{ const v = varHome(a, b); return v === null ? 'sem base' : v === 0 ? '= sem. passada' : (v > 0 ? '+' : '') + v + '%'; };
  const cards = [['Perfilados', d.cur.perf, d.ant.perf, [31,138,76]], ['Topografados', d.cur.topo, d.ant.topo, [31,99,176]], ['Azimutados', d.cur.az, d.ant.az, [138,92,194]], ['Leques tratados', d.cur.trat, d.ant.trat, [15,125,120]], ['Metros tratados', d.cur.metros, d.ant.metros, [232,68,26]]];
  const w = 34, gap = 2.5;
  cards.forEach(([rot, v, a, cor], i)=>{ const x = 15 + i * (w + gap);
    doc.setDrawColor(215); doc.setFillColor(250,250,252); doc.roundedRect(x, y, w, 21, 2, 2, 'FD'); doc.setFillColor(...cor); doc.rect(x, y, w, 1.6, 'F');
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(110); doc.text(rot.toUpperCase(), x + 3, y + 6.5);
    doc.setFontSize(15); doc.setTextColor(...cor); doc.text(rot === 'Metros tratados' ? fmtHM(v) : String(v), x + 3, y + 14);
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(100); doc.text(sv(v, a) + (v || a ? '' : ''), x + 3, y + 18.5); });
  doc.setTextColor(0); y += 26;
  doc.setFontSize(9); doc.setTextColor(90); doc.text(`Metros tratados no mês: ${fmtHM(d.metrosMes)} m  ·  ${d.tratMes} ${d.tratMes === 1 ? 'leque' : 'leques'}`, 15, y); doc.setTextColor(0); y += 8;
  // 2) dia a dia
  titulo('Dia a dia');
  const col = [15, 62, 100, 138, 176];
  doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(9.5); doc.setFont(undefined,'bold');
  doc.text('Dia', 17, y); ['Perf.','Topo','Azim.','Trat.'].forEach((t, i)=> doc.text(t, col[i + 1] + 18, y, { align:'right' })); y += 6;
  d.dias.forEach((x, i)=>{ if(i % 2){ doc.setFillColor(248,248,251); doc.rect(15, y - 4, 180, 5.4, 'F'); }
    doc.setFont(undefined, x.iso === d.hojeISO ? 'bold' : 'normal'); doc.setTextColor(0); doc.text(`${x.nome} ${x.dd}`, 17, y);
    if(x.folga && !x.perf && !x.topo && !x.az && !x.trat){ doc.setTextColor(130); doc.text('folga', col[1] + 18, y, { align:'right' }); }
    else [x.perf, x.topo, x.az, x.trat].forEach((v, k)=> doc.text(String(v), col[k + 1] + 18, y, { align:'right' }));
    doc.setTextColor(0); y += 5.4; });
  doc.setFont(undefined,'bold'); doc.setDrawColor(150); doc.line(15, y - 3.6, 195, y - 3.6); doc.text('Total', 17, y);
  [d.cur.perf, d.cur.topo, d.cur.az, d.cur.trat].forEach((v, k)=> doc.text(String(v), col[k + 1] + 18, y, { align:'right' })); y += 10;
  // 3) realces
  titulo('Realces');
  doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(9); doc.setFont(undefined,'bold');
  doc.text('Realce', 17, y); doc.text('Perf.', 96, y, { align:'right' }); doc.text('Topo', 114, y, { align:'right' }); doc.text('Azim.', 132, y, { align:'right' }); doc.text('Tratados', 160, y, { align:'right' }); doc.text('Semana', 177, y, { align:'right' }); doc.text('Arq.', 192, y, { align:'right' }); y += 6;
  const pc = (v, n)=> n ? Math.round(v / n * 100) : 0;
  d.porRealce.forEach(r=>{ garantir(8); doc.setFont(undefined,'bold'); doc.setFontSize(9.5); doc.setTextColor(0); doc.text(String(r.a.nome), 17, y);
    doc.setFont(undefined,'normal'); doc.text(pc(r.perf, r.nU) + '%', 96, y, { align:'right' }); doc.text(pc(r.topo, r.nU) + '%', 114, y, { align:'right' }); doc.text(pc(r.az, r.nU) + '%', 132, y, { align:'right' });
    doc.text(`${r.trat}/${r.n}${r.prontos ? ' (+' + r.prontos + ' prontos)' : ''}`, 160, y, { align:'right' }); doc.text(String(r.semana), 177, y, { align:'right' });
    doc.setTextColor(...(r.completo || r.a.arquivosOk ? [31,138,76] : [178,53,17])); doc.text(r.completo ? '—' : r.a.arquivosOk ? 'sim' : 'não', 192, y, { align:'right' }); doc.setTextColor(0);
    doc.setFillColor(232,232,238); doc.rect(17, y + 1.2, 78, 1.6, 'F'); doc.setFillColor(15,125,120); doc.rect(17, y + 1.2, 78 * (r.n ? r.trat / r.n : 0), 1.6, 'F'); y += 7.2; });
  y += 4;
  // 4) tratados na semana
  titulo(`Leques tratados na semana (${d.tratadosSemana.length})`);
  if(!d.tratadosSemana.length){ doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(110); doc.text('Nenhum leque tratado nesta semana.', 17, y); doc.setTextColor(0); y += 8; }
  else {
    doc.setFillColor(235,235,242); doc.rect(15, y - 4.5, 180, 6.5, 'F'); doc.setFontSize(9.5); doc.setFont(undefined,'bold'); doc.text('Data', 17, y); doc.text('Realce', 40, y); doc.text('Leque', 120, y); doc.text('Metros', 190, y, { align:'right' }); y += 6; doc.setFont(undefined,'normal');
    d.tratadosSemana.forEach(t=>{ garantir(6); doc.text(t.iso.slice(8,10) + '/' + t.iso.slice(5,7), 17, y); doc.text(String(t.realce), 40, y); doc.text(String(t.codigo), 120, y); doc.text(fmtHM(t.metros), 190, y, { align:'right' }); y += 5.2; });
    doc.setFont(undefined,'bold'); doc.setDrawColor(150); doc.line(15, y - 3.6, 195, y - 3.6); doc.text(`Total (${d.tratadosSemana.length})`, 17, y); doc.text(fmtHM(d.cur.metros), 190, y, { align:'right' }); y += 10;
  }
  // 5) pendências
  titulo('Pendências para a próxima semana');
  const itens = [];
  if(d.prontos) itens.push(`${d.prontos} ${d.prontos === 1 ? 'leque pronto' : 'leques prontos'} para tratar${d.prontosSemAz ? ` (${d.prontosSemAz} ainda sem azimute completo)` : ''}`);
  if(p.esperaTopo) itens.push(`${p.esperaTopo} furos perfilados esperando topografia`);
  if(p.esperaAz) itens.push(`${p.esperaAz} furos topografados esperando azimute`);
  if(p.semPerf) itens.push(`${p.semPerf} furos ainda sem perfilagem`);
  if(d.semArquivos.length) itens.push('Arquivos do realce não recebidos: ' + d.semArquivos.join(', '));
  d.porRealce.filter(r=> !r.completo && r.parado !== null && r.parado >= 3).forEach(r=> itens.push(`${r.a.nome} sem movimento há ${r.parado} dias`));
  if(p.obst) itens.push(`${p.obst} ${p.obst === 1 ? 'furo obstruído' : 'furos obstruídos'}`);
  doc.setFontSize(10); doc.setFont(undefined,'normal');
  if(!itens.length) { doc.text('Nada pendente.', 17, y); y += 6; }
  itens.forEach(t=>{ const ls = doc.splitTextToSize(t, 172); garantir(ls.length * 5 + 2); doc.setFillColor(15,125,120); doc.circle(18, y - 1.2, 0.9, 'F'); doc.text(ls, 22, y); y += ls.length * 5 + 1.5; });
  adicionarMarcaDaguaPDF(doc); adicionarNumeracaoPaginas(doc);
  await baixarOuCompartilharPDF(doc, `fechamento_semanal_${d.iniISO}.pdf`, true);
  showToast('Fechamento semanal em PDF gerado.', { tipo:'ok' });
}
