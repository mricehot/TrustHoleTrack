// ---------- Resumo semanal (sábado) ----------
// Fecha a semana (segunda a domingo; domingo é folga) com tudo de produtividade: totais, comparação com a semana
// passada, dia a dia e cada equipe (meta, melhor dia, dias trabalhados). Sai como IMAGEM e como MENSAGEM de WhatsApp.
let resumoSemOffset = 0;
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const semAcentoRS = t => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const numRS = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
const ddmmRS = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
const varRS = (atual, ant) => !ant ? (atual ? null : 0) : Math.round((atual - ant) / ant * 100);


// Realces e leques: andamento geral e o que mudou na semana. Mesma base do checklist.
function calcularRealcesSemana(iniISO, fimISO){
  const naSemana = iso => { if(!iso) return false; const c = chaveDia(iso); return c >= iniISO && c <= fimISO; };
  const out = [];
  aneisNoEscopoAtual().forEach(a => {
    const leques = checklistLeques.filter(c => c.anelId === a.id).sort((x, y) => (parseInt(x.numero, 10) || 0) - (parseInt(y.numero, 10) || 0));
    if(!leques.length) return;
    const R = { nome: a.nome, leques: { total: leques.length, ok: 0, and: 0, obs: 0, ini: 0 }, furos: 0, perf: 0, topo: 0, obstr: 0, perfSem: 0, topoSem: 0,
      finalizados: [], andamento: [], naoIniciados: [], obstruidos: [] };
    leques.forEach(c => {
      const fs = checklistFurosDoLeque(c.id), est = estadoDoLeque(fs), cod = { tipo: c.tipo, numero: c.numero }, rotulo = (PREFIXO[c.tipo] || '') + c.numero;
      R.leques[est]++; R.furos += fs.length;
      fs.forEach(f => {
        if(f.perfilado) R.perf++; if(f.topografado) R.topo++; if(f.obstruido) R.obstr++;
        if(f.perfilado && naSemana(f.perfiladoEm)) R.perfSem++;
        if(f.topografado && naSemana(f.topografadoEm)) R.topoSem++;
      });
      const pendPerf = fs.filter(f => !f.obstruido && !f.perfilado).length, pendTopo = fs.filter(f => !f.obstruido && !f.topografado).length;
      const obstrN = fs.filter(f => f.obstruido).length;
      if(obstrN) R.obstruidos.push(`${rotulo} (${obstrN})`);
      if(est === 'ok'){
        // finalizado nesta semana = a última marcação que o fechou caiu dentro dela
        const ult = fs.reduce((m, f) => { const t = Math.max(f.perfiladoEm ? +new Date(f.perfiladoEm) : 0, f.topografadoEm ? +new Date(f.topografadoEm) : 0); return t > m ? t : m; }, 0);
        if(ult && naSemana(new Date(ult).toISOString())) R.finalizados.push(cod);
      }else if(est === 'ini'){ R.naoIniciados.push(cod); }
      else R.andamento.push({ cod, rotulo, pendPerf, pendTopo, obstr: obstrN, alto: est === 'obs' });
    });
    // só entra o realce que teve movimento na semana ou que ainda tem pendência
    if(R.perfSem || R.topoSem || R.finalizados.length || R.andamento.length || R.naoIniciados.length) out.push(R);
  });
  return out;
}

