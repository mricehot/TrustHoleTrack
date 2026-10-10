// ---------- Dados do turno (também local, com fila própria) ----------
// A tabela turno_info guarda uma única linha (sobrescrita a cada turno). A coluna `id`
// é do tipo uuid, então precisa ser um UUID de verdade — não pode ser um texto livre
// como 'current', senão o Postgres rejeita com "invalid input syntax for type uuid".
const TURNO_ROW_ID = '00000000-0000-0000-0000-000000000001';
// Supervisor e Projeto eram fixos no código — agora ficam editáveis na aba
// Configurações. Os valores abaixo são só o padrão inicial (os mesmos que já
// estavam no código antes), pra quem já usa o app não ver nada em branco.
const CONFIG_LOCAL_KEY = 'perfilagem-config-app-v1';
let configApp = { supervisor: 'Talles da Silveira', whatsapp: '', projetoAtivo: '' };
function carregarConfigLocal(){
  try{
    const raw = localStorage.getItem(CONFIG_LOCAL_KEY);
    if(raw) configApp = { ...configApp, ...JSON.parse(raw) };
  }catch(e){}
}
function salvarConfigLocal(){
  try{ localStorage.setItem(CONFIG_LOCAL_KEY, JSON.stringify(configApp)); }catch(e){}
}
function renderConfig(){
  const campoSupervisor = el('config-supervisor');
  const campoWhatsapp = el('config-whatsapp');
  if(!campoSupervisor) return;
  campoSupervisor.value = configApp.supervisor;
  if(campoWhatsapp) campoWhatsapp.value = configApp.whatsapp || '';
  renderProjetosConfig();
}
function salvarConfig(){
  configApp.supervisor = el('config-supervisor').value.trim() || configApp.supervisor;
  configApp.whatsapp = el('config-whatsapp').value.replace(/\D/g, ''); // só dígitos
  salvarConfigLocal();
  turnoInfo.supervisor = configApp.supervisor;
  if(el('turno-supervisor')) el('turno-supervisor').value = configApp.supervisor;
  saveTurnoInfo();
  showToast('Configurações salvas.');
}
el('btn-salvar-config').addEventListener('click', salvarConfig);
(function iniciarPrefsUx(){
  const t = el('pref-tela'), v = el('pref-vibrar'); if(!t || !v) return;
  t.checked = !!prefsUx.tela; v.checked = !!prefsUx.vibrar;
  const mg = el('pref-metragem'); if(mg){ mg.checked = !!prefsUx.metragem; mg.addEventListener('change', ()=>{ prefsUx.metragem = mg.checked; salvarPrefsUx(); }); }
  t.addEventListener('change', ()=>{ prefsUx.tela = t.checked; salvarPrefsUx(); atualizarWakeLock(); });
  v.addEventListener('change', ()=>{ prefsUx.vibrar = v.checked; salvarPrefsUx(); if(v.checked) vibrarCurto([12, 40, 12]); });
})();

// O filtro de projeto ativo já aplica na hora, sem precisar clicar em
// "Salvar" — é só uma forma de enxergar a lista, não uma configuração
// que precisa de confirmação.
el('anel-projeto-ativo').addEventListener('change', ()=>{
  configApp.projetoAtivo = el('anel-projeto-ativo').value;
  salvarConfigLocal();
  renderAneisMenu();
  preencherSelectsDeProjeto();
  showToast(configApp.projetoAtivo ? `Mostrando só realces de "${configApp.projetoAtivo}".` : 'Mostrando realces de todos os projetos.');
});

// ---------- Perfil do técnico ----------
function renderPerfilTecnico(){
  if(!usuarioAtual) return;
  const campoEmail = el('tecnico-email');
  const campoNome = el('tecnico-nome');
  if(campoEmail) campoEmail.value = usuarioAtual.email || '';
  if(campoNome) campoNome.value = usuarioAtual.nome || '';
  atualizarAvatarEMeuDia();
}

function iniciaisDe(txt){
  const p = String(txt || '').split(/[\s@._-]+/).filter(Boolean);
  if(!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length-1][0] : '')).toUpperCase();
}
function corDoUsuario(txt){
  let h = 0; for(const c of String(txt||'')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38%)`;
}
function atualizarAvatarEMeuDia(){
  if(!usuarioAtual) return;
  const nome = usuarioAtual.nome || usuarioAtual.email || '';
  const ini = iniciaisDe(nome), cor = corDoUsuario(usuarioAtual.email || nome);
  ['menu-avatar','md-avatar'].forEach(id=>{ const a = el(id); if(a){ a.textContent = ini; a.style.background = cor; } });
  const mn = el('menu-nome'); if(mn) mn.textContent = nome;
  const me = el('menu-email'); if(me) me.textContent = usuarioAtual.nome ? (usuarioAtual.email || '') : '';
  const mdn = el('md-nome'); if(mdn) mdn.textContent = nome;
  const hoje = chaveDia(new Date());
  const eu = nomeDoUsuario();
  const meus = checklistFuros;
  const noDia = iso => iso && chaveDia(iso) === hoje;
  const perf = meus.filter(f=>f.perfilado && f.perfiladoPor === eu && noDia(f.perfiladoEm)).length;
  const topo = meus.filter(f=>f.topografado && f.topografadoPor === eu && noDia(f.topografadoEm)).length;
  const obs = meus.filter(f=>f.obstruido && f.obstruidoPor === eu).length;
  [['md-perf',perf],['md-topo',topo],['md-obs',obs]].forEach(([id,v])=>{ const n = el(id); if(n) n.textContent = v; });
  const sub = el('md-sub'); if(sub) sub.textContent = usuarioAtual.email || '';
  const dica = el('md-dica'); if(dica) dica.textContent = (perf + topo + obs) ? 'Contagem das marcações do checklist feitas por você, com seu nome.' : 'Suas marcações do checklist de hoje aparecem aqui.';
}

async function salvarPerfilTecnico(){
  const novoNome = el('tecnico-nome').value.trim();
  const { data, error } = await db.auth.updateUser({ data: { nome: novoNome } });
  if(error){
    showToast(`Não foi possível salvar: ${error.message}`);
    return;
  }
  usuarioAtual.nome = novoNome;
  salvarSessaoCache(usuarioAtual);
  const labelUsuario = el('usuario-logado-label');
  if(labelUsuario) labelUsuario.textContent = `logado: ${usuarioAtual.nome || usuarioAtual.email}`;
  showToast('Nome atualizado.');
}
el('btn-salvar-perfil').addEventListener('click', salvarPerfilTecnico);

async function alterarSenhaTecnico(){
  const novaSenha = el('tecnico-senha-nova').value;
  const confirmar = el('tecnico-senha-confirmar').value;
  const erro = el('tecnico-senha-erro');
  erro.textContent = '';

  if(!novaSenha || novaSenha.length < 6){
    erro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
    return;
  }
  if(novaSenha !== confirmar){
    erro.textContent = 'As duas senhas precisam ser iguais.';
    return;
  }
  const btn = el('btn-alterar-senha');
  btn.disabled = true;
  const { error } = await db.auth.updateUser({ password: novaSenha });
  btn.disabled = false;
  if(error){
    erro.textContent = `Não foi possível alterar: ${error.message}`;
    return;
  }
  el('tecnico-senha-nova').value = '';
  el('tecnico-senha-confirmar').value = '';
  showToast('Senha alterada com sucesso.');
}
el('btn-alterar-senha').addEventListener('click', alterarSenhaTecnico);
['tecnico-senha-nova','tecnico-senha-confirmar'].forEach(id=>{
  el(id).addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); alterarSenhaTecnico(); } });
});
let turnoInfo = { data:'', turnoNumero:'', turnoLetra:'', tecnicos:'', supervisor:configApp.supervisor, projeto:'', local:'', dds:'' };
let turnoObservacoes = []; // { id, data (ISO), turnoNumero, turnoLetra, texto, ts }
let fotosTurno = []; // { id, data (ISO), turnoNumero, turnoLetra, url, descricao, ts }

function selecionarChip(grupoId, valor){
  document.querySelectorAll('#'+grupoId+' .chip').forEach(chip=>{
    chip.classList.toggle('active', chip.dataset.val === valor);
  });
}

// Converte "DD/MM/AAAA" (formato exibido em tela) para "AAAA-MM-DD" (formato que o
// Postgres/Supabase espera numa coluna `date`). Sem essa conversão, o Postgres tenta
// ler como MM/DD/AAAA e quebra em qualquer dia acima de 12.
function dataBRParaISO(dataBR){
  if(!dataBR) return null;
  const partes = dataBR.split('/');
  if(partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2,'0')}-${dia.padStart(2,'0')}`;
}

