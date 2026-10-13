// ---------- Importar leques e furos de um PDF (tabela com quantidade de furos e metragem esperada) ----------
// Lê o texto do PDF (pdf.js, carregado só quando precisa), reconhece linhas "LQ01 ... 8 ... 45,5" e mostra uma
// tela de conferência. Nada vai para o checklist antes de a pessoa confirmar.
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const RE_LEQUE_PDF = /\b(LQ|SL|FL|CR|INV|AUX)\s*[-_.]?\s*0*(\d+)\b/i;
let importacaoPdf = null; // { itens, anelId, origem }

function carregarPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  const tentar = ()=> new Promise((ok, falha)=>{
    const s = document.createElement('script'); s.src = PDFJS_URL;
    s.onload = ()=>{ try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); }catch(e){ falha(e); } };
    s.onerror = ()=>{ s.remove(); falha(new Error('sem conexão para carregar o leitor de PDF')); };
    document.head.appendChild(s);
  });
  return tentar().catch(()=> new Promise(r=>setTimeout(r, 800)).then(tentar)); // uma segunda tentativa: o sinal na mina oscila
}
// Texto do PDF em linhas: junta os pedaços que estão na mesma altura, da esquerda para a direita.
async function lerLinhasPdf(buffer){
  const lib = await carregarPdfJs();
  const doc = await lib.getDocument({ data: buffer }).promise;
  const linhas = [];
  for(let p = 1; p <= doc.numPages; p++){
    const pagina = await doc.getPage(p), txt = await pagina.getTextContent();
    const grupos = [];
    txt.items.filter(i=>i.str && i.str.trim()).forEach(i=>{
      const y = i.transform[5], x = i.transform[4];
      let g = grupos.find(g=> Math.abs(g.y - y) <= 3);
      if(!g){ g = { y, it: [] }; grupos.push(g); }
      g.it.push({ x, s: i.str.trim() });
    });
    grupos.sort((a,b)=> b.y - a.y).forEach(g=> linhas.push(g.it.sort((a,b)=>a.x - b.x).map(i=>i.s).join('  ')));
  }
  return linhas;
}
const numPdf = t => parseFloat(String(t).replace(/\./g, m=>'.').replace(',', '.'));
// Interpreta as linhas. Aceita: uma linha por leque ("LQ01  8  45,5" ou com uma metragem por furo)
// e uma linha por furo ("LQ01  F3  45,5"). Tudo vai para a conferência, nada é gravado aqui.
// Layout de projeto real: uma página por leque ("Leque  SL1  RING ...", "N° Furos  15") e uma tabela
// "Furo  Diam  Comp. (m)  Inclinação ...". A metragem esperada é a coluna Comp. (m).
function interpretarProjetoPorLeque(linhas){
  const reCab = /^\s*Leque\s+(LQ|SL|FL|CR|INV|AUX)\s*[-_.]?\s*0*(\d+)\b/i;
  const reFuro = /^\s*(\d{1,3})\s+(\d+(?:[.,]\d+)?)\s+(\d+[.,]\d+)(?=\s|$)/;
  const tipoDe = pref => Object.keys(PREFIXO).find(t=> PREFIXO[t].toLowerCase() === pref.toLowerCase());
  const itens = []; let atual = null, ultimo = 0;
  linhas.forEach(linha=>{
    const c = linha.match(reCab);
    if(c){
      const tipo = tipoDe(c[1]); atual = null;
      if(tipo){ atual = { tipo, numero: normalizarNumero(String(parseInt(c[2], 10))), furos: [], aviso: '', esperado: 0, origem: linha.trim() }; itens.push(atual); ultimo = 0; }
      return;
    }
    if(!atual) return;
    const q = linha.match(/N[°ºo]?\s*Furos\s+(\d+)/i); if(q){ atual.esperado = parseInt(q[1], 10); return; }
    const f = linha.match(reFuro); if(!f) return;
    const n = parseInt(f[1], 10), metros = numPdf(f[3]);
    if(n <= ultimo || !(metros > 0)) return; // ruído (totais, escala, cabeçalhos)
    ultimo = n; atual.furos.push({ numero: normalizarNumero(String(n)), metros });
  });
  const ok = itens.filter(i=>i.furos.length);
  ok.forEach(i=>{ if(i.esperado && i.esperado !== i.furos.length) i.aviso = `o projeto diz ${i.esperado} furos, li ${i.furos.length}: confira`; });
  return ok;
}
function interpretarLinhasPlano(linhas){
  const real = interpretarProjetoPorLeque(linhas);
  if(real.length) return real;
  const mapa = new Map(); // "LQ|01" -> item
  const pega = (tipo, numero, linha)=>{
    const k = tipo + '|' + numero;
    if(!mapa.has(k)) mapa.set(k, { tipo, numero, furos: new Map(), qtd: 0, metros: [], origem: [], aviso: '' });
    const it = mapa.get(k); it.origem.push(linha); return it;
  };
  const tipoDe = pref => Object.keys(PREFIXO).find(t=> PREFIXO[t].toLowerCase() === pref.toLowerCase());
  linhas.forEach(linha=>{
    const m = linha.match(RE_LEQUE_PDF); if(!m) return;
    const tipo = tipoDe(m[1]); if(!tipo) return;
    const numero = normalizarNumero(String(parseInt(m[2], 10)));
    const resto = linha.slice(m.index + m[0].length);
    const fm = resto.match(/\b(?:F|furo)\s*0*(\d+)\b/i);
    const nums = (resto.replace(fm ? fm[0] : '', ' ').match(/\d+(?:[.,]\d+)?/g) || []).map(numPdf).filter(n=>!isNaN(n));
    const it = pega(tipo, numero, linha.trim());
    if(fm){ // uma linha por furo
      const metr = nums.length ? nums[nums.length - 1] : 0;
      it.furos.set(normalizarNumero(String(parseInt(fm[1], 10))), metr > 0 ? metr : 0);
      return;
    }
    if(!nums.length) return;
    const inteiros = nums.filter(n=> Number.isInteger(n));
    if(nums.length === 1){
      const n = nums[0];
      if(Number.isInteger(n) && n <= 60 && !/[.,]\d/.test(resto)) it.qtd = n; else it.metros.push(n); // 1 número solto: quantidade (pequena e inteira) ou metragem
      return;
    }
    // vários números: o primeiro inteiro é a quantidade; o resto são metragens
    const q = nums[0];
    if(Number.isInteger(q) && q >= 1 && q <= 60){ it.qtd = q; it.metros = nums.slice(1).filter(n=>n > 0); }
    else it.metros = nums.filter(n=>n > 0);
  });
  const itens = [];
  mapa.forEach(it=>{
    let furos = []; // [{numero, metros}]
    if(it.furos.size){
      furos = [...it.furos.entries()].map(([numero, metros])=>({ numero, metros })).sort((a,b)=> parseInt(a.numero,10) - parseInt(b.numero,10));
    }else{
      let qtd = it.qtd || (it.metros.length > 1 ? it.metros.length : 0);
      if(!qtd && it.metros.length === 1){ qtd = 1; it.aviso = 'quantidade de furos não encontrada: confira'; }
      for(let n = 1; n <= qtd; n++){
        let metros = it.metros.length === 1 ? it.metros[0] : (it.metros.length === qtd ? it.metros[n - 1] : 0);
        furos.push({ numero: normalizarNumero(String(n)), metros });
      }
      if(it.metros.length > 1 && it.metros.length !== qtd) it.aviso = `${it.metros.length} metragens para ${qtd} furos: confira`;
    }
    if(!furos.length) return;
    itens.push({ tipo: it.tipo, numero: it.numero, furos, aviso: it.aviso, origem: it.origem.join(' ⏎ ') });
  });
  return itens.sort((a,b)=> a.tipo.localeCompare(b.tipo) || parseInt(a.numero, 10) - parseInt(b.numero, 10));
}