function calcularResumoSemanal(offset){
  const ini = inicioDaSemana(new Date()); ini.setDate(ini.getDate() + offset * 7);
  const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
  const iniAnt = new Date(ini); iniAnt.setDate(iniAnt.getDate() - 7);
  const fimAnt = new Date(fim); fimAnt.setDate(fimAnt.getDate() - 7);
  const iniISO = dataISOLocal(ini), fimISO = dataISOLocal(fim), iniAntISO = dataISOLocal(iniAnt), fimAntISO = dataISOLocal(fimAnt);
  const lista = equipesDoProjeto();
  const ids = new Set(lista.map(e => e.id));
  const efet = lancamentosEfetivos().filter(l => ids.has(l.equipeId));
  const dias = [];
  for(let i = 0; i < 7; i++){
    const d = new Date(ini); d.setDate(d.getDate() + i);
    dias.push({ data: d, iso: dataISOLocal(d), nome: DIAS_CURTOS[d.getDay()], folga: d.getDay() === 0, metros: 0, pontos: 0 });
  }
  const equipesR = lista.map(e => {
    const meus = efet.filter(l => l.equipeId === e.id);
    let metros = 0, pontos = 0, antM = 0, antP = 0; const porDia = {};
    meus.forEach(l => {
      if(l.data >= iniISO && l.data <= fimISO){
        metros += l.metros; pontos += l.pontos;
        const d = dias.find(x => x.iso === l.data); if(d){ d.metros += l.metros; d.pontos += l.pontos; }
        porDia[l.data] = porDia[l.data] || { metros: 0, pontos: 0 }; porDia[l.data].metros += l.metros; porDia[l.data].pontos += l.pontos;
      }else if(l.data >= iniAntISO && l.data <= fimAntISO){ antM += l.metros; antP += l.pontos; }
    });
    const diasTrab = Object.keys(porDia).filter(k => porDia[k].metros > 0 || porDia[k].pontos > 0);
    let melhor = null; diasTrab.forEach(k => { if(!melhor || porDia[k].metros > melhor.metros) melhor = { iso: k, metros: porDia[k].metros, pontos: porDia[k].pontos }; });
    metros = arred2(metros); antM = arred2(antM);
    const meta = e.metaSemanal > 0 ? e.metaSemanal : 0;
    return { id: e.id, nome: e.nome, integrantes: e.integrantes, metros, pontos: Math.round(pontos), antM, antP: Math.round(antP),
      diasTrab: diasTrab.length, media: diasTrab.length ? arred2(metros / diasTrab.length) : 0, melhor, meta, pct: meta ? Math.round(metros / meta * 100) : null,
      varM: varRS(metros, antM), varP: varRS(Math.round(pontos), Math.round(antP)) };
  }).sort((a, b) => b.metros - a.metros || b.pontos - a.pontos);
  const tot = equipesR.reduce((t, e) => ({ m: t.m + e.metros, p: t.p + e.pontos, am: t.am + e.antM, ap: t.ap + e.antP, meta: t.meta + e.meta }), { m: 0, p: 0, am: 0, ap: 0, meta: 0 });
  tot.m = arred2(tot.m);
  const diasTrabTotal = dias.filter(d => d.metros > 0 || d.pontos > 0).length;
  let melhorDia = null; dias.forEach(d => { if(d.metros > 0 && (!melhorDia || d.metros > melhorDia.metros)) melhorDia = d; });
  // Furos marcados no checklist dentro da semana (mesma base do infográfico).
  let furosPerf = 0, furosTopo = 0;
  checklistFurosNoEscopoAtual().forEach(f => {
    if(f.perfilado && f.perfiladoEm){ const c = chaveDia(f.perfiladoEm); if(c >= iniISO && c <= fimISO) furosPerf++; }
    if(f.topografado && f.topografadoEm){ const c = chaveDia(f.topografadoEm); if(c >= iniISO && c <= fimISO) furosTopo++; }
  });
  return { ini, fim, iniISO, fimISO, equipes: equipesR, dias, tot, diasTrab: diasTrabTotal, melhorDia,
    mediaDia: diasTrabTotal ? arred2(tot.m / diasTrabTotal) : 0, varM: varRS(tot.m, tot.am), varP: varRS(Math.round(tot.p), Math.round(tot.ap)),
    pctMeta: tot.meta ? Math.round(tot.m / tot.meta * 100) : null, realces: calcularRealcesSemana(iniISO, fimISO), furosPerf, furosTopo, projeto: configApp.projetoAtivo || '' };
}