// Exibe a data sempre como DD/MM/AAAA, aceitando tanto o formato ISO (novos registros)
// quanto o formato BR (registros antigos, salvos antes desta correção).
function dataParaExibicao(data){
  if(!data) return '-';
  const isoMatch = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return data;
}

function mapObservacao(row){ return { id: row.id, data: row.data, turnoNumero: row.turno_numero, turnoLetra: row.turno_letra, texto: row.texto, ts: row.criado_em }; }
function mapFotoTurno(row){ return { id: row.id, data: row.data, turnoNumero: row.turno_numero, turnoLetra: row.turno_letra, url: row.url, descricao: row.descricao || '', ts: row.criado_em }; }

function carregarObsLocal(){
  try{
    const raw = localStorage.getItem(OBS_LOCAL_KEY);
    turnoObservacoes = raw ? JSON.parse(raw) : [];
  }catch(e){ turnoObservacoes = []; }
}
function salvarObsLocal(){
  try{ localStorage.setItem(OBS_LOCAL_KEY, JSON.stringify(turnoObservacoes)); }catch(e){}
}
function carregarFotosTurnoLocal(){
  try{
    const raw = localStorage.getItem(FOTOS_TURNO_LOCAL_KEY);
    fotosTurno = raw ? JSON.parse(raw) : [];
  }catch(e){ fotosTurno = []; }
}
function salvarFotosTurnoLocal(){
  try{ localStorage.setItem(FOTOS_TURNO_LOCAL_KEY, JSON.stringify(fotosTurno)); }catch(e){}
}


// Mesmo formato de código dos furos perfilados (LQ04F05), só que montado a partir de
// texto digitado à mão, sem precisar existir um leque/furo real por trás.




// Agrupa os furos manuais por leque (LQ04: F01, F05...), igual à lista de furos de
// verdade agrupa por leque — mais fácil de ver o conjunto do que uma lista solta.






// Observações são por turno (mesma data + número + letra) — assim um turno não
// mistura anotações com o turno seguinte, mesmo que o app fique aberto o dia todo.
function observacoesDoTurnoAtual(){
  const dataISO = dataBRParaISO(turnoInfo.data);
  return turnoObservacoes
    .filter(o => o.data === dataISO && o.turnoNumero === turnoInfo.turnoNumero && o.turnoLetra === turnoInfo.turnoLetra)
    .sort((a,b)=> new Date(a.ts) - new Date(b.ts));
}

function renderObservacoesTurno(){
  atualizarContagensTurno();
  const lista = el('obs-list');
  const vazio = el('obs-vazio');
  if(!lista) return;
  const obs = observacoesDoTurnoAtual();
  if(obs.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';
  lista.innerHTML = obs.map(o=>{
    return `
      <div class="obs-item">
        <span class="texto">${escHtml(o.texto)}</span>
        <button class="icon icon-editar" onclick="editarObservacaoTurno('${o.id}')" title="editar">✎</button>
        <button class="icon icon-remover" onclick="removerObservacaoTurno('${o.id}')" title="remover">✕</button>
      </div>
    `;
  }).join('');
}

function adicionarObservacaoTurno(textoPronto, rapida){
  const campo = el('turno-obs-input');
  const texto = (typeof textoPronto === 'string' ? textoPronto : campo.value).trim();
  if(!texto) return;
  const dataISO = dataBRParaISO(turnoInfo.data) || new Date().toISOString().slice(0,10);
  const novoId = uuidv4();
  const novaObs = { id: novoId, data: dataISO, turnoNumero: turnoInfo.turnoNumero, turnoLetra: turnoInfo.turnoLetra, texto, ts: new Date().toISOString() };
  turnoObservacoes.push(novaObs);
  enfileirar('turno_observacoes', 'insert', {
    id: novoId, data: dataISO, turno_numero: turnoInfo.turnoNumero, turno_letra: turnoInfo.turnoLetra, texto
  });
  if(!rapida){ campo.value = ''; campo.focus(); }
  salvarObsLocal();
  renderObservacoesTurno();
  renderResumoTurno();
  try{ const it = document.querySelector('#obs-list .obs-item:last-child'); if(it && !semMovimento()) it.animate([{ opacity:0, transform:'translateY(-8px)' }, { opacity:1, transform:'none' }], { duration:260, easing:'cubic-bezier(.2,.8,.3,1.1)' }); const ct = el('sec-obs-cont'); if(ct && !semMovimento()) ct.animate([{ transform:'scale(1.5)' }, { transform:'none' }], { duration:260 }); }catch(e){}
  if(rapida){
    showToast(`Observação: ${texto}`, { acaoLabel:'Desfazer', onAcao: ()=>{
      turnoObservacoes = turnoObservacoes.filter(o=>o.id!==novoId);
      enfileirar('turno_observacoes', 'delete', { id: novoId });
      salvarObsLocal(); renderObservacoesTurno(); atualizarContagensTurno();
    }});
  }else showToast('Observação adicionada.');
}

function editarObservacaoModal(valorAtual){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Editar observação</p>
          <div class="field" style="margin-bottom:16px;">
            <label for="obs-turno-editar-input">Texto</label>
            <input id="obs-turno-editar-input" type="text" maxlength="300" value="${(valorAtual || '').replace(/"/g,'&quot;')}">
          </div>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Cancelar</button>
            <button class="steel" id="modal-salvar">Salvar</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(null));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(null); });
    const salvar = ()=>{
      const texto = el('obs-turno-editar-input').value.trim();
      if(!texto){ showToast('A observação não pode ficar em branco.'); return; }
      fechar(texto);
    };
    el('modal-salvar').addEventListener('click', salvar);
    el('obs-turno-editar-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    el('obs-turno-editar-input').focus();
  });
}

