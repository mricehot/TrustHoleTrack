// ---------- Relatório mensal ----------
// Fecha o mês (ou o mês em andamento) com tudo de produtividade: totais, comparação com o mês anterior, dia a dia,
// semana a semana, cada equipe (meta, melhor dia) e os realces. Sai como IMAGEM e como MENSAGEM de WhatsApp.
// Usa a mesma base do resumo semanal: metros = lançamentos manuais; pontos = marcações de topografia do checklist.
let relMesOffset = 0;

function calcularRelatorioMensal(offset){
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
  const corte = ultimo > hoje ? hoje : ultimo;
  const iniISO = dataISOLocal(primeiro), fimISO = dataISOLocal(ultimo), corteISO = dataISOLocal(corte);
  const antPrim = new Date(primeiro.getFullYear(), primeiro.getMonth() - 1, 1);
  const antUlt = new Date(primeiro.getFullYear(), primeiro.getMonth(), 0);
  const antCorte = new Date(antPrim.getFullYear(), antPrim.getMonth(), Math.min(corte.getDate(), antUlt.getDate()));
  const antIni = dataISOLocal(antPrim), antFim = dataISOLocal(antCorte);

  const lista = equipesDoProjeto();
  const ids = new Set(lista.map(e => e.id));
  const efet = lancamentosEfetivos().filter(l => ids.has(l.equipeId));

  const dias = [];
  let diasUteis = 0, passados = 0;
  for(let d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)){
    const futuro = d > hoje, folga = d.getDay() === 0;
    dias.push({ data: new Date(d), iso: dataISOLocal(d), num: d.getDate(), nome: DIAS_CURTOS[d.getDay()], folga, futuro, metros: 0, pontos: 0, furosPerf: 0, furosTopo: 0 });
    if(!folga){ diasUteis++; if(d <= corte) passados++; }
  }
  const restantes = Math.max(0, diasUteis - passados);
  const diaDe = iso => dias.find(x => x.iso === iso);

  const equipesR = lista.map(e => {
    let metros = 0, pontos = 0, antM = 0, antP = 0; const porDia = {};
    efet.forEach(l => {
      if(l.equipeId !== e.id) return;
      if(l.data >= iniISO && l.data <= corteISO){
        metros += l.metros; pontos += l.pontos;
        const d = diaDe(l.data); if(d){ d.metros += l.metros; d.pontos += l.pontos; }
        porDia[l.data] = porDia[l.data] || { metros: 0, pontos: 0 }; porDia[l.data].metros += l.metros; porDia[l.data].pontos += l.pontos;
      }else if(l.data >= antIni && l.data <= antFim){ antM += l.metros; antP += l.pontos; }
    });
    const diasTrab = Object.keys(porDia).filter(k => porDia[k].metros > 0 || porDia[k].pontos > 0);
    let melhor = null; diasTrab.forEach(k => { if(!melhor || porDia[k].metros > melhor.metros) melhor = { iso: k, metros: porDia[k].metros }; });
    metros = arred2(metros); antM = arred2(antM);
    const meta = e.metaMensal > 0 ? e.metaMensal : (e.metaSemanal > 0 ? arred2(e.metaSemanal * diasUteis / 6) : 0);
    return { id: e.id, cor: COR_EQUIPES_RS[Math.max(0, lista.findIndex(x => x.id === e.id)) % 6], nome: e.nome, integrantes: e.integrantes, metros, pontos: Math.round(pontos), antM, antP: Math.round(antP),
      diasTrab: diasTrab.length, media: diasTrab.length ? arred2(metros / diasTrab.length) : 0, melhor, meta, pct: meta ? Math.round(metros / meta * 100) : null,
      varM: varRS(metros, antM), varP: varRS(Math.round(pontos), Math.round(antP)) };
  }).sort((a, b) => b.metros - a.metros || b.pontos - a.pontos);

  // Furos marcados no checklist dentro do mês (mesma base do infográfico).
  let furosPerf = 0, furosTopo = 0;
  checklistFurosNoEscopoAtual().forEach(f => {
    if(f.perfilado && f.perfiladoEm){ const c = chaveDia(f.perfiladoEm); if(c >= iniISO && c <= corteISO){ furosPerf++; const d = diaDe(c); if(d) d.furosPerf++; } }
    if(f.topografado && f.topografadoEm){ const c = chaveDia(f.topografadoEm); if(c >= iniISO && c <= corteISO){ furosTopo++; const d = diaDe(c); if(d) d.furosTopo++; } }
  });

  // Semana a semana (segunda a domingo, recortadas pelo mês).
  const semanas = [];
  for(let ini = inicioDaSemana(primeiro); ini <= ultimo; ini.setDate(ini.getDate() + 7)){
    const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
    const doMes = dias.filter(d => d.data >= ini && d.data <= fim);
    if(!doMes.length) continue;
    const a = doMes[0].data, b = doMes[doMes.length - 1].data;
    semanas.push({ rotulo: ddmmRS(a) + (doMes.length > 1 ? '–' + ddmmRS(b) : ''), metros: arred2(doMes.reduce((t, d) => t + d.metros, 0)), topo: doMes.reduce((t, d) => t + d.furosTopo, 0),
      atual: hoje >= a && hoje <= b, futura: a > hoje });
  }

  const acum = arred2(equipesR.reduce((t, e) => t + e.metros, 0));
  const pontos = equipesR.reduce((t, e) => t + e.pontos, 0);
  const antAcum = arred2(equipesR.reduce((t, e) => t + e.antM, 0)), antPontos = equipesR.reduce((t, e) => t + e.antP, 0);
  const meta = arred2(equipesR.reduce((t, e) => t + e.meta, 0));
  const diasTrab = dias.filter(d => d.metros > 0 || d.pontos > 0).length;
  let melhorDia = null; dias.forEach(d => { if(d.metros > 0 && (!melhorDia || d.metros > melhorDia.metros)) melhorDia = d; });
  const ritmo = passados ? acum / passados : 0;
  const proj = restantes ? acum + ritmo * restantes : acum;
  return { offset, primeiro, ultimo, corte, iniISO, fimISO, nome: primeiro.toLocaleDateString('pt-BR', { month: 'long' }), ano: primeiro.getFullYear(),
    emAndamento: ultimo > hoje, dias, diasUteis, passados, restantes, equipes: equipesR, semanas, acum, pontos, antAcum, antPontos, meta, diasTrab,
    media: diasTrab ? arred2(acum / diasTrab) : 0, melhorDia, ritmo, proj, furosPerf, furosTopo,
    pctMeta: meta ? Math.round(acum / meta * 100) : null, pctProj: meta ? Math.round(proj / meta * 100) : null,
    faltaProj: meta ? Math.max(0, arred2(meta - proj)) : null, necessario: meta && restantes ? Math.max(0, (meta - acum) / restantes) : null,
    varM: varRS(acum, antAcum), varP: varRS(pontos, antPontos),
    realces: calcularRealcesSemana(iniISO, fimISO), projeto: configApp.projetoAtivo || '' };
}