const setaRS = v => v === null ? '(sem base na semana passada)' : v === 0 ? '(= semana passada)' : (v > 0 ? '▲ +' : '▼ ') + v + '% vs semana passada';

function montarResumoSemanalWhatsApp(offset){
  const r = calcularResumoSemanal(offset);
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const quem = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  let o = `📊 *RESUMO SEMANAL*\n${ddmmRS(r.ini)} a ${ddmmRS(r.fim)}${r.projeto ? ' - Projeto ' + semAcentoRS(r.projeto) : ''}\n`;
  if(!r.equipes.length) return o + '\nNenhuma equipe cadastrada neste projeto.';
  o += `\n*TOTAL DA SEMANA*\nPerfilagem: *${numRS(r.tot.m)} m* ${setaRS(r.varM)}`;
  if(r.pctMeta !== null) o += `\nMeta semanal: ${r.pctMeta}% (${numRS(r.tot.m)} de ${numRS(r.tot.meta)} m)`;
  o += `\nTopografia: *${plural(Math.round(r.tot.p), 'ponto', 'pontos')}* ${setaRS(r.varP)}`;
  o += `\nChecklist na semana: ${plural(r.furosPerf, 'furo perfilado', 'furos perfilados')} | ${plural(r.furosTopo, 'furo topografado', 'furos topografados')}`;
  o += `\nDias de producao: ${r.diasTrab}${r.diasTrab ? ' | media ' + numRS(r.mediaDia) + ' m/dia' : ''}`;
  if(r.melhorDia) o += `\nMelhor dia: ${semAcentoRS(r.melhorDia.nome)} ${ddmmRS(r.melhorDia.data)} - ${numRS(r.melhorDia.metros)} m`;
  o += '\n\n*DIA A DIA*\n' + r.dias.map(d => {
    if(!d.metros && !d.pontos) return `${semAcentoRS(d.nome)} ${ddmmRS(d.data)}: ${d.folga ? 'folga' : 'sem producao'}`;
    return `${semAcentoRS(d.nome)} ${ddmmRS(d.data)}: ${numRS(d.metros)} m | ${Math.round(d.pontos)} ${Math.round(d.pontos) === 1 ? 'ponto' : 'pontos'}`;
  }).join('\n');
  o += '\n\n*EQUIPES* (por metros)\n' + r.equipes.map((e, i) => {
    let t = `${i + 1}. *${semAcentoRS(e.nome)}*${e.integrantes ? ' (' + semAcentoRS(e.integrantes) + ')' : ''}\n`;
    if(!e.diasTrab) return t + '   sem lancamento na semana';
    t += `   ${numRS(e.metros)} m${e.pct !== null ? ' (' + e.pct + '% da meta de ' + numRS(e.meta) + ' m)' : ''} | ${plural(Math.round(e.pontos), 'ponto', 'pontos')}`;
    t += `\n   ${plural(e.diasTrab, 'dia', 'dias')} | media ${numRS(e.media)} m/dia`;
    if(e.melhor){ const dm = new Date(e.melhor.iso + 'T12:00:00'); t += ` | melhor: ${semAcentoRS(DIAS_CURTOS[dm.getDay()])} ${ddmmRS(dm)} (${numRS(e.melhor.metros)} m)`; }
    t += `\n   ${setaRS(e.varM).replace(' vs semana passada', ' metros vs semana passada')}`;
    return t;
  }).join('\n\n');
  if(r.realces.length){
    o += '\n\n*REALCES E LEQUES*\n' + r.realces.map(x => {
      const pct = n => x.furos ? Math.round(n / x.furos * 100) : 0;
      let t = `*${semAcentoRS(x.nome)}*\n   Leques: ${x.leques.ok} completos de ${x.leques.total}` + (x.leques.and + x.leques.obs ? ` | ${x.leques.and + x.leques.obs} em andamento` : '') + (x.leques.ini ? ` | ${x.leques.ini} nao iniciados` : '');
      t += `\n   Furos: perfilados ${x.perf}/${x.furos} (${pct(x.perf)}%) | topografados ${x.topo}/${x.furos} (${pct(x.topo)}%)`;
      t += `\n   Na semana: +${x.perfSem} perfilados | +${x.topoSem} topografados`;
      if(x.finalizados.length) t += `\n   Finalizados na semana: ${compactarCodigosEmIntervalos(x.finalizados).join(', ')}`;
      if(x.andamento.length) t += `\n   Em andamento: ` + x.andamento.map(a => `${a.rotulo} (falta ${a.pendPerf} perf. / ${a.pendTopo} topo${a.obstr ? ', ' + a.obstr + ' obstr.' : ''})`).join('; ');
      if(x.naoIniciados.length) t += `\n   Nao iniciados: ${compactarCodigosEmIntervalos(x.naoIniciados).join(', ')}`;
      if(x.obstruidos.length) t += `\n   Com furo obstruido: ${x.obstruidos.join(', ')}`;
      return t;
    }).join('\n\n');
  }
  if(quem) o += `\n\n_Resumo gerado por ${semAcentoRS(quem)}_`;
  return o;
}