async function editarObservacaoTurno(id){
  const o = turnoObservacoes.find(x=>x.id===id);
  if(!o) return;
  const novoTexto = await editarObservacaoModal(o.texto);
  if(novoTexto === null || novoTexto === o.texto) return;
  o.texto = novoTexto;
  enfileirar('turno_observacoes', 'update', { id: o.id, texto: novoTexto });
  salvarObsLocal();
  renderObservacoesTurno();
  showToast('Observação atualizada.');
}

async function removerObservacaoTurno(id){
  const o = turnoObservacoes.find(x=>x.id===id);
  if(!o) return;
  if(!(await confirmDialog('Remover esta observação do turno?', 'Remover'))) return;

  turnoObservacoes = turnoObservacoes.filter(o=>o.id!==id);
  enfileirar('turno_observacoes', 'delete', { id });
  salvarObsLocal();
  renderObservacoesTurno();
  showToast('Observação removida.', {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoObservacao(o)
  });
}

function desfazerRemocaoObservacao(obsRemovida){
  if(turnoObservacoes.some(o=>o.id===obsRemovida.id)) return; // já foi restaurado
  turnoObservacoes.push(obsRemovida);
  restaurarNaFila('turno_observacoes', obsRemovida.id, {
    id: obsRemovida.id, data: obsRemovida.data, turno_numero: obsRemovida.turnoNumero,
    turno_letra: obsRemovida.turnoLetra, texto: obsRemovida.texto
  });
  salvarObsLocal();
  renderObservacoesTurno();
  showToast('Observação restaurada.');
}

