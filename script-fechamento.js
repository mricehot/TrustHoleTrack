// ---------- Tratados por mês (aba Tratamento): soma dos metros dos leques tratados, com exportação do fechamento ----------
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const rotuloMes = ym => { const m = MESES_PT[parseInt(ym.slice(5,7),10)-1]; return m.charAt(0).toUpperCase() + m.slice(1) + ' de ' + ym.slice(0,4); };
const fmtDia = iso => iso.slice(8,10) + '/' + iso.slice(5,7);
const fmtMetros = n => (Math.round(Number(n)*10)/10).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 });
const mesesAbertos = new Set();

// Leques tratados agrupados por mês (mês em que foram marcados como tratados), no escopo do projeto ativo.
function tratadosPorMes(){
  const ids = aneis.filter(a=> !configApp.projetoAtivo || !a.projeto || a.projeto === configApp.projetoAtivo).map(a=>a.id);
  const meses = new Map();
  dadosRelatorioTratativa(ids).realces.forEach(r=> r.leques.forEach(l=>{
    if(l.status !== 'Tratado' || !l.tratadoEm) return;
    const ym = l.tratadoEm.slice(0,7), o = meses.get(ym) || { itens:[], metros:0 };
    o.itens.push({ realce:r.realce.nome, codigo:l.codigo, metros:metrosDoLeque(l), data:l.tratadoEm }); o.metros += metrosDoLeque(l); meses.set(ym, o);
  }));
  return new Map([...meses.entries()].sort((a,b)=> b[0].localeCompare(a[0])));
}

function renderFechamento(){
  const view = document.getElementById('view-perfilagem'); if(!view) return;
  let root = document.getElementById('fechamento-root');
  if(!root){
    root = document.createElement('div'); root.id = 'fechamento-root';
    const t = document.getElementById('tratativa-root');
    if(t && t.nextSibling) view.insertBefore(root, t.nextSibling); else view.appendChild(root);
  }
  const meses = tratadosPorMes(), e2 = escHtml, ymHoje = dataISOLocal(new Date()).slice(0,7);
  if(!mesesAbertos.size && meses.size) mesesAbertos.add([...meses.keys()][0]);
  const blocos = [...meses.entries()].map(([ym, m])=>{
    const aberto = mesesAbertos.has(ym), n = m.itens.length;
    const linhas = m.itens.slice().sort((a,b)=> String(a.data).localeCompare(String(b.data))).map(l=>`<li class="env-linha"><span class="env-info"><b>${fmtDia(l.data.slice(0,10))}</b><span class="env-desc">${e2(l.realce)} · ${e2(l.codigo)}</span><span class="env-m">${fmtMetros(l.metros)} m</span></span></li>`).join('');
    return `<section class="env-mes ${aberto ? 'aberto' : ''}">
      <div class="env-mes-topo">
        <button type="button" class="env-mes-cab" onclick="alternarMes('${ym}')" aria-expanded="${aberto}">
          <span class="env-seta">${aberto ? '▾' : '▸'}</span><span class="env-mes-txt"><b>${rotuloMes(ym)}${ym === ymHoje ? ' <i>(atual)</i>' : ''}</b>
          <span class="env-tot">${fmtMetros(m.metros)} m <small>· ${n} ${n === 1 ? 'leque tratado' : 'leques tratados'}</small></span></span></button>
        <button type="button" class="env-exp" onclick="abrirExportarMes('${ym}')" title="exporta o fechamento de ${rotuloMes(ym)}" aria-label="Exportar ${rotuloMes(ym)}">⬇ Exportar</button></div>
      ${aberto ? `<ul class="env-lista">${linhas}</ul>` : ''}</section>`;
  }).join('');
  root.innerHTML = `<div class="env-topo"><h2>Tratados por mês</h2><span class="hint">soma dos metros dos leques tratados</span></div>${blocos || '<div class="trat-vazio">Nenhum leque tratado ainda. Quando você marcar um leque como tratado, ele entra na soma do mês.</div>'}`;
}
function alternarMes(ym){ if(mesesAbertos.has(ym)) mesesAbertos.delete(ym); else mesesAbertos.add(ym); renderFechamento(); }

aoRenderizarTudo(()=> renderFechamento());