// ---- Imagem (cartão claro, largura fixa, igual em qualquer aparelho) ----
function cartaoResumoSemanalHTML(r){
  const e2 = escHtml, cor = { amb: '#ff431d', aco: '#2f6690', ver: '#2e9b57', txt: '#191231', mut: '#6b6b80', lin: '#e3e1ea', fundo: '#f6f5f9' };
  const quem = typeof nomeDoUsuario === 'function' ? nomeDoUsuario() : '';
  const agora = new Date();
  const seta = (v, curto) => v === null ? `<span style="color:${cor.mut}">sem base</span>` : v === 0 ? `<span style="color:${cor.mut}">= igual</span>` : `<span style="color:${v > 0 ? cor.ver : '#d6453d'}">${v > 0 ? '▲ +' : '▼ '}${v}%</span>`;
  const kpi = (rot, val, sub) => `<div style="flex:1;min-width:0;background:${cor.fundo};border:1px solid ${cor.lin};border-radius:10px;padding:12px 14px;">
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${cor.mut};font-weight:700;">${rot}</div>
      <div style="font:700 26px 'JetBrains Mono',ui-monospace,monospace;margin-top:4px;color:${cor.txt};">${val}</div>
      <div style="font-size:12px;margin-top:3px;color:${cor.mut};">${sub}</div></div>`;
  const maxM = Math.max(1, ...r.dias.map(d => d.metros));
  const barras = r.dias.map(d => {
    const h = Math.round(d.metros / maxM * 110);
    const corpo = d.folga && !d.metros && !d.pontos
      ? `<div style="height:110px;width:100%;border-radius:6px;background:#eeecf3;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${cor.mut};">folga</div>`
      : `<div style="height:110px;width:100%;display:flex;align-items:flex-end;"><div style="width:100%;height:${Math.max(h, d.metros ? 3 : 0)}px;background:${cor.amb};border-radius:6px 6px 2px 2px;"></div></div>`;
    return `<div style="flex:1;min-width:0;text-align:center;">
      <div style="font:700 13px 'JetBrains Mono',monospace;height:18px;color:${cor.txt};">${d.metros ? numRS(d.metros) : (d.folga ? '' : '–')}</div>${corpo}
      <div style="font-size:12px;font-weight:700;margin-top:6px;color:${cor.txt};">${d.nome}</div>
      <div style="font-size:11px;color:${cor.mut};">${ddmmRS(d.data)}</div>
      <div style="font-size:11px;color:${cor.aco};font-weight:700;height:14px;">${d.pontos ? Math.round(d.pontos) + (Math.round(d.pontos) === 1 ? ' pt' : ' pts') : ''}</div></div>`;
  }).join('');
  const cards = r.equipes.map((e, i) => {
    const largura = e.pct === null ? 0 : Math.min(100, e.pct);
    const melhor = e.melhor ? `${DIAS_CURTOS[new Date(e.melhor.iso + 'T12:00:00').getDay()]} ${ddmmRS(new Date(e.melhor.iso + 'T12:00:00'))} (${numRS(e.melhor.metros)} m)` : '–';
    return `<div style="border:1px solid ${cor.lin};border-left:6px solid ${e.pct !== null && e.pct >= 100 ? cor.ver : cor.amb};border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
        <div style="font-weight:700;font-size:16px;color:${cor.txt};">${i + 1}º · ${e2(e.nome)}<span style="font-weight:500;font-size:12px;color:${cor.mut};margin-left:8px;">${e2(e.integrantes || '')}</span></div>
        <div style="font:700 20px 'JetBrains Mono',monospace;color:${cor.txt};white-space:nowrap;">${numRS(e.metros)} m</div></div>
      ${e.pct !== null ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;"><div style="flex:1;height:8px;background:#ece9f2;border-radius:6px;overflow:hidden;"><div style="width:${largura}%;height:100%;background:${e.pct >= 100 ? cor.ver : cor.amb};"></div></div><span style="font:700 12px 'JetBrains Mono',monospace;color:${cor.txt};">${e.pct}% de ${numRS(e.meta)} m</span></div>` : ''}
      ${e.diasTrab ? `<div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px;font-size:12.5px;color:${cor.mut};">
        <span><b style="color:${cor.aco}">${Math.round(e.pontos)}</b> ${Math.round(e.pontos) === 1 ? 'ponto' : 'pontos'}</span>
        <span><b style="color:${cor.txt}">${e.diasTrab}</b> ${e.diasTrab === 1 ? 'dia' : 'dias'}</span>
        <span>média <b style="color:${cor.txt}">${numRS(e.media)}</b> m/dia</span>
        <span>melhor dia <b style="color:${cor.txt}">${melhor}</b></span>
        <span>metros: ${seta(e.varM)} · pontos: ${seta(e.varP)} <span style="color:${cor.mut}">(vs semana passada)</span></span>` : `<div style="margin-top:8px;font-size:12.5px;color:${cor.mut};">sem lançamento na semana`}</div></div>`;
  }).join('');
  const realcesHTML = r.realces.length ? `<div style="font-weight:700;font-size:14px;margin:20px 0 8px;">Realces e leques <span style="font-weight:500;color:${cor.mut};font-size:12px;">· andamento e o que mudou na semana</span></div>` + r.realces.map(x => {
    const p = n => x.furos ? Math.round(n / x.furos * 100) : 0;
    const barra = (n, c) => `<div style="flex:1;height:8px;background:#ece9f2;border-radius:6px;overflow:hidden;"><div style="width:${p(n)}%;height:100%;background:${c};"></div></div>`;
    const chip = (txt, c) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:${c}1f;color:${c};border:1px solid ${c}55;font-size:12px;font-weight:600;">${txt}</span>`;
    const linha = (rot, conteudo) => conteudo ? `<div style="margin-top:6px;font-size:12.5px;color:${cor.mut};"><b style="color:${cor.txt}">${rot}</b> ${conteudo}</div>` : '';
    return `<div style="border:1px solid ${cor.lin};border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;"><b style="font-size:15px;">${e2(x.nome)}</b>
        <span style="font-size:12.5px;color:${cor.mut};"><b style="color:${cor.ver}">${x.leques.ok}</b> completos de ${x.leques.total} leques${x.leques.and + x.leques.obs ? ' · <b style="color:#c98a00">' + (x.leques.and + x.leques.obs) + '</b> em andamento' : ''}${x.leques.ini ? ' · ' + x.leques.ini + ' não iniciados' : ''}</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;"><span style="width:84px;color:${cor.mut};">Perfilados</span>${barra(x.perf, cor.ver)}<b style="font:700 12px 'JetBrains Mono',monospace;width:96px;text-align:right;">${x.perf}/${x.furos} · ${p(x.perf)}%</b></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:12px;"><span style="width:84px;color:${cor.mut};">Topografados</span>${barra(x.topo, cor.aco)}<b style="font:700 12px 'JetBrains Mono',monospace;width:96px;text-align:right;">${x.topo}/${x.furos} · ${p(x.topo)}%</b></div>
      ${linha('Na semana:', `+${x.perfSem} perfilados · +${x.topoSem} topografados`)}
      ${x.finalizados.length ? linha('Finalizados na semana:', compactarCodigosEmIntervalos(x.finalizados).map(c => chip(c, cor.ver)).join('')) : ''}
      ${x.andamento.length ? linha('Em andamento:', x.andamento.map(a => chip(`${a.rotulo} · falta ${a.pendPerf} perf / ${a.pendTopo} topo${a.obstr ? ' · ' + a.obstr + ' obstr.' : ''}`, a.alto ? '#d6453d' : '#c98a00')).join('')) : ''}
      ${x.naoIniciados.length ? linha('Não iniciados:', compactarCodigosEmIntervalos(x.naoIniciados).map(c => chip(c, cor.mut)).join('')) : ''}
      ${x.obstruidos.length ? linha('Com furo obstruído:', x.obstruidos.map(c => chip(c, '#d6453d')).join('')) : ''}</div>`;
  }).join('') : '';
  return `<div style="width:860px;box-sizing:border-box;background:#fff;color:${cor.txt};font-family:'Inter',system-ui,sans-serif;padding:26px 28px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${cor.amb};padding-bottom:12px;">
      <div><div style="font-size:12px;letter-spacing:2px;font-weight:700;color:${cor.amb};">RESUMO SEMANAL</div>
        <div style="font-size:24px;font-weight:800;margin-top:2px;">${ddmmRS(r.ini)} a ${ddmmRS(r.fim)}</div></div>
      <div style="text-align:right;font-size:13px;color:${cor.mut};">${r.projeto ? 'Projeto ' + e2(r.projeto) : 'Todos os projetos'}<br>perfilagem e topografia</div></div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      ${kpi('Metros perfilados', numRS(r.tot.m) + '<span style="font-size:14px;color:' + cor.mut + '"> m</span>', seta(r.varM) + ' vs semana passada' + (r.pctMeta !== null ? ' · ' + r.pctMeta + '% da meta' : ''))}
      ${kpi('Pontos topografados', Math.round(r.tot.p), seta(r.varP) + ' vs semana passada')}
      ${kpi('Furos no checklist', r.furosPerf + ' / ' + r.furosTopo, 'perfilados / topografados')}
      ${kpi('Dias de produção', r.diasTrab, r.diasTrab ? 'média ' + numRS(r.mediaDia) + ' m/dia' : 'sem produção')}</div>
    ${r.melhorDia ? `<div style="margin-top:10px;font-size:13px;color:${cor.mut};">Melhor dia da semana: <b style="color:${cor.txt}">${r.melhorDia.nome} ${ddmmRS(r.melhorDia.data)}</b> com <b style="color:${cor.txt}">${numRS(r.melhorDia.metros)} m</b></div>` : ''}
    <div style="font-weight:700;font-size:14px;margin:18px 0 8px;">Metros por dia <span style="font-weight:500;color:${cor.mut};font-size:12px;">· pontos topografados em azul</span></div>
    <div style="display:flex;gap:8px;">${barras}</div>
    <div style="font-weight:700;font-size:14px;margin:20px 0 8px;">Equipes <span style="font-weight:500;color:${cor.mut};font-size:12px;">· ordenadas por metros</span></div>
    ${cards || `<div style="color:${cor.mut};font-size:13px;">Nenhuma equipe cadastrada neste projeto.</div>`}
    ${realcesHTML}
    <div style="margin-top:14px;font-size:11px;color:${cor.mut};display:flex;justify-content:space-between;"><span>BlastHole Manager${quem ? ' · ' + e2(quem) : ''}</span><span>gerado em ${ddmmRS(agora)} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}</span></div></div>`;
}