const nomeMesRM = r => r.nome.charAt(0).toUpperCase() + r.nome.slice(1) + ' de ' + r.ano;

function montarRelatorioMensalWhatsApp(offset){
  const r = calcularRelatorioMensal(offset);
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const setaMes = v => v === null ? '(sem base no mes anterior)' : v === 0 ? '(= mes anterior)' : (v > 0 ? '▲ +' : '▼ ') + v + '% vs mes anterior';
  const quem = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  let o = `📊 *RELATORIO MENSAL*\n${semAcentoRS(nomeMesRM(r))}${r.emAndamento ? ' (ate ' + ddmmRS(r.corte) + ')' : ''}${r.projeto ? ' - Projeto ' + semAcentoRS(r.projeto) : ''}\n`;
  if(!r.equipes.length) return o + '\nNenhuma equipe cadastrada neste projeto.';
  o += `\n*TOTAL DO MES*\nPerfilagem: *${numRS(r.acum)} m* ${setaMes(r.varM)}`;
  if(r.pctMeta !== null) o += `\nMeta mensal: ${r.pctMeta}% (${numRS(r.acum)} de ${numRS(r.meta)} m)`;
  o += `\nTopografia: *${plural(r.pontos, 'ponto', 'pontos')}* ${setaMes(r.varP)}`;
  o += `\nChecklist no mes: ${plural(r.furosPerf, 'furo perfilado', 'furos perfilados')} | ${plural(r.furosTopo, 'furo topografado', 'furos topografados')}`;
  o += `\nDias de producao: ${r.diasTrab}${r.diasTrab ? ' | media ' + numRS(r.media) + ' m/dia trabalhado' : ''}`;
  if(r.melhorDia) o += `\nMelhor dia: ${semAcentoRS(r.melhorDia.nome)} ${ddmmRS(r.melhorDia.data)} - ${numRS(r.melhorDia.metros)} m`;
  if(r.emAndamento){
    o += `\nRitmo: ${numRS(r.ritmo)} m/dia util (${r.passados} de ${r.diasUteis} dias uteis)`;
    o += `\nProjecao de fechamento: *${numRS(r.proj)} m*${r.meta ? ' (' + r.pctProj + '% da meta)' + (r.faltaProj ? ' - faltam ' + numRS(r.faltaProj) + ' m' : ' - meta batida no ritmo atual') : ' (no ritmo atual, sem meta cadastrada)'}`;
    if(r.meta && r.restantes && r.necessario !== null) o += `\nPara bater a meta: ${numRS(r.necessario)} m/dia nos ${r.restantes} dias uteis restantes`;
  }
  o += '\n\n*SEMANA A SEMANA*\n' + r.semanas.filter(w => !w.futura).map(w => `${w.rotulo}: ${numRS(w.metros)} m | ${plural(w.topo, 'furo topografado', 'furos topografados')}${w.atual && r.emAndamento ? ' (em andamento)' : ''}`).join('\n');
  o += '\n\n*EQUIPES* (por metros)\n' + r.equipes.map((e, i) => {
    let t = `${i + 1}. *${semAcentoRS(e.nome)}*${e.integrantes ? ' (' + semAcentoRS(e.integrantes) + ')' : ''}\n`;
    if(!e.diasTrab) return t + '   sem lancamento no mes';
    t += `   ${numRS(e.metros)} m${e.pct !== null ? ' (' + e.pct + '% da meta de ' + numRS(e.meta) + ' m)' : ''} | ${plural(e.pontos, 'ponto', 'pontos')}`;
    t += `\n   ${plural(e.diasTrab, 'dia', 'dias')} | media ${numRS(e.media)} m/dia`;
    if(e.melhor){ const dm = new Date(e.melhor.iso + 'T12:00:00'); t += ` | melhor: ${semAcentoRS(DIAS_CURTOS[dm.getDay()])} ${ddmmRS(dm)} (${numRS(e.melhor.metros)} m)`; }
    return t;
  }).join('\n\n');
  if(r.realces.length){
    o += '\n\n*REALCES E LEQUES*\n' + r.realces.map(x => {
      const pct = n => x.furos ? Math.round(n / x.furos * 100) : 0;
      let t = `*${semAcentoRS(x.nome)}*\n   Leques: ${x.leques.ok} completos de ${x.leques.total}` + (x.leques.and + x.leques.obs ? ` | ${x.leques.and + x.leques.obs} em andamento` : '') + (x.leques.ini ? ` | ${x.leques.ini} nao iniciados` : '');
      t += `\n   Furos: perfilados ${x.perf}/${x.furos} (${pct(x.perf)}%) | topografados ${x.topo}/${x.furos} (${pct(x.topo)}%)`;
      t += `\n   No mes: +${x.perfSem} perfilados | +${x.topoSem} topografados`;
      if(x.finalizados.length) t += `\n   Finalizados no mes: ${compactarCodigosEmIntervalos(x.finalizados).join(', ')}`;
      return t;
    }).join('\n\n');
  }
  if(quem) o += `\n\n_Relatorio gerado por ${semAcentoRS(quem)}_`;
  return o;
}