// ---- fluxo de tela ----
function abrirImportarPdf(){
  if(!exigirGestor('importar leques e furos de um PDF')) return;
  const a = aneis.find(x=>x.id === anelAtivoId);
  if(!a){ showToast('Selecione um realce primeiro.'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = ()=>{ if(inp.files && inp.files[0]) importarPdfArquivo(inp.files[0]); };
  inp.click();
}
// Botão "Criar leques do plano" no realce: usa o PDF já anexado (do aparelho ou do servidor).
async function criarLequesDoPlano(anelId){
  if(!exigirGestor('criar leques a partir do plano')) return;
  const a = aneis.find(x=>x.id === anelId);
  if(!a || !a.planoPath){ showToast('Anexe o plano de perfuração a este realce primeiro.', { tipo:'aviso' }); return; }
  try{ const blob = await obterPlano(a); await importarPdfArquivo(blob, a.id); }catch(e){ showToast(e.message || 'Não consegui abrir o plano.', { erro:true }); }
}
// Logo depois de anexar um plano: pergunta se já quer ler e criar os leques (só abre a conferência).
function sugerirCriarLeques(anelId, arq){
  const root = el('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">
    <p style="font-weight:700;margin:0 0 6px;">Plano anexado</p>
    <p class="hint" style="margin:0 0 12px;">Quer que eu leia o PDF e monte os leques e furos deste realce? Você confere tudo antes de gravar.</p>
    <div class="modal-actions"><button type="button" class="steel" id="sg-ler">🧩 Criar leques do plano</button><button type="button" class="ghost" id="sg-x">Agora não</button></div></div></div>`;
  el('sg-x').onclick = ()=>{ root.innerHTML = ''; };
  el('sg-ler').onclick = ()=>{ root.innerHTML = ''; importarPdfArquivo(arq, anelId); };
}
async function importarPlanoAnexado(){
  const a = aneis.find(x=>x.id === anelAtivoId);
  if(!a || !a.planoPath){ showToast('Este realce não tem plano anexado.', { tipo:'aviso' }); return; }
  try{ const blob = await obterPlano(a); await importarPdfArquivo(blob); }catch(e){ showToast(e.message || 'Não consegui abrir o plano.', { erro:true }); }
}
async function importarPdfArquivo(arq, anelId){
  anelId = anelId || anelAtivoId;
  showToast('Lendo o PDF…', { erro:false });
  let linhas;
  try{ linhas = await lerLinhasPdf(await arq.arrayBuffer()); }
  catch(e){ showToast('Não consegui ler o PDF: ' + (e && e.message ? e.message : 'tente de novo') + '. Precisa de internet para abrir o leitor na primeira vez.', { erro:true }); return; }
  const itens = interpretarLinhasPlano(linhas);
  if(!itens.length){ showToast(linhas.length ? 'Não encontrei leques nesse PDF (procurei linhas como "LQ01 … 8 … 45,5"). Se for um PDF escaneado ou só desenho, a leitura automática não funciona.' : 'O PDF não tem texto para ler (parece escaneado).', { erro:true }); return; }
  importacaoPdf = { itens, anelId };
  mostrarConferenciaPdf();
}
const fmtMetrosPdf = n => String(n).replace('.', ',');
function textoMetrosItem(it){
  const v = it.furos.map(f=>f.metros || 0);
  if(v.every(x=>x === v[0])) return v[0] ? fmtMetrosPdf(v[0]) : '';
  return v.map(fmtMetrosPdf).join('; ');
}
function mostrarConferenciaPdf(){
  const { itens, anelId } = importacaoPdf, e2 = escHtml;
  const existe = it => checklistLeques.some(c=>c.anelId === anelId && c.tipo === it.tipo && c.numero === it.numero && !(c.localizacao || '').trim());
  const linhas = itens.map((it, i)=>{
    const ja = existe(it);
    return `<tr data-i="${i}" class="${ja ? 'ja' : ''}"><td><input type="checkbox" class="imp-sel" ${ja ? '' : 'checked'} aria-label="importar ${PREFIXO[it.tipo]}${e2(it.numero)}"></td>
      <td><b>${PREFIXO[it.tipo]}${e2(it.numero)}</b>${ja ? '<small class="imp-ja">já existe</small>' : ''}</td>
      <td><input type="text" inputmode="numeric" class="imp-qtd" value="${it.furos.length}" aria-label="quantidade de furos"></td>
      <td><input type="text" inputmode="decimal" class="imp-met" value="${e2(textoMetrosItem(it))}" placeholder="m" aria-label="metragem esperada por furo"></td></tr>
      ${it.aviso ? `<tr class="imp-av"><td></td><td colspan="3">⚠ ${e2(it.aviso)}</td></tr>` : ''}`;
  }).join('');
  const totFuros = itens.reduce((s, it)=> s + it.furos.length, 0);
  el('modal-root').innerHTML = `
    <div class="modal-overlay" id="modal-overlay"><div class="modal-box modal-box-larga imp-box">
      <p style="font-weight:700;margin:0 0 4px;">Importar do PDF · conferir antes de gravar</p>
      <p class="hint" style="margin:0 0 10px;">Achei <b>${itens.length}</b> leque(s) e <b>${totFuros}</b> furo(s). Metragem: um número vale para todos os furos do leque; ou escreva uma por furo, separadas por ponto e vírgula (ex.: 45,5; 46; 44).</p>
      <div class="imp-tab"><table><thead><tr><th></th><th>Leque</th><th>Furos</th><th>Esperada (m)</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <div class="field" style="margin-top:10px;"><label for="imp-local">Localização (opcional, vale para todos)</label><input id="imp-local" type="text" maxlength="120" placeholder="galeria, nível…"></div>
      <div class="modal-actions" style="margin-top:12px;"><button type="button" class="steel" id="imp-ok">Criar no checklist</button><button type="button" class="ghost" id="imp-x">Cancelar</button></div>
    </div></div>`;
  el('imp-x').onclick = ()=>{ el('modal-root').innerHTML = ''; importacaoPdf = null; };
  el('modal-overlay').addEventListener('click', ev=>{ if(ev.target.id === 'modal-overlay') el('imp-x').click(); });
  el('imp-ok').onclick = confirmarImportacaoPdf;
}
function confirmarImportacaoPdf(){
  const { itens, anelId } = importacaoPdf;
  const anel = aneis.find(a=>a.id === anelId); if(!anel) return;
  const local = (el('imp-local').value || '').trim(), chaveLocal = local.toLowerCase();
  const base = Date.now(), regsLeques = [], regsFuros = [];
  let nL = 0, nF = 0, pulados = 0, problema = '';
  document.querySelectorAll('.imp-tab tbody tr[data-i]').forEach(tr=>{
    if(!tr.querySelector('.imp-sel').checked) return;
    const it = itens[parseInt(tr.dataset.i, 10)];
    const qtd = parseInt(tr.querySelector('.imp-qtd').value, 10);
    if(isNaN(qtd) || qtd < 1 || qtd > 200){ problema = `Confira a quantidade de furos de ${PREFIXO[it.tipo]}${it.numero}.`; return; }
    const txt = tr.querySelector('.imp-met').value.trim();
    const lista = txt ? txt.split(';').map(s=>numPdf(s.trim())).filter(n=>!isNaN(n)) : [];
    if(lista.length > 1 && lista.length !== qtd){ problema = `${PREFIXO[it.tipo]}${it.numero}: ${lista.length} metragens para ${qtd} furos.`; return; }
    if(checklistLeques.some(c=>c.anelId === anelId && c.tipo === it.tipo && c.numero === it.numero && (c.localizacao||'').trim().toLowerCase() === chaveLocal)){ pulados++; return; }
    const id = uuidv4(), ts = new Date(base + nL).toISOString();
    checklistLeques.push({ id, anelId, tipo: it.tipo, numero: it.numero, perfilado: false, observacao: '', localizacao: local, ts });
    CARDS_NOVOS.add(id);
    regsLeques.push({ id, anel_id: anelId, tipo: it.tipo, numero: it.numero, perfilado: false, localizacao: local || null, criado_em: ts });
    for(let n = 1; n <= qtd; n++){
      const fid = uuidv4(), num = normalizarNumero(String(n)), tsF = new Date(base + 100000 + regsFuros.length).toISOString();
      const m = lista.length === 1 ? lista[0] : (lista.length === qtd ? lista[n - 1] : null);
      const metr = m != null && m > 0 ? m : null;
      checklistFuros.push({ id: fid, checklistLequeId: id, numero: num, perfilado: false, topografado: false, perfiladoEm: null, topografadoEm: null, obstruido: '', metragemEsperada: metr, ts: tsF });
      const reg = { id: fid, checklist_leque_id: id, numero: num, perfilado: false, topografado: false, criado_em: tsF }; if(metr != null) reg.metragem_esperada = metr;
      regsFuros.push(reg); nF++;
    }
    nL++;
  });
  if(problema){ checklistLeques = checklistLeques.filter(c=> !regsLeques.some(r=>r.id === c.id)); checklistFuros = checklistFuros.filter(f=> !regsFuros.some(r=>r.id === f.id)); showToast(problema, { erro:false }); return; }
  if(!regsLeques.length){ showToast(pulados ? 'Nada novo: esses leques já estão no checklist.' : 'Nenhum leque marcado para importar.', { erro:false }); return; }
  inserirLequesEFuros(regsLeques, regsFuros);
  salvarChecklistLocal(); salvarChecklistFurosLocal(); renderChecklist();
  el('modal-root').innerHTML = ''; importacaoPdf = null;
  if(anelId !== anelAtivoId){ anelAtivoId = anelId; salvarLocal(); }
  try{ mostrarView('checklist'); renderAll(); }catch(e){}
  showToast(`${nL} leque(s) e ${nF} furo(s) importado(s) do PDF.${pulados ? ' (' + pulados + ' já existiam)' : ''}`, { tipo:'ok' });
}
// nome do arquivo escolhido no formulário de novo realce
document.addEventListener('change', e=>{
  if(e.target && e.target.id === 'anel-plano'){ const f = e.target.files && e.target.files[0]; const n = el('anel-plano-nome'); if(n) n.textContent = f ? '📎 ' + f.name : 'Anexar plano (PDF)'; }
});