async function gerarImagemResumoSemanal(offset){
  if(typeof html2canvas !== 'function') throw new Error('biblioteca de imagem não carregou (precisa de internet na primeira vez)');
  const r = calcularResumoSemanal(offset);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:860px;z-index:-1;';
  host.innerHTML = cartaoResumoSemanalHTML(r);
  document.body.appendChild(host);
  try{
    const canvas = await html2canvas(host.firstElementChild, { backgroundColor: '#ffffff', scale: 2, useCORS: true, windowWidth: 900 });
    const blob = await new Promise((ok, erro) => canvas.toBlob(b => b ? ok(b) : erro(new Error('falha ao gerar o PNG')), 'image/png'));
    return { blob, nomeArquivo: `resumo-semanal-${r.iniISO}.png` };
  }finally{ host.remove(); }
}

// ---- Janela do resumo ----
function abrirResumoSemanal(offset){
  if(typeof offset === 'number') resumoSemOffset = offset;
  try{ localStorage.setItem('resumo-semanal-visto-' + dataISOLocal(inicioDaSemana(new Date())), '1'); }catch(e){}
  atualizarAvisoSabado();
  const r = calcularResumoSemanal(resumoSemOffset), root = el('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box modal-box-larga resumo-sem-box">
        <div class="resumo-sem-nav">
          <button type="button" class="ghost" id="rs-ant" aria-label="semana anterior">‹</button>
          <b>Resumo semanal · ${ddmmRS(r.ini)} a ${ddmmRS(r.fim)}${resumoSemOffset === 0 ? ' (esta semana)' : ''}</b>
          <button type="button" class="ghost" id="rs-prox" aria-label="próxima semana" ${resumoSemOffset >= 0 ? 'disabled' : ''}>›</button>
        </div>
        <div class="resumo-sem-previa" id="rs-previa"><div class="resumo-sem-zoom" id="rs-zoom">${cartaoResumoSemanalHTML(r)}</div></div>
        <details class="resumo-sem-texto"><summary>Ver a mensagem de WhatsApp</summary><pre id="rs-pre"></pre></details>
        <div class="modal-actions resumo-sem-acoes">
          <button type="button" class="steel" id="rs-baixar">Baixar imagem</button>
          <button type="button" class="steel" id="rs-enviar-img">Enviar imagem</button>
          <button type="button" class="steel" id="rs-enviar-txt">Enviar mensagem</button>
          <button type="button" class="ghost" id="rs-copiar">Copiar texto</button>
          <button type="button" class="ghost" id="rs-fechar">Fechar</button>
        </div>
      </div>
    </div>`;
  const pre = el('rs-pre'); pre.textContent = montarResumoSemanalWhatsApp(resumoSemOffset);
  const ajustar = ()=>{ const p = el('rs-previa'), z = el('rs-zoom'); if(!p || !z) return; const k = Math.min(1, (p.clientWidth - 2) / 860); z.style.zoom = String(k); };
  requestAnimationFrame(ajustar);
  const fechar = ()=>{ root.innerHTML = ''; window.removeEventListener('resize', ajustar); };
  window.addEventListener('resize', ajustar);
  el('modal-overlay').addEventListener('click', ev => { if(ev.target.id === 'modal-overlay') fechar(); });
  el('rs-fechar').addEventListener('click', fechar);
  el('rs-ant').addEventListener('click', () => { fechar(); abrirResumoSemanal(resumoSemOffset - 1); });
  el('rs-prox').addEventListener('click', () => { if(resumoSemOffset < 0){ fechar(); abrirResumoSemanal(resumoSemOffset + 1); } });
  const ocupado = async (btn, txt, fn)=>{ const h = btn.innerHTML; btn.disabled = true; btn.textContent = txt; try{ await fn(); }catch(err){ showToast('Erro: ' + (err && err.message ? err.message : err)); } finally{ btn.disabled = false; btn.innerHTML = h; } };
  el('rs-baixar').addEventListener('click', ev => ocupado(ev.currentTarget, 'Gerando...', async ()=>{ const { blob, nomeArquivo } = await gerarImagemResumoSemanal(resumoSemOffset); baixarBlob(blob, nomeArquivo); showToast('Imagem baixada: ' + nomeArquivo, { erro: false }); }));
  el('rs-enviar-img').addEventListener('click', ev => ocupado(ev.currentTarget, 'Gerando...', async ()=>{
    const { blob, nomeArquivo } = await gerarImagemResumoSemanal(resumoSemOffset);
    const arq = new File([blob], nomeArquivo, { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [arq] })){
      try{ await navigator.share({ files: [arq], title: 'Resumo semanal' }); }catch(err){ if(err.name !== 'AbortError') showToast('Não foi possível compartilhar a imagem.'); }
    }else{
      baixarBlob(blob, nomeArquivo);
      abrirWhatsApp(configApp.whatsapp ? `https://wa.me/${configApp.whatsapp}` : 'https://wa.me/');
      showToast('Imagem baixada — anexe ela na conversa do WhatsApp que abriu.', { erro: false });
    }
  }));
  el('rs-enviar-txt').addEventListener('click', () => {
    const t = encodeURIComponent(montarResumoSemanalWhatsApp(resumoSemOffset));
    abrirWhatsApp(configApp.whatsapp ? `https://wa.me/${configApp.whatsapp}?text=${t}` : `https://wa.me/?text=${t}`);
  });
  el('rs-copiar').addEventListener('click', async () => { const ok = await copiarTextoResumo(montarResumoSemanalWhatsApp(resumoSemOffset)); showToast(ok ? 'Mensagem copiada. É só colar no WhatsApp.' : 'Não foi possível copiar.', { erro: false }); });
}

