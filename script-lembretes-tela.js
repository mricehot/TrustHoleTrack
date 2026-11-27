// ---------- Lembretes em tela cheia: título, detalhes longos, leque, prioridade e prazo ----------
let lemForm = null;        // null = fechado; { id } = editando (id vazio = novo)
let lemFiltro = 'pendentes', lemPrio = 'todas', lemBusca = '';
const LEM_PRIO = { alta:'Alta', normal:'Normal', baixa:'Baixa' };
const lemSemAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lemHoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const lemFmtPrazo = p => p ? p.split('-').reverse().join('/') : '';

// Corpo: linhas "SL01 - F01-F02" viram duas colunas (leque | furos); o resto fica como texto.
function lemCorpoHtml(txt){
  const linhas = String(txt || '').replace(/^\s*\n+/, '').replace(/\s+$/, '').split('\n');
  return linhas.map(ln=>{
    const m = ln.match(/^\s*([A-Za-z]{1,4}\s?\d{1,3}[A-Za-z]?)\s*[-–:]\s*(.+)$/);
    if(m) return `<div class="lem-lq"><b>${escapeHtml(m[1].replace(/\s+/g, '').toUpperCase())}</b><span>${escapeHtml(m[2])}</span></div>`;
    return ln.trim() ? `<div class="lem-txt-l">${escapeHtml(ln)}</div>` : '<div class="lem-esp"></div>';
  }).join('');
}
function lemCopiar(id){ const l = lembretes.find(x=>x.id===id); if(!l) return; const txt = (l.titulo ? l.titulo + '\n' : '') + l.texto;
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(()=>showToast('Lembrete copiado.', { tipo:'ok' })).catch(()=>showToast('Não foi possível copiar.', { tipo:'aviso' })); }
function renderLembretesTela(){
  const view = document.getElementById('view-lembretes'); if(!view) return;
  if(lemForm && document.activeElement && view.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && view.dataset.congela === '1') return;
  let root = document.getElementById('lembretes-root');
  if(!root){ root = document.createElement('div'); root.id = 'lembretes-root'; view.appendChild(root); }
  const hoje = lemHoje(), q = lemSemAcento(lemBusca.trim());
  const pend = lembretes.filter(x=>!x.feito), feitos = lembretes.filter(x=>x.feito);
  const venc = pend.filter(x=>x.prazo && x.prazo < hoje).length;
  const ordemPrio = { alta:0, normal:1, baixa:2 };
  let lista = lembretes.filter(l=> (lemFiltro === 'todos' || (lemFiltro === 'pendentes' ? !l.feito : l.feito)) && (lemPrio === 'todas' || l.prioridade === lemPrio)
    && (!q || lemSemAcento(l.titulo + ' ' + l.texto + ' ' + l.alvoRotulo).includes(q)));
  lista.sort((a,b)=> (a.feito - b.feito) || ((ordemPrio[a.prioridade]||1) - (ordemPrio[b.prioridade]||1)) || (String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))) || String(b.ts).localeCompare(String(a.ts)));
  const chip = (k, r, n, atual, fn)=>`<button type="button" class="nota-chip ${atual === k ? 'on' : ''}" onclick="${fn}='${k}';renderLembretesTela()">${r}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  const ed = lemForm && lemForm.id ? lembretes.find(x=>x.id === lemForm.id) : null;
  const f = ed || { titulo:'', texto:'', prioridade:'normal', prazo:'', alvoTipo:'', alvoId:'', alvoRotulo:'' };
  const form = lemForm ? `<div class="lem-form">
    <input type="text" id="lem-titulo" maxlength="200" placeholder="Título (ex.: Conferir azimute do SL07)" value="${escapeHtml(f.titulo)}">
    <textarea id="lem-texto" rows="9" maxlength="2000" placeholder="Detalhes, números, o que decidir, quem falar, passos…">${escapeHtml(f.titulo && f.texto === f.titulo ? '' : f.texto)}</textarea>
    <div class="lem-linha">
      <label>Leque / referência<input type="text" id="lem-ref" maxlength="80" placeholder="ex.: SL07 F3 (opcional)" value="${escapeHtml(f.alvoRotulo)}"></label>
      <label>Prioridade<select id="lem-prio">${Object.entries(LEM_PRIO).map(([k,v])=>`<option value="${k}" ${f.prioridade === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Prazo<input type="date" id="lem-prazo" value="${escapeHtml(f.prazo)}"></label>
    </div>
    <div class="nota-btns"><button type="button" class="ghost" onclick="lemFechar()">Cancelar</button><button type="button" onclick="lemSalvar()">${ed ? 'Salvar alterações' : 'Salvar lembrete'}</button></div></div>` : '';
  const card = l => {
    const atras = !l.feito && l.prazo && l.prazo < hoje, ehHoje = !l.feito && l.prazo === hoje;
    const corpo = l.titulo && l.texto === l.titulo ? '' : l.texto;
    return `<article class="lem-card prio-${l.prioridade} ${l.feito ? 'feito' : ''}" data-id="${l.id}">
      <header><button type="button" class="lb-chk lem-chk" role="checkbox" aria-checked="${l.feito}" onclick="alternarLembrete('${l.id}')" aria-label="${l.feito ? 'Reabrir' : 'Marcar como resolvido'}"></button>
      <h3>${escapeHtml(l.titulo || l.texto.split('\n')[0].slice(0, 80))}</h3>
      <span class="lem-tag p-${l.prioridade}">${LEM_PRIO[l.prioridade] || ''}</span></header>
      ${(l.titulo ? corpo.trim() : l.texto.split('\n').slice(1).join('').trim()) ? `<div class="lem-corpo">${lemCorpoHtml(l.titulo ? corpo : l.texto.split('\n').slice(1).join('\n'))}</div>` : ''}
      <footer><span class="lem-data">Criado ${dataCurtaLembrete(l.ts)}${l.feito && l.feitoEm ? ' · resolvido ' + dataCurtaLembrete(l.feitoEm) : ''}</span>
        ${l.prazo ? `<span class="lem-prazo ${atras ? 'atras' : ehHoje ? 'hoje' : ''}">${atras ? '⚠ venceu ' : ehHoje ? '⏰ hoje · ' : '📅 '}${lemFmtPrazo(l.prazo)}</span>` : ''}
        ${l.alvoTipo ? `<button type="button" class="lb-ir" onclick="irParaAlvoLembrete('${l.id}')">↗ ${escapeHtml(l.alvoRotulo)}</button>` : l.alvoRotulo ? `<span class="lb-ref-chip">${escapeHtml(l.alvoRotulo)}</span>` : ''}
        <span class="lem-acoes"><button type="button" class="ghost" onclick="lemCopiar('${l.id}')">Copiar</button><button type="button" class="ghost" onclick="lemEditar('${l.id}')">Editar</button><button type="button" class="ghost perigo" onclick="lemApagar('${l.id}')">Apagar</button></span></footer></article>`;
  };
  root.innerHTML = `<div class="nota-topo"><h2>Lembretes</h2><span class="hint">${pend.length} pendente${pend.length === 1 ? '' : 's'}${venc ? ` · <b class="lem-venc">${venc} vencido${venc > 1 ? 's' : ''}</b>` : ''}</span></div>
    ${lemForm ? form : '<button type="button" class="nota-add" onclick="lemNovo()">+ Novo lembrete</button>'}
    <div class="lem-filtros"><input type="search" class="nota-busca" placeholder="Buscar por título, detalhe ou leque…" value="${escapeHtml(lemBusca)}" oninput="lemBusca=this.value;clearTimeout(window._lemT);window._lemT=setTimeout(()=>{renderLembretesTela();const i=document.querySelector('#lembretes-root .nota-busca');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},200)">
      <div class="nota-chips">${chip('pendentes','Pendentes',pend.length,lemFiltro,'lemFiltro')}${chip('resolvidos','Resolvidos',feitos.length,lemFiltro,'lemFiltro')}${chip('todos','Todos',lembretes.length,lemFiltro,'lemFiltro')}</div>
      <div class="nota-chips">${chip('todas','Qualquer prioridade',null,lemPrio,'lemPrio')}${chip('alta','Alta',null,lemPrio,'lemPrio')}${chip('normal','Normal',null,lemPrio,'lemPrio')}${chip('baixa','Baixa',null,lemPrio,'lemPrio')}</div></div>
    <div class="lem-grade">${lista.length ? lista.map(card).join('') : `<p class="hint">${q ? 'Nenhum lembrete encontrado.' : lemFiltro === 'pendentes' ? 'Nada pendente. Use "+ Novo lembrete" para guardar o que precisa decidir ou lembrar.' : 'Nada por aqui.'}</p>`}</div>`;
}
function lemNovo(){ lemForm = { id:'' }; renderLembretesTela(); const t = document.getElementById('lem-titulo'); if(t) t.focus(); }
function lemEditar(id){ lemForm = { id }; renderLembretesTela(); const t = document.getElementById('lem-titulo'); if(t){ t.focus(); t.scrollIntoView({ block:'center' }); } }
function lemFechar(){ lemForm = null; renderLembretesTela(); }
function lemApagar(id){ const l = lembretes.find(x=>x.id===id); if(l && confirm('Apagar este lembrete?')) apagarLembrete(id); }
function lemSalvar(){
  const g = i => (document.getElementById(i) || {}).value || '';
  const titulo = g('lem-titulo').trim(), texto = g('lem-texto').trim();
  if(!titulo && !texto){ showToast('Escreva um título ou os detalhes.', { tipo:'aviso' }); return; }
  const ref = g('lem-ref').trim().slice(0, 80); const alvo = { tipo:'', id:'', rotulo: ref };
  const extra = { titulo, prioridade: g('lem-prio') || 'normal', prazo: g('lem-prazo') };
  if(lemForm && lemForm.id) atualizarLembreteCompleto(lemForm.id, { titulo, texto, prioridade: extra.prioridade, prazo: extra.prazo, alvo });
  else adicionarLembrete(texto, ref ? alvo : null, extra);
  lemForm = null; renderLembretesTela();
}
{ const omv = mostrarView; mostrarView = function(v){ const r = omv.apply(this, arguments); document.body.classList.toggle('na-tela-lembretes', v === 'lembretes'); if(v === 'lembretes'){ lemFiltro = 'pendentes'; renderLembretesTela(); } return r; }; }
