/* ================= Relatório do realce em IMAGEM (para o WhatsApp) ================= */
// Desenha o relatório num <canvas> (sem bibliotecas externas, funciona sem sinal) e abre o compartilhamento
// do celular com a imagem. Em navegador sem compartilhamento de arquivos, baixa o PNG.
const RI = { bg:'#10151c', card:'#18202b', line:'#273241', txt:'#e8edf3', mut:'#8f9db0', ok:'#35b36a', per:'#4caf6d', sp:'#f5a524', top:'#4a90d9', obs:'#e5534b', and:'#e0a21b', nada:'#2b3645' };
const RI_FONTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const RI_W = 720, RI_M = 28;

function riRect(c, x, y, w, h, r, fill, stroke){
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if(fill){ c.fillStyle = fill; c.fill(); }
  if(stroke){ c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}
function riTexto(c, t, x, y, { tam = 16, peso = '400', cor = RI.txt, alinhar = 'left', espaco = 0 } = {}){
  c.font = `${peso} ${tam}px ${RI_FONTE}`; c.fillStyle = cor; c.textAlign = alinhar; c.textBaseline = 'alphabetic';
  if('letterSpacing' in c) c.letterSpacing = espaco + 'px';
  c.fillText(t, x, y);
  if('letterSpacing' in c) c.letterSpacing = '0px';
}
// Quebra texto em linhas que cabem na largura (para listas longas de furos).
function riQuebrar(c, partes, larg, tam, peso){
  c.font = `${peso || '400'} ${tam}px ${RI_FONTE}`;
  const linhas = []; let atual = '';
  partes.forEach(p=>{ const t = atual ? atual + ' · ' + p : p; if(c.measureText(t).width > larg && atual){ linhas.push(atual); atual = p; } else atual = t; });
  if(atual) linhas.push(atual);
  return linhas;
}
function riCompactar(nums){ // ["05","06","07","09"] -> ["F05 a F07", "F09"]
  const v = nums.map(n=>({ t:String(n), n:parseInt(n, 10) })).sort((a,b)=>a.n-b.n); const out = []; let i = 0;
  while(i < v.length){ let j = i; while(j + 1 < v.length && v[j+1].n === v[j].n + 1) j++; out.push(j - i >= 2 ? `F${v[i].t} a F${v[j].t}` : v.slice(i, j+1).map(x=>'F'+x.t).join(', ')); i = j + 1; }
  return out;
}
const riVir = n=> fmt1(n).replace('.', ',') + ' m';

async function riCarregarFoto(f){
  try{
    let blob = (typeof fotosPendentes !== 'undefined' && fotosPendentes.has(f.id)) ? fotosPendentes.get(f.id).blob : null;
    if(!blob && f.fotoUrl){ const r = await fetch(f.fotoUrl); if(r.ok) blob = await r.blob(); }
    return blob ? await createImageBitmap(blob) : null;
  }catch(e){ return null; }
}

// Monta o conteúdo (dados) e desenha; com dry=true só mede a altura.
function riDesenhar(c, d, dry){
  let y = RI_M;
  if(!dry){ c.fillStyle = RI.bg; c.fillRect(0, 0, RI_W, d.altura || 100); }
  // cabeçalho
  const tx0 = RI_M;
  riTexto(c, 'BLASTHOLE MANAGER · RELATÓRIO DO REALCE', tx0, y + 10, { tam:13, peso:'700', cor:RI.mut, espaco:2 });
  // nome: diminui a fonte se não couber ao lado da data
  let tamNome = 40; c.font = `700 ${tamNome}px ${RI_FONTE}`;
  while(tamNome > 22 && c.measureText(d.nome).width > RI_W - RI_M - 150 - tx0){ tamNome -= 2; c.font = `700 ${tamNome}px ${RI_FONTE}`; }
  riTexto(c, d.nome, tx0, y + 54, { tam:tamNome, peso:'700' });
  let tx = tx0; const tags = [d.nivel, d.orientacao].concat((d.locais || []).map(l=> 'Local: ' + l)).filter(Boolean);
  for(let i = 0; i < tags.length; i++){
    let t = tags[i]; c.font = `400 15px ${RI_FONTE}`; let w = c.measureText(t).width + 24;
    if(tx + w > RI_W - RI_M){ // não cabe na linha: mostra quantos ficaram de fora
      t = `+${tags.length - i}`; w = c.measureText(t).width + 24;
      if(tx + w > RI_W - RI_M) break;
      if(!dry) riRect(c, tx, y + 68, w, 30, 15, null, RI.line); riTexto(c, t, tx + 12, y + 89, { tam:15 }); break;
    }
    if(!dry) riRect(c, tx, y + 68, w, 30, 15, null, RI.line); riTexto(c, t, tx + 12, y + 89, { tam:15 }); tx += w + 8;
  }
  riTexto(c, d.dataTxt, RI_W - RI_M, y + 12, { tam:15, cor:RI.mut, alinhar:'right' });
  riTexto(c, d.horaTxt, RI_W - RI_M, y + 34, { tam:16, peso:'700', alinhar:'right' });
  if(d.turno) riTexto(c, d.turno, RI_W - RI_M, y + 56, { tam:15, cor:RI.mut, alinhar:'right' });
  y += 116; if(!dry){ c.fillStyle = RI.line; c.fillRect(RI_M, y, RI_W - 2*RI_M, 2); } y += 20;
  // KPIs
  const kw = (RI_W - 2*RI_M - 14) / 2;
  [[d.pPerf, 'perfilado', d.perf, d.total, RI.per], [d.pTopo, 'topografado', d.topo, d.total, RI.top]].forEach((k, i)=>{
    const x = RI_M + i * (kw + 14);
    if(!dry){ riRect(c, x, y, kw, 92, 14, RI.card, RI.line);
      riTexto(c, k[0] + '%', x + 18, y + 48, { tam:34, peso:'700' });
      c.font = `700 34px ${RI_FONTE}`; const w = c.measureText(k[0] + '%').width;
      riTexto(c, `${k[1]} · ${k[2]}/${k[3]} furos`, x + 18 + w + 8, y + 48, { tam:15, cor:RI.mut });
      riRect(c, x + 18, y + 62, kw - 36, 14, 7, RI.nada); if(k[0] > 0) riRect(c, x + 18, y + 62, Math.max(14, (kw - 36) * k[0] / 100), 14, 7, k[4]); }
  });
  y += 92 + 8;
  // leques
  riTexto(c, 'LEQUES', RI_M, y + 24, { tam:14, peso:'700', cor:RI.mut, espaco:2 }); y += 36;
  const larg = RI_W - 2*RI_M, areaCelulas = larg - 74 - 170 - 40, cel = 26, gap = 5, porLinha = Math.max(1, Math.floor((areaCelulas + gap) / (cel + gap)));
  d.leques.forEach(l=>{
    const linhas = Math.max(1, Math.ceil(l.furos.length / porLinha)), h = Math.max(62, linhas * (cel + gap) + 24);
    if(!dry){
      riRect(c, RI_M, y, larg, h, 12, RI.card, RI.line);
      c.save(); c.beginPath(); c.roundRect(RI_M, y, larg, h, 12); c.clip(); c.fillStyle = l.cor; c.fillRect(RI_M, y, 8, h); c.restore();
      riTexto(c, l.codigo, RI_M + 24, y + h/2 + 8, { tam:22, peso:'700' });
      l.furos.forEach((f, i)=>{
        const cx = RI_M + 24 + 74 + (i % porLinha) * (cel + gap), cy = y + 12 + Math.floor(i / porLinha) * (cel + gap);
        if(f.estado === 'obs') riRect(c, cx, cy, cel, cel, 6, RI.obs);
        else if(f.estado === 'ok') riRect(c, cx, cy, cel, cel, 6, RI.ok);
        else if(f.estado === 'p' || f.estado === 't'){ riRect(c, cx, cy, cel, cel, 6, RI.nada); c.save(); c.beginPath(); c.roundRect(cx, cy, cel, cel, 6); c.clip();
          c.fillStyle = f.estado === 'p' ? RI.sp : RI.top; c.beginPath();
          if(f.estado === 'p'){ c.moveTo(cx, cy); c.lineTo(cx + cel, cy); c.lineTo(cx, cy + cel); } else { c.moveTo(cx + cel, cy); c.lineTo(cx + cel, cy + cel); c.lineTo(cx, cy + cel); }
          c.closePath(); c.fill(); c.restore(); }
        else riRect(c, cx, cy, cel, cel, 6, RI.nada);
      });
      riTexto(c, l.rotulo, RI_M + larg - 18, y + h/2 - 2, { tam:17, peso:'700', alinhar:'right' });
      riTexto(c, l.sub, RI_M + larg - 18, y + h/2 + 20, { tam:15, cor:RI.mut, alinhar:'right' });
    }
    y += h + 10;
  });
  // legenda
  if(!dry){ let lx = RI_M; [['ok','perfilado + topografado'],['p','só perfilado'],['t','só topografado'],['obs','obstruído'],['n','pendente']].forEach(([est, t])=>{
    const cx = lx, cy = y + 2, w = 14;
    if(est === 'ok') riRect(c, cx, cy, w, w, 4, RI.ok); else if(est === 'obs') riRect(c, cx, cy, w, w, 4, RI.obs); else riRect(c, cx, cy, w, w, 4, RI.nada);
    if(est === 'p' || est === 't'){ c.save(); c.beginPath(); c.roundRect(cx, cy, w, w, 4); c.clip(); c.fillStyle = est === 'p' ? RI.sp : RI.top; c.beginPath();
      if(est === 'p'){ c.moveTo(cx, cy); c.lineTo(cx + w, cy); c.lineTo(cx, cy + w); } else { c.moveTo(cx + w, cy); c.lineTo(cx + w, cy + w); c.lineTo(cx, cy + w); }
      c.closePath(); c.fill(); c.restore(); }
    c.font = `400 14px ${RI_FONTE}`; riTexto(c, t, lx + 20, y + 14, { tam:14, cor:RI.mut }); lx += 20 + c.measureText(t).width + 16; }); }
  y += 24;
  // seções de texto
  const caixa = (titulo, linhasTxt, corDestaque)=>{
    if(!linhasTxt.length) return;
    riTexto(c, titulo, RI_M, y + 24, { tam:14, peso:'700', cor:RI.mut, espaco:2 }); y += 36;
    const alt = linhasTxt.length * 28 + 20;
    if(!dry){ riRect(c, RI_M, y, larg, alt, 12, RI.card, RI.line); linhasTxt.forEach((t, i)=> riTexto(c, t.txt, RI_M + 16, y + 30 + i * 28, { tam:17, peso:t.peso || '400', cor:t.cor || RI.txt })); }
    y += alt + 14;
  };
  const falta = []; d.faltam.forEach(f=>{
    falta.push({ txt:`${f.codigo}`, peso:'700' });
    riQuebrar(c, ['perfilar: ' + (f.perf.join(', ') || 'completo'), 'topografar: ' + (f.topo.join(', ') || 'completo')], larg - 32, 17).forEach(t=> falta.push({ txt:'    ' + t, cor:RI.and }));
  });
  caixa('O QUE FALTA (LEQUES EM ANDAMENTO)', falta);
  // metragens
  if(d.metragens.length){
    riTexto(c, 'METRAGENS (ESPERADA × REAL)', RI_M, y + 24, { tam:14, peso:'700', cor:RI.mut, espaco:2 }); y += 36;
    const alt = 44 + (d.metragens.length + 1) * 38;
    if(!dry){ riRect(c, RI_M, y, larg, alt, 12, RI.card, RI.line);
      [['LEQUE', 0, 'left'], ['ESPERADA', 0.47, 'right'], ['REAL', 0.7, 'right'], ['VARIAÇÃO', 1, 'right']].forEach(([t, p, a])=> riTexto(c, t, a === 'left' ? RI_M + 16 : RI_M + 16 + (larg - 32) * p, y + 28, { tam:13, cor:RI.mut, alinhar:a, espaco:1 }));
      d.metragens.concat([d.metTotal]).forEach((m, i)=>{ const yy = y + 44 + i * 38 + 24, tot = i === d.metragens.length, peso = tot ? '700' : '400';
        riTexto(c, m.codigo, RI_M + 16, yy, { tam:17, peso:'700' });
        riTexto(c, m.esp, RI_M + 16 + (larg - 32) * 0.47, yy, { tam:17, peso, alinhar:'right' });
        riTexto(c, m.real, RI_M + 16 + (larg - 32) * 0.7, yy, { tam:17, peso, alinhar:'right' });
        riTexto(c, m.var, RI_M + 16 + (larg - 32), yy, { tam:17, peso, alinhar:'right', cor:m.cor || RI.txt }); }); }
    y += alt + 14;
  }
  // fotos
  if(d.fotos.length){
    riTexto(c, 'FOTOS', RI_M, y + 24, { tam:14, peso:'700', cor:RI.mut, espaco:2 }); y += 36;
    const fw = (larg - 24) / 3, fh = 150, th = fh + 48;
    d.fotos.forEach((f, i)=>{
      const fx = RI_M + (i % 3) * (fw + 12), fy = y + Math.floor(i / 3) * (th + 12);
      if(!dry){ riRect(c, fx, fy, fw, th, 12, RI.card, RI.line);
        c.save(); c.beginPath(); c.roundRect(fx, fy, fw, fh, [12, 12, 0, 0]); c.clip();
        if(f.img){ const s = Math.max(fw / f.img.width, fh / f.img.height), iw = f.img.width * s, ih = f.img.height * s; c.drawImage(f.img, fx + (fw - iw)/2, fy + (fh - ih)/2, iw, ih); }
        else { c.fillStyle = '#1c2531'; c.fillRect(fx, fy, fw, fh); riTexto(c, 'foto não carregada', fx + fw/2, fy + fh/2, { tam:14, cor:RI.mut, alinhar:'center' }); }
        c.restore();
        riTexto(c, f.codigo, fx + 12, fy + fh + 22, { tam:16, peso:'700' });
        if(f.nota) riTexto(c, f.nota.length > 26 ? f.nota.slice(0, 25) + '…' : f.nota, fx + 12, fy + fh + 40, { tam:13, cor:RI.mut }); }
    });
    y += Math.ceil(d.fotos.length / 3) * (th + 12);
    if(d.fotosExtra) { riTexto(c, `+ ${d.fotosExtra} foto(s) não mostradas (use "Enviar fotos")`, RI_M, y + 14, { tam:14, cor:RI.mut }); y += 26; }
  }
  // rodapé
  y += 8; if(!dry){ c.fillStyle = RI.line; c.fillRect(RI_M, y, larg, 2); riTexto(c, d.rodapeEsq, RI_M, y + 28, { tam:14, cor:RI.mut }); riTexto(c, 'Trust Soluções Geológicas', RI_M + larg, y + 28, { tam:14, cor:RI.mut, alinhar:'right' }); }
  return y + 28 + RI_M;
}

async function riMontarDados(anelId, simples){
  const anel = aneis.find(a=>a.id === anelId); if(!anel) return null;
  const itens = checklistDoAnel(anelId).slice().sort((a,b)=> (PREFIXO[a.tipo]+a.numero).localeCompare(PREFIXO[b.tipo]+b.numero, undefined, { numeric:true }));
  const todos = []; let perf = 0, topo = 0;
  const cartoes = [], faltam = [], obstruidos = [], fotosLista = [];
  const ROT = { ok:'✓ Completo', and:'Em andamento', ini:'Não iniciado', obs:'Obstrução alta' }, COR = { ok:RI.ok, and:RI.and, ini:RI.nada, obs:RI.obs };
  itens.forEach(c=>{
    const fl = checklistFurosDoLeque(c.id).slice().sort((a,b)=> String(a.numero).localeCompare(String(b.numero), undefined, { numeric:true }));
    const p = fl.filter(f=>f.perfilado).length, t = fl.filter(f=>f.topografado).length, ob = fl.filter(f=>f.obstruido).length, est = estadoDoLeque(fl);
    perf += p; topo += t; todos.push(...fl);
    const codigo = PREFIXO[c.tipo] + c.numero;
    cartoes.push({ codigo, cor:COR[est], rotulo:ROT[est], sub: fl.length ? `${p}/${fl.length} · ${t}/${fl.length}` + (ob ? `  ⛔ ${ob}` : '') : 'sem furos',
      furos: fl.map(f=> ({ estado: f.obstruido ? 'obs' : (f.perfilado && f.topografado) ? 'ok' : f.perfilado ? 'p' : f.topografado ? 't' : 'n' })) });
    if(fl.length && est !== 'ok' && fl.some(f=>f.perfilado || f.topografado)){
      const ut = fl.filter(f=>!f.obstruido);
      faltam.push({ codigo, perf: riCompactar(ut.filter(f=>!f.perfilado).map(f=>f.numero)), topo: riCompactar(ut.filter(f=>!f.topografado).map(f=>f.numero)) });
    }
    fl.filter(f=>f.obstruido).forEach(f=> obstruidos.push(`${codigo} F${f.numero}${f.obstruidoMotivo ? ' — ' + f.obstruidoMotivo : ''}`));
    fl.filter(f=> f.fotoUrl || (typeof fotosPendentes !== 'undefined' && fotosPendentes.has(f.id))).forEach(f=> fotosLista.push({ f, codigo: `${codigo} F${f.numero}`, nota: f.observacao || '' }));
  });
  // metragens (Perfilagem)
  const metragens = []; let tE = 0, tR = 0;
  if(!simples) leques.filter(l=>l.anelId === anelId).sort((a,b)=> lequeCode(a).localeCompare(lequeCode(b), undefined, { numeric:true })).forEach(l=>{
    const fl = furos.filter(f=>f.lequeId === l.id); if(!fl.length) return;
    const e = fl.reduce((s,f)=>s + Number(f.metragemEsperada || 0), 0), r = fl.reduce((s,f)=>s + Number(f.metragemReal || 0), 0);
    const sem = fl.filter(f=> f.situacao !== 'obstruido' && !(Number(f.metragemReal) > 0)).length; tE += e; tR += r;
    metragens.push({ codigo: lequeCode(l), esp: riVir(e), real: riVir(r), var: sem ? `${sem} sem metragem` : (r - e > 0 ? '+' : '') + riVir(r - e), cor: sem ? RI.mut : (r - e) < 0 ? RI.obs : RI.ok });
  });
  const fotos = []; const MAXF = 12;
  if(!simples) for(const it of fotosLista.slice(0, MAXF)) fotos.push({ codigo: it.codigo, nota: it.nota, img: await riCarregarFoto(it.f) });
  const agora = new Date(), tot = todos.length;
  const locais = [...new Set(itens.map(c=>(c.localizacao || '').trim()).filter(Boolean))];
  return { nome: anel.nome, nivel: anel.nivel || '', locais, orientacao: anel.orientacao === 'ascendente' ? '↑ Ascendente' : anel.orientacao === 'descendente' ? '↓ Descendente' : '',
    dataTxt: agora.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' }), horaTxt: agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
    turno: (turnoInfo.turnoNumero || turnoInfo.turnoLetra) ? `Turno ${turnoInfo.turnoNumero || ''}${turnoInfo.turnoLetra || ''}`.trim() : '',
    perf, topo, total: tot, pPerf: tot ? Math.round(perf / tot * 100) : 0, pTopo: tot ? Math.round(topo / tot * 100) : 0,
    leques: cartoes, faltam, obstruidos, metragens, metTotal: { codigo:'Total', esp: riVir(tE), real: riVir(tR), var: '' }, fotos, fotosExtra: simples ? 0 : Math.max(0, fotosLista.length - MAXF),
    rodapeEsq: '' };
}

async function gerarImagemRealce(anelId, simples, escalaFixa){
  const d = await riMontarDados(anelId, simples); if(!d) return null;
  const medir = document.createElement('canvas').getContext('2d');
  const alt = Math.ceil(riDesenhar(medir, d, true));
  const escala = escalaFixa || (alt * 2 > 14000 ? 1.5 : 2);
  const cv = document.createElement('canvas'); cv.width = RI_W * escala; cv.height = Math.round(alt * escala);
  const c = cv.getContext('2d'); c.scale(escala, escala); d.altura = alt;
  riDesenhar(c, d, false);
  const blob = await new Promise(r=> cv.toBlob(r, 'image/png'));
  return { blob, nome: d.nome, cv };
}

// Abre uma janela com a prévia da imagem do relatório e os botões Baixar / Enviar (igual ao resumo semanal).
async function enviarImagemRealce(anelId){
  const anel = aneis.find(a=>a.id === anelId); if(!anel) return;
  showToast('Gerando a imagem do relatório…');
  let img;
  try{ img = await gerarImagemRealce(anelId); }catch(e){ showToast('Não consegui gerar a imagem.', { tipo:'erro' }); return; }
  if(!img || !img.blob){ showToast('Não consegui gerar a imagem.', { tipo:'erro' }); return; }
  const nomeArq = `relatorio-${String(anel.nome).replace(/[^\w-]+/g, '_')}.png`;
  const arq = new File([img.blob], nomeArq, { type:'image/png' });
  const url = URL.createObjectURL(img.blob), root = el('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box modal-box-larga resumo-sem-box">
        <p style="font-weight:700;margin:0 0 10px;">Relatório do realce · ${escHtml(anel.nome)}</p>
        <div class="resumo-sem-previa"><img src="${url}" alt="relatório do realce ${escHtml(anel.nome)}" style="display:block;width:100%;height:auto;"></div>
        <div class="modal-actions resumo-sem-acoes" style="margin-top:12px;">
          <button type="button" class="steel" id="ri-baixar">Baixar imagem</button>
          <button type="button" class="steel" id="ri-enviar">Enviar imagem</button>
          <button type="button" class="ghost" id="ri-fechar">Fechar</button>
        </div>
      </div>
    </div>`;
  const fechar = ()=>{ root.innerHTML = ''; setTimeout(()=> URL.revokeObjectURL(url), 4000); };
  el('modal-overlay').addEventListener('click', ev=>{ if(ev.target.id === 'modal-overlay') fechar(); });
  el('ri-fechar').addEventListener('click', fechar);
  el('ri-baixar').addEventListener('click', ()=>{
    const a = document.createElement('a'); a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click(); a.remove();
    showToast('Imagem baixada: ' + nomeArq, { tipo:'ok' });
  });
  el('ri-enviar').addEventListener('click', async ()=>{
    if(navigator.canShare && navigator.canShare({ files:[arq] })){
      try{ await navigator.share({ files:[arq], text: `Relatório do ${anel.nome}` }); }
      catch(e){ if(e && e.name !== 'AbortError') showToast('Não foi possível abrir o compartilhamento.', { tipo:'aviso' }); }
      return;
    }
    const a = document.createElement('a'); a.href = url; a.download = nomeArq; document.body.appendChild(a); a.click(); a.remove();
    abrirWhatsApp(configApp.whatsapp ? `https://wa.me/${configApp.whatsapp}` : 'https://wa.me/');
    showToast('Imagem baixada. Anexe no WhatsApp que abriu.', { tipo:'ok' });
  });
}