el('btn-add-obs').addEventListener('click', ()=> adicionarObservacaoTurno());
el('turno-obs-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); adicionarObservacaoTurno(); } });

// ---------- Fotos do turno (algo que aconteceu no turno, sem ser de um leque específico) ----------
function fotosDoTurnoAtual(){
  const dataISO = dataBRParaISO(turnoInfo.data);
  return fotosTurno
    .filter(f => f.data === dataISO && f.turnoNumero === turnoInfo.turnoNumero && f.turnoLetra === turnoInfo.turnoLetra)
    .sort((a,b)=> new Date(a.ts) - new Date(b.ts));
}

function renderFotosTurno(){
  atualizarContagensTurno();
  const grid = el('fotos-turno-grid');
  const vazio = el('fotos-turno-vazio');
  if(!grid) return;
  const fotos = fotosDoTurnoAtual();
  if(fotos.length === 0){
    grid.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';
  grid.innerHTML = fotos.map(f=>`
    <div class="foto-turno-item">
      <a href="${f.url}" target="_blank" rel="noopener"><img src="${f.url}" alt="foto do turno" title="ver em tamanho maior"></a>
      <button class="icon icon-remover" onclick="removerFotoTurno('${f.id}')" title="remover">✕</button>
      <button class="foto-turno-obs" onclick="editarDescricaoFotoTurno('${f.id}')" title="clique pra ${f.descricao ? 'editar' : 'adicionar'} a observação">
        ${f.descricao ? escHtml(f.descricao) : '+ observação'}
      </button>
    </div>
  `).join('');
}

function selecionarFotoTurno(){
  if(!navigator.onLine){ showToast('Precisa de internet pra enviar uma foto.'); return; }
  el('foto-turno-input').click();
}
el('btn-escolher-foto-turno').addEventListener('click', selecionarFotoTurno);
el('foto-turno-input').addEventListener('change', ()=>{
  const arquivo = el('foto-turno-input').files[0];
  el('foto-turno-input').value = '';
  if(arquivo) enviarFotoTurno(arquivo);
});

function descricaoFotoModal(valorAtual){
  return new Promise(resolve=>{
    const root = el('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <p style="font-weight:700;">Observação da foto (opcional)</p>
          <div class="field" style="margin-bottom:16px;">
            <label for="foto-turno-descricao-input">O que essa foto mostra?</label>
            <input id="foto-turno-descricao-input" type="text" maxlength="200" placeholder="ex: vazamento de óleo na perfuratriz" value="${(valorAtual || '').replace(/"/g,'&quot;')}">
          </div>
          <div class="modal-actions">
            <button class="ghost" id="modal-cancelar">Pular</button>
            <button class="steel" id="modal-salvar">Salvar</button>
          </div>
        </div>
      </div>
    `;
    const fechar = (resultado)=>{ root.innerHTML = ''; resolve(resultado); };
    el('modal-cancelar').addEventListener('click', ()=> fechar(valorAtual || ''));
    el('modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'modal-overlay') fechar(valorAtual || ''); });
    const salvar = ()=> fechar(el('foto-turno-descricao-input').value.trim());
    el('modal-salvar').addEventListener('click', salvar);
    el('foto-turno-descricao-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); salvar(); } });
    el('foto-turno-descricao-input').focus();
  });
}

async function enviarFotoTurno(arquivo){
  showToast('Enviando foto...');
  try{
    const dataISO = dataBRParaISO(turnoInfo.data) || new Date().toISOString().slice(0,10);
    const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const novoId = uuidv4();
    const caminho = `${novoId}.${extensao}`;
    const { error: erroUpload } = await db.storage.from('fotos-turno').upload(caminho, arquivo, { upsert: true });
    if(erroUpload) throw erroUpload;
    const { data } = db.storage.from('fotos-turno').getPublicUrl(caminho);

    const descricao = await descricaoFotoModal('');

    const novaFoto = {
      id: novoId, data: dataISO, turnoNumero: turnoInfo.turnoNumero, turnoLetra: turnoInfo.turnoLetra,
      url: data.publicUrl, descricao, ts: new Date().toISOString()
    };
    fotosTurno.push(novaFoto);
    enfileirar('fotos_turno', 'insert', {
      id: novoId, data: dataISO, turno_numero: turnoInfo.turnoNumero, turno_letra: turnoInfo.turnoLetra,
      url: novaFoto.url, descricao
    });
    salvarFotosTurnoLocal();
    renderFotosTurno();
    showToast('Foto do turno adicionada.');
  }catch(e){
    showToast(`Não foi possível enviar a foto: ${e && e.message ? e.message : e}`);
  }
}

async function editarDescricaoFotoTurno(id){
  const f = fotosTurno.find(x=>x.id===id);
  if(!f) return;
  const descricao = await descricaoFotoModal(f.descricao);
  if(descricao === f.descricao) return; // nada mudou
  f.descricao = descricao;
  enfileirar('fotos_turno', 'update', { id: f.id, descricao });
  salvarFotosTurnoLocal();
  renderFotosTurno();
  showToast('Observação atualizada.');
}

async function removerFotoTurno(id){
  const f = fotosTurno.find(x=>x.id===id);
  if(!f) return;
  if(!(await confirmDialog('Remover esta foto do turno?', 'Remover'))) return;
  fotosTurno = fotosTurno.filter(x=>x.id!==id);
  enfileirar('fotos_turno', 'delete', { id });
  salvarFotosTurnoLocal();
  renderFotosTurno();
  showToast('Foto removida.', {
    acaoLabel: 'Desfazer',
    onAcao: ()=> desfazerRemocaoFotoTurno(f)
  });
}

function desfazerRemocaoFotoTurno(fotoRemovida){
  if(fotosTurno.some(x=>x.id===fotoRemovida.id)) return; // já foi restaurado
  fotosTurno.push(fotoRemovida);
  restaurarNaFila('fotos_turno', fotoRemovida.id, {
    id: fotoRemovida.id, data: fotoRemovida.data, turno_numero: fotoRemovida.turnoNumero,
    turno_letra: fotoRemovida.turnoLetra, url: fotoRemovida.url, descricao: fotoRemovida.descricao
  });
  salvarFotosTurnoLocal();
  renderFotosTurno();
  showToast('Foto restaurada.');
}

function carregarTurnoLocal(){
  try{
    const raw = localStorage.getItem(TURNO_LOCAL_KEY);
    if(raw) turnoInfo = { ...turnoInfo, ...JSON.parse(raw) };
  }catch(e){}
}
function salvarTurnoLocal(){
  try{ localStorage.setItem(TURNO_LOCAL_KEY, JSON.stringify(turnoInfo)); }catch(e){}
}

async function loadTurnoInfo(){
  carregarTurnoLocal();
  carregarObsLocal();

  if(navigator.onLine){
    try{
      const { data, error } = await db.from('turno_info').select('*').eq('id', TURNO_ROW_ID).maybeSingle();
      if(error) throw error;
      if(data){
        turnoInfo.tecnicos = data.tecnicos || '';
        turnoInfo.local = data.local || '';
        turnoInfo.turnoNumero = data.turno_numero || '';
        turnoInfo.turnoLetra = data.turno_letra || '';
        turnoInfo.dds = data.dds || '';
      }
    }catch(e){
      // sem sinal — segue com o que já está salvo localmente
    }
  }

  turnoInfo.data = new Date().toLocaleDateString('pt-BR');
  turnoInfo.supervisor = configApp.supervisor;

  el('turno-data').value = turnoInfo.data;
  el('turno-tecnicos').value = turnoInfo.tecnicos || '';
  el('turno-local').value = turnoInfo.local || '';
  el('turno-dds').value = turnoInfo.dds || '';
  el('turno-supervisor').value = turnoInfo.supervisor;
  // Projeto não entra aqui — é só-leitura e sincronizado a partir do realce
  // ativo (sincronizarLocalComNivelDoAnel), não de um valor salvo à parte.
  selecionarChip('turno-numero-group', turnoInfo.turnoNumero);
  selecionarChip('turno-letra-group', turnoInfo.turnoLetra);
  // Pré-seleciona a letra na criação de leque com o turno atual, só como
  // ponto de partida — a pessoa pode trocar manualmente antes de criar,
  // já que quem perfila pode ser diferente de quem está com o turno aberto.
  if(!document.querySelector('#leque-letra-group .chip.active')){
    selecionarChip('leque-letra-group', turnoInfo.turnoLetra);
  }
  renderObservacoesTurno();
  renderFotosTurno();

  salvarTurnoLocal();
}

// Limpa data/turno/letra/técnicos pra começar um turno novo — não apaga
// observações nem fotos já registradas (elas só passam a não aparecer, já que
// são filtradas pelo turno atual; continuam guardadas se voltar pro turno certo).
// Faz a limpeza de verdade — separado da confirmação, pra poder ser chamado
// tanto pelo botão manual (com confirmação) quanto automaticamente depois de
// exportar o relatório do turno (sem confirmação, já é esperado nesse ponto).
function executarLimpezaCamposTurno(){
  el('turno-data').value = new Date().toLocaleDateString('pt-BR');
  el('turno-tecnicos').value = '';
  el('turno-dds').value = '';
  document.querySelectorAll('#turno-numero-group .chip').forEach(c=> c.classList.remove('active'));
  document.querySelectorAll('#turno-letra-group .chip').forEach(c=> c.classList.remove('active'));
  saveTurnoInfo();
}

async function limparDadosTurno(){
  const msg = 'Limpar Data, Turno, Letra, Técnicos e DDS pra começar um turno novo? As observações e fotos já registradas não são apagadas — só deixam de aparecer aqui até você voltar pro turno/letra em que foram feitas.';
  if(!(await confirmDialog(msg, 'Limpar'))) return;
  executarLimpezaCamposTurno();
  showToast('Dados do turno limpos.');
}
el('btn-limpar-turno').addEventListener('click', limparDadosTurno);

function saveTurnoInfo(){
  turnoInfo.data = el('turno-data').value;
  turnoInfo.tecnicos = el('turno-tecnicos').value;
  turnoInfo.local = el('turno-local').value;
  turnoInfo.dds = el('turno-dds').value;
  turnoInfo.supervisor = configApp.supervisor;
  turnoInfo.projeto = el('turno-projeto').value;
  const chipNumero = document.querySelector('#turno-numero-group .chip.active');
  const chipLetra = document.querySelector('#turno-letra-group .chip.active');
  turnoInfo.turnoNumero = chipNumero ? chipNumero.dataset.val : '';
  turnoInfo.turnoLetra = chipLetra ? chipLetra.dataset.val : '';
  salvarTurnoLocal();
  enfileirar('turno_info', 'upsert', {
    id: TURNO_ROW_ID,
    data: dataBRParaISO(turnoInfo.data),
    turno_numero: turnoInfo.turnoNumero,
    turno_letra: turnoInfo.turnoLetra,
    tecnicos: turnoInfo.tecnicos,
    supervisor: turnoInfo.supervisor,
    projeto: turnoInfo.projeto,
    local: turnoInfo.local,
    dds: turnoInfo.dds
  });
  renderObservacoesTurno();
  renderFotosTurno();
}

function drawHeaderTabelaPDF(doc, y){
  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(PDF_FONT_CABECALHO); doc.setFont(undefined,'bold');
  doc.text('Furo', 17, y);
  doc.text('Esperada', 90, y, { align:'right' });
  doc.text('Real', 122, y, { align:'right' });
  doc.text('Diferenca', 157, y, { align:'right' });
  doc.text('Situacao', 162, y);
  doc.setTextColor(0,0,0);
  return y+8;
}

// Numera todas as páginas do documento no formato "Página X de Y" — só pode
// ser chamada no final, depois que todas as páginas já foram criadas.
function adicionarNumeracaoPaginas(doc){
  const totalPaginas = doc.internal.getNumberOfPages();
  if(totalPaginas <= 1) return;
  for(let i = 1; i <= totalPaginas; i++){
    doc.setPage(i);
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(120);
    doc.text(`Página ${i} de ${totalPaginas}`, 195, 289, { align:'right' });
    doc.setTextColor(0);
  }
}

// Marca d'água da logo (Trust Soluções Geológicas) no canto inferior direito de cada
// página — grande e levemente puxada pra dentro da folha, passando por trás da tabela.
// Precisa ser chamada depois de todo o conteúdo já ter sido desenhado (pinta por cima,
// mas a opacidade baixa faz o efeito de "atrás" sem precisar redesenhar tudo por página).
function adicionarMarcaDaguaPDF(doc){
  const totalPaginas = doc.internal.getNumberOfPages();
  const tamanho = 130; // mm
  const x = 210 - (tamanho * 0.72);
  const y = 297 - (tamanho * 0.72);
  for(let i = 1; i <= totalPaginas; i++){
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.10 }));
    try{ doc.addImage('data:image/png;base64,'+LOGO_MARCA_DAGUA_B64, 'PNG', x, y, tamanho, tamanho); }catch(e){}
    doc.restoreGraphicsState();
  }
}

// Caixa de resumo no topo do relatório combinado — dá a visão geral (quantos leques,
// furos, metros, aproveitamento e qual leque merece mais atenção) sem precisar rolar
// até o fim pra achar o TOTAL GERAL. Devolve o Y logo depois da caixa.
function desenharResumoPDF(doc, y, stats){
  const alturaBox = 34;
  if(y + alturaBox > 275){ doc.addPage(); y = 20; }

  const aproveitamento = stats.totalEsp > 0 ? (stats.totalReal / stats.totalEsp * 100) : 0;
  doc.setDrawColor(200); doc.setLineWidth(0.3);
  doc.rect(15, y, 180, alturaBox);
  doc.setFont(undefined,'bold'); doc.setFontSize(11);
  doc.text('RESUMO DO TURNO', 20, y+8);
  doc.setFont(undefined,'normal'); doc.setFontSize(10);

  const col1 = 20, col2 = 78, col3 = 138;
  doc.text(`Leques perfilados: ${stats.qtdLeques}`, col1, y+17);
  doc.text(`Furos registrados: ${stats.totalFuros}`, col1, y+24);
  doc.text(`Esperada: ${fmt1(stats.totalEsp)} m`, col2, y+17);
  doc.text(`Real: ${fmt1(stats.totalReal)} m`, col2, y+24);

  const varGeral = stats.totalReal - stats.totalEsp;
  doc.setTextColor(...corRGBDiferenca(varGeral));
  doc.text(`Variação: ${diffLabel(varGeral)}`, col3, y+17);
  doc.setTextColor(0,0,0);
  doc.text(`Alertas: ${stats.alertas}`, col3, y+24);

  doc.setFont(undefined,'bold');
  doc.text(`Aproveitamento: ${aproveitamento.toFixed(1)}%`, col1, y+31);
  if(stats.piorLeque){
    doc.setFont(undefined,'normal');
    doc.setTextColor(...corRGBDiferenca(stats.piorLeque.diff));
    const linhaAtencao = doc.splitTextToSize(
      `Leque que mais precisa de atenção: ${stats.piorLeque.codigo} (${diffLabel(stats.piorLeque.diff)}, ${stats.piorLeque.alertas} alerta(s))`,
      108
    );
    doc.text(linhaAtencao, col2, y+31);
    doc.setTextColor(0,0,0);
  }
  return y + alturaBox + 8;
}

// Desenha o cabeçalho comum de qualquer relatório em PDF (logo + título + dados do turno).
// Devolve a coordenada Y onde o conteúdo específico do relatório deve começar.
async function desenharCabecalhoTurnoPDF(doc, opcoes={}){
  const titulo = opcoes.titulo || 'STATUS TURNO PERFILAGEM DE LAVRA';

  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64, 'JPEG', 15, 8, 20, 19.6); }catch(e){}

  doc.setFontSize(PDF_FONT_TITULO); doc.setFont(undefined,'bold');
  doc.text(titulo, 40, 15);
  doc.setFontSize(PDF_FONT_SUBTITULO); doc.setFont(undefined,'normal'); doc.setTextColor(120);
  doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), 40, 21);
  doc.setTextColor(0);
  doc.setDrawColor(180); doc.line(15, 30, 195, 30);

  doc.setFontSize(PDF_FONT_INFO);
  let y = 38;
  const turnoDisplay = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `${turnoInfo.turnoNumero || '-'}º Turno - Letra ${turnoInfo.turnoLetra || '-'}`
    : '-';
  const campos = [
    ['Data:', turnoInfo.data],
    ['Turno:', turnoDisplay],
    ['Tecnicos:', turnoInfo.tecnicos],
    ['Supervisor:', turnoInfo.supervisor],
    ['Projeto:', turnoInfo.projeto],
    ['Local:', turnoInfo.local],
    ['DDS:', turnoInfo.dds],
  ];
  doc.setFont(undefined,'normal');
  campos.forEach(([label,val])=>{
    doc.text(label, 15, y);
    doc.text(String(val||'-'), 42, y);
    y += 7;
  });

  const obsAtuais = observacoesDoTurnoAtual();
  if(obsAtuais.length > 0){
    y += 2;
    doc.setFont(undefined,'bold'); doc.text('Observações:', 15, y); y += 6;
    doc.setFont(undefined,'normal');
    obsAtuais.forEach(o=>{
      const linhasObs = doc.splitTextToSize(`• ${o.texto}`, 172);
      if(y > 270){ doc.addPage(); y = 20; }
      doc.text(linhasObs, 18, y);
      y += linhasObs.length * 6;
    });
  }

  const fotosAtuais = fotosDoTurnoAtual();
  if(fotosAtuais.length > 0){
    y += 4;
    doc.setFont(undefined,'bold'); doc.text('Fotos do turno:', 15, y); y += 6;
    doc.setFont(undefined,'normal');
    y = await desenharGradeFotosPDF(doc, fotosAtuais, y);
  }

  y += 4;
  doc.setDrawColor(180); doc.line(15, y, 195, y); y += 10;
  return y;
}

// Compartilha o PDF como arquivo de verdade (evita cair um link "blob:" no WhatsApp/redes sociais).
// Quando o navegador suporta Web Share API com arquivos, abre o menu nativo de compartilhamento.
// Caso contrário, cai no download tradicional (o arquivo vai para a pasta de Downloads do aparelho).
async function baixarOuCompartilharPDF(doc, nomeArquivo, forcarDownload){
  const blob = doc.output('blob');

  try{
    if(forcarDownload) throw { name:'BaixarDireto' }; // pula o compartilhar e cai no download
    const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
    if(navigator.canShare && navigator.canShare({ files: [arquivo] })){
      await navigator.share({ files: [arquivo], title: nomeArquivo });
      return;
    }
  }catch(err){
    if(err && err.name === 'AbortError') return; // usuário cancelou o compartilhamento, não é erro
    // se o compartilhamento falhar por outro motivo, cai no download normal abaixo
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// ---------- Histórico de exportações ----------
let historicoExportacoes = [];

async function registrarExportacao({ tipo, leques, qtdLeques, qtdFuros, nomeArquivo }){
  try{
    const { error } = await db.from('export_historico').insert({
      tipo,
      turno_data: dataBRParaISO(turnoInfo.data),
      turno_numero: turnoInfo.turnoNumero,
      turno_letra: turnoInfo.turnoLetra,
      leques: leques || null,
      qtd_leques: qtdLeques || 0,
      qtd_furos: qtdFuros || 0,
      nome_arquivo: nomeArquivo
    });
    if(error) throw error;
    await loadHistoricoExportacoes();
    return true;
  }catch(e){
    // histórico é auxiliar: não trava a exportação, mas registra o erro real no console para diagnóstico
    console.error('Falha ao registrar no histórico de exportações:', e);
    return false;
  }
}

async function loadHistoricoExportacoes(){
  if(!navigator.onLine) return;
  try{
    const { data, error } = await db.from('export_historico').select('*').order('criado_em', { ascending:false }).limit(50);
    if(error) throw error;
    historicoExportacoes = data || [];
  }catch(e){
    historicoExportacoes = [];
  }
  renderHistoricoExportacoes();
}

function renderHistoricoExportacoes(){
  const lista = el('historico-list');
  const vazio = el('historico-vazio');
  if(!lista) return;
  if(historicoExportacoes.length === 0){
    lista.innerHTML = '';
    if(vazio) vazio.style.display = 'block';
    return;
  }
  if(vazio) vazio.style.display = 'none';

  const TIPO_LABEL = { turno:'Só turno', leque:'1 leque', combinado:'Combinado' };

  lista.innerHTML = historicoExportacoes.map(reg=>{
    const quando = reg.criado_em ? new Date(reg.criado_em).toLocaleString('pt-BR') : '-';
    const turnoLabelReg = [reg.turno_numero, reg.turno_letra].filter(Boolean).join('');
    const detalhe = reg.tipo === 'turno'
      ? 'Sem perfilagem de furos'
      : `${reg.leques || '-'} · ${reg.qtd_furos || 0} furo(s)`;
    return `
      <div class="historico-row">
        <span class="quando">${quando}</span>
        <span class="tipo ${reg.tipo}">${TIPO_LABEL[reg.tipo] || reg.tipo}</span>
        <span>${dataParaExibicao(reg.turno_data)}${turnoLabelReg ? ' · Turno '+turnoLabelReg : ''}</span>
        <span class="detalhe">${detalhe}</span>
        <span class="arquivo">${reg.nome_arquivo || ''}</span>
      </div>
    `;
  }).join('');
}

// ---------- Exportação de PDF: turno só, leque único, e combinado ----------
async function exportarTurnoPDF(){
  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = await desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_AVISO); doc.setFont(undefined,'italic'); doc.setTextColor(120);
  doc.text('Nenhuma perfilagem de furos vinculada a este relatório.', 15, y);
  doc.setTextColor(0); doc.setFont(undefined,'normal');

  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);

  const dataArquivo = (turnoInfo.data || '').replace(/\//g,'-') || 'sem-data';
  const sufixoTurno = (turnoInfo.turnoNumero || turnoInfo.turnoLetra)
    ? `_${turnoInfo.turnoNumero || ''}${turnoInfo.turnoLetra || ''}`
    : '';
  const nomeArquivo = ('Turno_' + dataArquivo + sufixoTurno).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';

  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'turno', leques:null, qtdLeques:0, qtdFuros:0, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF do turno exportado.'
    : 'PDF do turno exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
}

// Busca a foto do leque e devolve já em base64 (formato que o jsPDF entende),
// junto com as dimensões reais — pra desenhar no PDF sem esticar/espremer a
// imagem. Se falhar por qualquer motivo (sem sinal na hora de exportar, etc.),
// devolve null e o relatório continua normal, só sem a foto.
async function carregarImagemParaPDF(url){
  try{
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('falha ao buscar imagem');
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dimensoes = await new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=> resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = ()=> resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dimensoes };
  }catch(e){
    return null;
  }
}

// Desenha a foto no PDF a partir da posição y atual, mantendo a proporção
// (nunca estica/espreme), dentro de um tamanho máximo razoável de página —
// com moldura e legenda, pra parecer parte do relatório e não só uma imagem
// flutuando sem contexto. Devolve o novo y, já depois da foto.
async function desenharFotoLequePDF(doc, fotoUrl, y, legendaTexto){
  const foto = await carregarImagemParaPDF(fotoUrl);
  if(!foto) return y;
  const larguraMax = 100, alturaMax = 70;
  let largura = larguraMax, altura = larguraMax * (foto.h / foto.w);
  if(altura > alturaMax){ altura = alturaMax; largura = alturaMax * (foto.w / foto.h); }
  if(y + altura + 8 > 275){ doc.addPage(); y = 20; }
  try{
    const formato = foto.dataUrl.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.rect(15, y, largura, altura);
    doc.addImage(foto.dataUrl, formato, 15, y, largura, altura);
    y += altura + 5;
    if(legendaTexto){
      doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(legendaTexto, 15, y);
      doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
      y += 3;
    }
    return y + 8;
  }catch(e){
    return y;
  }
}

// Desenha várias fotos lado a lado, em 2 colunas — usado só pras fotos do turno,
// que podem ser várias (diferente da foto de leque, que é sempre uma só). Evita
// que o PDF fique enorme empilhando foto atrás de foto numa coluna só.
async function desenharGradeFotosPDF(doc, fotos, y){
  const COLUNAS = 2;
  const GAP = 8;
  const LARGURA_TOTAL = 180; // de x=15 até x=195
  const larguraCol = (LARGURA_TOTAL - GAP * (COLUNAS - 1)) / COLUNAS;
  const alturaMaxFoto = 55;

  let coluna = 0;
  let yLinha = y;
  let alturaMaxLinha = 0;

  for(const f of fotos){
    const foto = await carregarImagemParaPDF(f.url);
    if(!foto) continue;

    let largura = larguraCol, altura = larguraCol * (foto.h / foto.w);
    if(altura > alturaMaxFoto){ altura = alturaMaxFoto; largura = alturaMaxFoto * (foto.w / foto.h); }

    const legenda = f.descricao || 'Foto do turno';
    doc.setFont(undefined,'italic'); doc.setFontSize(8.5);
    const linhasLegenda = doc.splitTextToSize(legenda, larguraCol);
    doc.setFont(undefined,'normal');
    const alturaLinha = altura + 5 + linhasLegenda.length * 4 + 8;

    // só quebra página no início de uma linha nova (coluna 0), pra não cortar
    // uma foto pela metade nem deixar a segunda coluna desalinhada da primeira
    if(coluna === 0 && yLinha + alturaLinha > 278){
      doc.addPage();
      yLinha = 20;
    }

    const x = 15 + coluna * (larguraCol + GAP);
    try{
      const formato = foto.dataUrl.indexOf('image/png') !== -1 ? 'PNG' : 'JPEG';
      doc.setDrawColor(200); doc.setLineWidth(0.3);
      doc.rect(x, yLinha, largura, altura);
      doc.addImage(foto.dataUrl, formato, x, yLinha, largura, altura);
      doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(linhasLegenda, x, yLinha + altura + 5);
      doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
    }catch(e){}

    alturaMaxLinha = Math.max(alturaMaxLinha, alturaLinha);
    coluna++;
    if(coluna >= COLUNAS){
      coluna = 0;
      yLinha += alturaMaxLinha;
      alturaMaxLinha = 0;
    }
  }
  if(coluna !== 0) yLinha += alturaMaxLinha; // sobrou 1 foto pendente numa linha ímpar

  return yLinha;
}

async function exportarLequePDF(id){
  const l = leques.find(x=>x.id===id);
  if(!l) return;
  const a = aneis.find(x=>x.id===l.anelId);
  let furosDoLeque = furos.filter(f=>f.lequeId===id);
  furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = await desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
  doc.text('Realce: ' + (a ? a.nome : '-'), 15, y); y += 7;
  doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 8;
  if(l.turnoLetra || l.turnoNumero){
    doc.setFont(undefined,'normal'); doc.setFontSize(9); doc.setTextColor(110);
    const nomesTecnicos = TECNICOS_POR_LETRA[l.turnoLetra];
    doc.text(`Aberto no turno ${l.turnoNumero || '-'}${l.turnoLetra || ''}${nomesTecnicos ? ' · ' + nomesTecnicos : ''}`, 15, y);
    doc.setTextColor(0,0,0); doc.setFontSize(PDF_FONT_LEQUE_TITULO);
    y += 6;
  }
  y += 2;

  if(l.fotoUrl) y = await desenharFotoLequePDF(doc, l.fotoUrl, y, 'Foto do leque ' + lequeCode(l));

  // A tabela de perfilagem sempre começa numa página nova — assim ela nunca
  // fica cortada pela metade entre o resumo/foto (página 1) e os dados (página 2+).
  doc.addPage();
  y = 20;
  y = drawHeaderTabelaPDF(doc, y);
  doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

  furosDoLeque.forEach(f=>{
    if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
    const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
    doc.setTextColor(0,0,0);
    doc.text(furoCode(l,f), 17, y);
    doc.text(fmt1(Number(f.metragemEsperada))+' m', 90, y, { align:'right' });
    doc.text(fmt1(Number(f.metragemReal))+' m', 122, y, { align:'right' });
    doc.setTextColor(...corRGBDiferenca(diff));
    doc.text(diffLabel(diff), 157, y, { align:'right' });
    doc.setTextColor(...corRGBSituacao(f.situacao));
    doc.text(situacaoLabel(f.situacao), 162, y);
    doc.setTextColor(0,0,0);
    if(f.observacao){
      y += 5.5;
      if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
      doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text('obs: ' + f.observacao, 20, y);
      doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); doc.setTextColor(0,0,0);
      y += 3;
    }
    doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
    y += 8;
  });

  y += 6;
  if(y > 268){ doc.addPage(); y = 20; }
  const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
  const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
  const varTotal = totalReal - totalEsp;
  const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;

  doc.setFillColor(25,18,49);
  doc.rect(15, y-5, 180, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
  doc.text('Total: ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 17, y);
  doc.setTextColor(0,0,0);

  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);

  const nomeArquivo = (lequeCode(l) + '_' + (a?a.nome:'realce')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo);
  const salvoNoHistorico = await registrarExportacao({ tipo:'leque', leques: lequeCode(l), qtdLeques:1, qtdFuros: furosDoLeque.length, nomeArquivo });
  showToast(salvoNoHistorico
    ? 'PDF de ' + lequeCode(l) + ' exportado.'
    : 'PDF de ' + lequeCode(l) + ' exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
}

async function exportarLequesPDF(ids, opcoes){
  const baixar = !!(opcoes && opcoes.baixar);
  if(!ids || ids.length === 0){ showToast('Selecione ao menos um leque para exportar.'); return; }
  let selecionados = leques.filter(l=>ids.includes(l.id));
  if(selecionados.length === 0){ showToast('Nenhum leque válido selecionado.'); return; }
  selecionados = [...selecionados].sort((x,y)=> lequeCode(x).localeCompare(lequeCode(y), undefined, {numeric:true}));

  if(!window.jspdf){ showToast('Biblioteca de PDF ainda carregando, tente novamente em 1s.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = await desenharCabecalhoTurnoPDF(doc);

  doc.setFontSize(PDF_FONT_AVISO); doc.setFont(undefined,'normal');
  const linhasInclusos = doc.splitTextToSize(
    'Leques inclusos (' + selecionados.length + '): ' + selecionados.map(l=>lequeCode(l)).join(', '),
    180
  );
  doc.text(linhasInclusos, 15, y);
  y += linhasInclusos.length * 7 + 6;

  // Pré-calcula os furos e totais de cada leque uma única vez — usado tanto no
  // resumo do topo quanto nas tabelas individuais, sem recalcular duas vezes.
  const statsLeques = selecionados.map(l=>{
    let furosDoLeque = furos.filter(f=>f.lequeId===l.id);
    furosDoLeque = [...furosDoLeque].sort((x,y)=> String(x.numero).localeCompare(String(y.numero), undefined, {numeric:true}));
    const totalEsp = furosDoLeque.reduce((s,f)=>s+Number(f.metragemEsperada||0),0);
    const totalReal = furosDoLeque.reduce((s,f)=>s+Number(f.metragemReal||0),0);
    const alertas = furosDoLeque.filter(f=>f.situacao!=='livre').length;
    return { leque: l, furosDoLeque, totalEsp, totalReal, alertas, varTotal: totalReal - totalEsp };
  });

  let totalGeralEsp = 0, totalGeralReal = 0, totalGeralFuros = 0, alertasGeral = 0;
  let piorLeque = null;
  statsLeques.forEach(s=>{
    totalGeralEsp += s.totalEsp;
    totalGeralReal += s.totalReal;
    totalGeralFuros += s.furosDoLeque.length;
    alertasGeral += s.alertas;
    if(!piorLeque || s.varTotal < piorLeque.diff){
      piorLeque = { codigo: lequeCode(s.leque), diff: s.varTotal, alertas: s.alertas };
    }
  });

  y = desenharResumoPDF(doc, y, {
    qtdLeques: selecionados.length, totalFuros: totalGeralFuros,
    totalEsp: totalGeralEsp, totalReal: totalGeralReal, alertas: alertasGeral, piorLeque
  });

  for(const [idx, { leque: l, furosDoLeque, totalEsp, totalReal, alertas, varTotal }] of statsLeques.entries()){
    const a = aneis.find(x=>x.id===l.anelId);

    if(y > 250){ doc.addPage(); y = 20; }

    doc.setFontSize(PDF_FONT_LEQUE_TITULO); doc.setFont(undefined,'bold');
    doc.text('Realce: ' + (a ? a.nome : '-'), 15, y); y += 7;
    doc.text(tipoLabel(l.tipo) + ': ' + lequeCode(l) + (l.nome ? ' - ' + l.nome : ''), 15, y); y += 8;
    if(l.turnoLetra || l.turnoNumero){
      doc.setFont(undefined,'normal'); doc.setFontSize(9); doc.setTextColor(110);
      const nomesTecnicos = TECNICOS_POR_LETRA[l.turnoLetra];
      doc.text(`Aberto no turno ${l.turnoNumero || '-'}${l.turnoLetra || ''}${nomesTecnicos ? ' · ' + nomesTecnicos : ''}`, 15, y);
      doc.setTextColor(0,0,0); doc.setFontSize(PDF_FONT_LEQUE_TITULO);
      y += 6;
    }
    y += 2;

    if(l.fotoUrl) y = await desenharFotoLequePDF(doc, l.fotoUrl, y, 'Foto do leque ' + lequeCode(l));

    // Garante espaço pro cabeçalho da tabela + pelo menos 1 linha antes de
    // desenhar — sem isso, o cabeçalho podia ficar "órfão" sozinho numa página
    // (sem nenhuma linha depois) quando sobrava só um pouquinho de espaço.
    if(y + 16 > 273){ doc.addPage(); y = 20; }
    y = drawHeaderTabelaPDF(doc, y);
    doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO);

    furosDoLeque.forEach(f=>{
      if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
      const diff = Number(f.metragemReal||0) - Number(f.metragemEsperada||0);
      doc.setTextColor(0,0,0);
      doc.text(furoCode(l,f), 17, y);
      doc.text(fmt1(Number(f.metragemEsperada))+' m', 90, y, { align:'right' });
      doc.text(fmt1(Number(f.metragemReal))+' m', 122, y, { align:'right' });
      doc.setTextColor(...corRGBDiferenca(diff));
      doc.text(diffLabel(diff), 157, y, { align:'right' });
      doc.setTextColor(...corRGBSituacao(f.situacao));
      doc.text(situacaoLabel(f.situacao), 162, y);
      doc.setTextColor(0,0,0);
      if(f.observacao){
        y += 5.5;
        if(y > 273){ doc.addPage(); y = 20; y = drawHeaderTabelaPDF(doc, y); doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); }
        doc.setFont(undefined,'italic'); doc.setFontSize(8.5); doc.setTextColor(110);
        doc.text('obs: ' + f.observacao, 20, y);
        doc.setFont(undefined,'normal'); doc.setFontSize(PDF_FONT_CORPO); doc.setTextColor(0,0,0);
        y += 3;
      }
      doc.setDrawColor(220); doc.line(15, y+2.5, 195, y+2.5);
      y += 8;
    });

    y += 6;
    if(y > 268){ doc.addPage(); y = 20; }
    doc.setFont(undefined,'bold'); doc.setFontSize(PDF_FONT_TOTAL);
    doc.text('Subtotal ' + lequeCode(l) + ': ' + furosDoLeque.length + ' furo(s)  |  Esperada: ' + fmt1(totalEsp) + ' m  |  Real: ' + fmt1(totalReal) + ' m  |  Variacao: ' + diffLabel(varTotal) + '  |  Alertas: ' + alertas, 15, y);
    y += 10;

    if(idx < selecionados.length - 1){
      doc.setDrawColor(200); doc.line(15, y, 195, y);
      y += 8;
    }
  }

  if(y > 255){ doc.addPage(); y = 20; }
  y += 2;
  doc.setDrawColor(25,18,49); doc.setLineWidth(0.6); doc.line(15, y, 195, y); doc.setLineWidth(0.2); y += 9;
  const varGeral = totalGeralReal - totalGeralEsp;
  doc.setFont(undefined,'bold');
  const textoTotalGeral = 'TOTAL GERAL (' + selecionados.length + ' leque(s)): ' + totalGeralFuros + ' furo(s)  |  Esperada: ' + fmt1(totalGeralEsp) + ' m  |  Real: ' + fmt1(totalGeralReal) + ' m  |  Variacao: ' + diffLabel(varGeral) + '  |  Alertas: ' + alertasGeral;

  // Encolhe a fonte só o suficiente pra caber numa linha só (até um piso legível de 8.5pt).
  // Só quebra em duas linhas se, mesmo no menor tamanho, o texto ainda não couber.
  let fonteTotalGeral = PDF_FONT_TOTAL;
  doc.setFontSize(fonteTotalGeral);
  while(doc.getTextWidth(textoTotalGeral) > 180 && fonteTotalGeral > 8.5){
    fonteTotalGeral -= 0.5;
    doc.setFontSize(fonteTotalGeral);
  }

  const linhasTotal = doc.splitTextToSize(textoTotalGeral, 180);
  if(y + linhasTotal.length * 6 > 285){ doc.addPage(); y = 20; }
  doc.text(linhasTotal, 15, y);

  adicionarMarcaDaguaPDF(doc);
  adicionarNumeracaoPaginas(doc);

  const nomeArquivo = ('Turno_' + selecionados.map(l=>lequeCode(l)).join('-')).replace(/[^a-zA-Z0-9_-]+/g,'_') + '.pdf';
  await baixarOuCompartilharPDF(doc, nomeArquivo, baixar);
  const salvoNoHistorico = await registrarExportacao({
    tipo:'combinado',
    leques: selecionados.map(l=>lequeCode(l)).join(', '),
    qtdLeques: selecionados.length,
    qtdFuros: totalGeralFuros,
    nomeArquivo
  });
  showToast(salvoNoHistorico
    ? 'PDF combinado com ' + selecionados.length + ' leque(s) exportado.'
    : 'PDF combinado exportado (não entrou no histórico agora, mas o arquivo foi gerado normalmente).');
  limparSelecaoLeques();
}