// ---- Aviso de sábado ----
function atualizarAvisoSabado(){
  const sab = new Date().getDay() === 6;
  let visto = false; try{ visto = !!localStorage.getItem('resumo-semanal-visto-' + dataISOLocal(inicioDaSemana(new Date()))); }catch(e){}
  ['view-turno', 'view-infografico'].forEach(id => {
    const sec = el(id); if(!sec) return;
    let av = sec.querySelector(':scope > .aviso-semanal');
    if(!sab || visto){ if(av) av.remove(); return; }
    if(av) return;
    av = document.createElement('div'); av.className = 'aviso-semanal';
    av.innerHTML = `<span>📊 <b>Hoje é sábado</b> — o resumo da semana está pronto para enviar.</span><span class="aviso-acoes"><button type="button" class="steel" data-a="abrir">Ver resumo</button><button type="button" class="ghost" data-a="dispensar" aria-label="dispensar">✕</button></span>`;
    av.querySelector('[data-a=abrir]').addEventListener('click', () => abrirResumoSemanal(0));
    av.querySelector('[data-a=dispensar]').addEventListener('click', () => { try{ localStorage.setItem('resumo-semanal-visto-' + dataISOLocal(inicioDaSemana(new Date())), '1'); }catch(e){} atualizarAvisoSabado(); });
    sec.insertBefore(av, sec.firstChild);
  });
}
(function(){
  const b = el('btn-resumo-semanal'); if(b) b.addEventListener('click', () => abrirResumoSemanal(0));
  const o = window.renderAll;
  if(typeof o === 'function') window.renderAll = function(){ const r = o.apply(this, arguments); try{ atualizarAvisoSabado(); }catch(e){} return r; };
  try{ atualizarAvisoSabado(); }catch(e){}
})();