function cartaoRelatorioMensalHTML(r){
  const e2 = escHtml, cor = { amb: '#ff431d', aco: '#2f6690', ver: '#2e9b57', txt: '#191231', mut: '#6b6b80', lin: '#e3e1ea', fundo: '#f6f5f9' };
  const quem = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  const agora = new Date();
  const seta = v => v === null ? `<span style="color:${cor.mut}">sem base</span>` : v === 0 ? `<span style="color:${cor.mut}">= igual</span>` : `<span style="color:${v > 0 ? cor.ver : '#d6453d'}">${v > 0 ? '▲ +' : '▼ '}${v}%</span>`;
  const kpi = (rot, val, sub, c, fundo) => `<div style="flex:1;min-width:0;background:${fundo || cor.fundo};border:1px solid ${cor.lin};border-radius:10px;padding:12px 14px;">
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${c || cor.mut};font-weight:700;">${rot}</div>
      <div style="font:700 26px 'JetBrains Mono',ui-monospace,monospace;margin-top:4px;color:${c || cor.txt};">${val}</div>
      <div style="font-size:12px;margin-top:3px;color:${c || cor.mut};">${sub}</div></div>`;
  const un = t => `<span style="font-size:14px;color:${cor.mut}"> ${t}</span>`;
  const diasGraf = r.dias.filter(d => !d.futuro);
  const corProj = r.pctProj === null ? cor.txt : r.pctProj >= 100 ? cor.ver : r.pctProj >= 80 ? '#a56a00' : '#d6453d';
  const fundoProj = r.pctProj === null ? cor.fundo : r.pctProj >= 100 ? '#eef8f1' : r.pctProj >= 80 ? '#fff7ec' : '#fdeeed';
  const base = Math.max(1, r.meta || 0, r.proj), pa = Math.min(100, r.acum / base * 100), pp = Math.max(0, Math.min(100, r.proj / base * 100) - pa);

  const barraProj = r.emAndamento || r.meta ? `<div style="margin-top:14px;position:relative;"><div style="height:16px;background:#ece9f2;border-radius:8px;position:relative;overflow:hidden;"><div style="position:absolute;left:0;top:0;height:100%;width:${pa}%;background:${cor.amb};"></div>${r.emAndamento ? `<div style="position:absolute;left:${pa}%;top:0;height:100%;width:${pp}%;overflow:hidden;">${hachuraSvgRS(0, 16, 'display:block;width:100%;height:100%;')}</div>` : ''}</div>
      ${r.meta ? `<div style="position:absolute;left:${(r.meta / base * 100).toFixed(1)}%;top:-4px;height:24px;margin-left:-3px;border-right:3px solid ${cor.txt};"></div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:${cor.mut};margin-top:6px;"><span><b style="color:${cor.amb}">■</b> realizado ${numRS(r.acum)} m</span>${r.emAndamento ? `<span>projeção até ${ddmmRS(r.ultimo)} (+${numRS(Math.max(0, r.proj - r.acum))} m no ritmo atual)</span>` : ''}<span>${r.meta ? '<b style="color:' + cor.txt + '">|</b> meta ' + numRS(r.meta) + ' m' : ''}</span></div></div>` : '';

  // semana a semana (barras)
  const semVis = r.semanas.filter(w => !w.futura);
  const maxS = Math.max(1, ...semVis.map(w => w.metros));
  const barrasS = semVis.map(w => `<div style="flex:1;text-align:center;"><div style="font:700 11px monospace;">${numRS(w.metros)}</div><div style="height:${Math.max(2, Math.round(w.metros / maxS * 96))}px;background:${w.atual && r.emAndamento ? cor.amb : '#ffb4a2'};border-radius:6px 6px 2px 2px;"></div></div>`).join('');
  const rotS = semVis.map(w => `<span style="flex:1;font-size:10.5px;${w.atual && r.emAndamento ? 'color:' + cor.txt + ';font-weight:700;' : ''}">${w.rotulo}</span>`).join('');

  const cardsEq = r.equipes.map((e, i) => {
    const largura = e.pct === null ? 0 : Math.min(100, e.pct);
    const melhor = e.melhor ? `${DIAS_CURTOS[new Date(e.melhor.iso + 'T12:00:00').getDay()]} ${ddmmRS(new Date(e.melhor.iso + 'T12:00:00'))} (${numRS(e.melhor.metros)} m)` : '–';
    return `<div style="border:1px solid ${cor.lin};border-left:6px solid ${e.pct !== null && e.pct >= 100 ? cor.ver : cor.amb};border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
        <div style="font-weight:700;font-size:14.5px;color:${cor.txt};">${i + 1}º · <i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${e.cor};margin-right:6px;"></i>${e2(e.nome)}</div>
        <div style="font:700 17px 'JetBrains Mono',monospace;color:${cor.txt};white-space:nowrap;">${numRS(e.metros)} m</div></div>
      ${e.pct !== null ? `<div style="display:flex;align-items:center;gap:8px;margin-top:7px;"><div style="flex:1;height:7px;background:#ece9f2;border-radius:6px;overflow:hidden;"><div style="width:${largura}%;height:100%;background:${e.pct >= 100 ? cor.ver : cor.amb};"></div></div><span style="font:700 11.5px 'JetBrains Mono',monospace;color:${cor.txt};">${e.pct}% de ${numRS(e.meta)} m</span></div>` : ''}
      ${e.diasTrab ? `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:7px;font-size:12px;color:${cor.mut};">
        <span><b style="color:${cor.aco}">${e.pontos}</b> ${e.pontos === 1 ? 'ponto' : 'pontos'}</span>
        <span><b style="color:${cor.txt}">${e.diasTrab}</b> ${e.diasTrab === 1 ? 'dia' : 'dias'}</span>
        <span>média <b style="color:${cor.txt}">${numRS(e.media)}</b> m/dia</span>
        <span>melhor <b style="color:${cor.txt}">${melhor}</b></span>
        <span>vs mês anterior: metros ${seta(e.varM)} · pontos ${seta(e.varP)}</span></div>` : `<div style="margin-top:7px;font-size:12px;color:${cor.mut};">sem lançamento no mês</div>`}</div>`;
  }).join('');

  return `<div style="width:860px;box-sizing:border-box;background:#fff;color:${cor.txt};font-family:'Inter',system-ui,sans-serif;padding:26px 28px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${cor.amb};padding-bottom:12px;">
      <div><div style="font-size:12px;letter-spacing:2px;font-weight:700;color:${cor.amb};">RELATÓRIO MENSAL</div>
        <div style="font-size:24px;font-weight:800;margin-top:2px;">${e2(nomeMesRM(r))}</div></div>
      <div style="text-align:right;font-size:13px;color:${cor.mut};">${r.projeto ? 'Projeto ' + e2(r.projeto) : 'Todos os projetos'}<br>${r.emAndamento ? 'em andamento · até ' + ddmmRS(r.corte) : 'mês fechado'}</div></div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      ${kpi('Metros perfilados', numRS(r.acum) + un('m'), seta(r.varM) + ' vs mês anterior' + (r.pctMeta !== null ? ' · ' + r.pctMeta + '% da meta' : ''))}
      ${kpi('Pontos topografados', r.pontos, seta(r.varP) + ' vs mês anterior')}
      ${kpi('Furos no checklist', r.furosPerf + ' / ' + r.furosTopo, 'perfilados / topografados')}
      ${kpi('Dias de produção', r.diasTrab, r.diasTrab ? 'média ' + numRS(r.media) + ' m/dia' : 'sem produção')}</div>
    ${r.melhorDia ? `<div style="margin-top:10px;font-size:13px;color:${cor.mut};">Melhor dia do mês: <b style="color:${cor.txt}">${r.melhorDia.nome} ${ddmmRS(r.melhorDia.data)}</b> com <b style="color:${cor.txt}">${numRS(r.melhorDia.metros)} m</b></div>` : ''}
    ${r.emAndamento ? `<div style="display:flex;gap:10px;margin-top:14px;">
      ${kpi('Ritmo atual', numRS(r.ritmo) + un('m/dia'), r.passados + ' de ' + r.diasUteis + ' dias úteis')}
      ${r.meta ? kpi('Projeção de fechamento', numRS(r.proj) + un('m'), r.pctProj + '% da meta · ' + (r.faltaProj ? 'faltam ' + numRS(r.faltaProj) + ' m' : 'meta batida'), corProj, fundoProj) : kpi('Projeção de fechamento', numRS(r.proj) + un('m'), 'no ritmo atual · sem meta cadastrada')}
      ${r.meta && r.restantes ? kpi('Necessário p/ meta', numRS(r.necessario) + un('m/dia'), 'nos ' + r.restantes + ' dias úteis que restam') : ''}</div>` : ''}
    ${barraProj}
    <div style="font-weight:700;font-size:14px;margin:20px 0 8px;">Perfilagem e topografia por dia <span style="font-weight:500;color:${cor.mut};font-size:12px;">· ${ddmmRS(r.primeiro)} a ${ddmmRS(r.emAndamento ? r.corte : r.ultimo)}</span></div>
    <div style="display:flex;gap:12px;">
      <div style="flex:1;min-width:0;border:1px solid ${cor.lin};border-radius:10px;padding:10px 12px 6px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:13px;color:${cor.amb};">Perfilagem · metros</b><span style="font-size:12px;color:${cor.mut};"><b style="color:${cor.txt}">${numRS(r.acum)} m</b> no mês</span></div>
        ${graficoDiasSemanaRS(diasGraf, d => d.metros, () => '', cor.amb, numRS, { rotulo: d => d.num })}</div>
      <div style="flex:1;min-width:0;border:1px solid ${cor.lin};border-radius:10px;padding:10px 12px 6px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:13px;color:${cor.aco};">Topografia · furos</b><span style="font-size:12px;color:${cor.mut};"><b style="color:${cor.txt}">${r.furosTopo} furos</b> no mês</span></div>
        ${graficoDiasSemanaRS(diasGraf, d => d.furosTopo, () => '', cor.aco, v => String(Math.round(v)), { rotulo: d => d.num })}</div></div>
    <div style="display:flex;gap:14px;margin-top:18px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;">Semana a semana <span style="font-weight:500;color:${cor.mut};font-size:11.5px;">· metros perfilados</span></div>
        <div style="height:128px;display:flex;align-items:flex-end;gap:10px;border-bottom:1px solid ${cor.lin};padding:0 4px;">${barrasS}</div>
        <div style="display:flex;gap:10px;padding:0 4px;color:${cor.mut};text-align:center;margin-top:4px;">${rotS}</div>
        <div style="font-size:11.5px;color:${cor.mut};margin-top:8px;">Furos topografados por semana: ${semVis.map(w => '<b style="color:' + cor.aco + '">' + w.topo + '</b>').join(' · ')}</div></div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;">Equipes <span style="font-weight:500;color:${cor.mut};font-size:11.5px;">· ordenadas por metros</span></div>
        ${cardsEq || `<div style="color:${cor.mut};font-size:13px;">Nenhuma equipe cadastrada neste projeto.</div>`}</div></div>
    ${realcesHTMLRS(r.realces, 'mês')}
    <div style="margin-top:14px;font-size:11px;color:${cor.mut};display:flex;justify-content:space-between;"><span>BlastHole Manager${quem ? ' · ' + e2(quem) : ''}</span><span>gerado em ${ddmmRS(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}</span></div></div>`;
}

async function gerarImagemRelatorioMensal(offset){
  if(typeof html2canvas !== 'function') throw new Error('biblioteca de imagem não carregou (precisa de internet na primeira vez)');
  const r = calcularRelatorioMensal(offset);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:860px;z-index:-1;';
  host.innerHTML = cartaoRelatorioMensalHTML(r);
  document.body.appendChild(host);
  try{
    const canvas = await html2canvas(host.firstElementChild, { backgroundColor: '#ffffff', scale: 2, useCORS: true, windowWidth: 900 });
    const blob = await new Promise((ok, erro) => canvas.toBlob(b => b ? ok(b) : erro(new Error('falha ao gerar o PNG')), 'image/png'));
    return { blob, nomeArquivo: `relatorio-mensal-${r.iniISO.slice(0, 7)}.png` };
  }finally{ host.remove(); }
}

// ---- Janela do relatório ----
function abrirRelatorioMensal(offset){
  if(typeof offset === 'number') relMesOffset = offset;
  const r = calcularRelatorioMensal(relMesOffset), root = el('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box modal-box-larga resumo-sem-box">
        <div class="resumo-sem-nav">
          <button type="button" class="ghost" id="rm-ant" aria-label="mês anterior">‹</button>
          <b>Relatório mensal · ${escHtml(nomeMesRM(r))}${relMesOffset === 0 ? ' (este mês)' : ''}</b>
          <button type="button" class="ghost" id="rm-prox" aria-label="próximo mês" ${relMesOffset >= 0 ? 'disabled' : ''}>›</button>
        </div>
        <div class="resumo-sem-previa" id="rm-previa"><div class="resumo-sem-zoom" id="rm-zoom">${cartaoRelatorioMensalHTML(r)}</div></div>
        <details class="resumo-sem-texto"><summary>Ver a mensagem de WhatsApp</summary><pre id="rm-pre"></pre></details>
        <div class="modal-actions resumo-sem-acoes">
          <button type="button" class="steel" id="rm-baixar">Baixar imagem</button>
          <button type="button" class="steel" id="rm-enviar-img">Enviar imagem</button>
          <button type="button" class="steel" id="rm-enviar-txt">Enviar mensagem</button>
          <button type="button" class="ghost" id="rm-copiar">Copiar texto</button>
          <button type="button" class="ghost" id="rm-fechar">Fechar</button>
        </div>
      </div>
    </div>`;
  el('rm-pre').textContent = montarRelatorioMensalWhatsApp(relMesOffset);
  const ajustar = ()=>{ const p = el('rm-previa'), z = el('rm-zoom'); if(!p || !z) return; z.style.zoom = String(Math.min(1, (p.clientWidth - 2) / 860)); };
  requestAnimationFrame(ajustar);
  const fechar = ()=>{ root.innerHTML = ''; window.removeEventListener('resize', ajustar); };
  window.addEventListener('resize', ajustar);
  el('modal-overlay').addEventListener('click', ev => { if(ev.target.id === 'modal-overlay') fechar(); });
  el('rm-fechar').addEventListener('click', fechar);
  el('rm-ant').addEventListener('click', () => { fechar(); abrirRelatorioMensal(relMesOffset - 1); });
  el('rm-prox').addEventListener('click', () => { if(relMesOffset < 0){ fechar(); abrirRelatorioMensal(relMesOffset + 1); } });
  const ocupado = async (btn, txt, fn)=>{ const h = btn.innerHTML; btn.disabled = true; btn.textContent = txt; try{ await fn(); }catch(err){ showToast('Erro: ' + (err && err.message ? err.message : err)); } finally{ btn.disabled = false; btn.innerHTML = h; } };
  el('rm-baixar').addEventListener('click', ev => ocupado(ev.currentTarget, 'Gerando...', async ()=>{ const { blob, nomeArquivo } = await gerarImagemRelatorioMensal(relMesOffset); baixarBlob(blob, nomeArquivo); showToast('Imagem baixada: ' + nomeArquivo, { erro: false }); }));
  el('rm-enviar-img').addEventListener('click', ev => ocupado(ev.currentTarget, 'Gerando...', async ()=>{
    const { blob, nomeArquivo } = await gerarImagemRelatorioMensal(relMesOffset);
    const arq = new File([blob], nomeArquivo, { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [arq] })){
      try{ await navigator.share({ files: [arq], title: 'Relatório mensal' }); }catch(err){ if(err.name !== 'AbortError') showToast('Não foi possível compartilhar a imagem.'); }
    }else{
      baixarBlob(blob, nomeArquivo);
      abrirWhatsApp(configApp.whatsapp ? `https://wa.me/${configApp.whatsapp}` : 'https://wa.me/');
      showToast('Imagem baixada — anexe ela na conversa do WhatsApp que abriu.', { erro: false });
    }
  }));
  el('rm-enviar-txt').addEventListener('click', () => {
    const t = encodeURIComponent(montarRelatorioMensalWhatsApp(relMesOffset));
    abrirWhatsApp(configApp.whatsapp ? `https://wa.me/${configApp.whatsapp}?text=${t}` : `https://wa.me/?text=${t}`);
  });
  el('rm-copiar').addEventListener('click', async () => { const ok = await copiarTextoResumo(montarRelatorioMensalWhatsApp(relMesOffset)); showToast(ok ? 'Mensagem copiada. É só colar no WhatsApp.' : 'Não foi possível copiar.', { erro: false }); });
}
(function(){
  const b = el('btn-relatorio-mensal'); if(b) b.addEventListener('click', () => abrirRelatorioMensal(0));
})();
