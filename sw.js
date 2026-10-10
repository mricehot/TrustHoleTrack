/* BlastHole Manager — service worker
 *
 * Objetivo: o app ABRIR sem sinal (subsolo) com a última versão que a pessoa já carregou.
 * Regra de ouro para nunca ficar preso numa versão velha: arquivos do app são sempre
 * "rede primeiro" — com internet, vem sempre a versão nova; o cache só entra quando a
 * rede falha ou demora mais de 4 segundos. Nada de dados do Supabase é guardado aqui
 * (os dados ficam no aparelho pelo próprio app, e as alterações pendentes na fila dele).
 */
const CACHE = 'blasthole-shell-v1';
const LOCAIS = ['./dash.html', './style.css', './script.js', './script-leques.js', './script-checklist.js', './script-turno-pdf.js', './script-telas.js', './script-sessao.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];
const HOSTS_CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (ev)=>{
  ev.waitUntil((async ()=>{
    const cache = await caches.open(CACHE);
    // addAll falharia tudo se um item falhar; aqui cada um é independente.
    await Promise.all(LOCAIS.concat(CDNS).map(async (u)=>{
      try{ const r = await fetch(u, { cache: 'reload' }); if(r && r.ok) await cache.put(u, r); }catch(e){}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev)=>{
  ev.waitUntil((async ()=>{
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n=> n !== CACHE).map(n=> caches.delete(n)));
    await self.clients.claim();
  })());
});

function comLimite(promessa, ms){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=> reject(new Error('timeout')), ms);
    promessa.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}

async function redePrimeiro(req, ehNavegacao){
  const cache = await caches.open(CACHE);
  try{
    const resp = await comLimite(fetch(req, { cache: 'no-cache' }), 4000);
    if(resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  }catch(e){
    const guardado = await cache.match(req, { ignoreSearch: ehNavegacao || true });
    if(guardado) return guardado;
    if(ehNavegacao){ const shell = await cache.match('./dash.html', { ignoreSearch: true }); if(shell) return shell; }
    throw e;
  }
}

async function guardadoPrimeiro(req){
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(req);
  const atualizar = fetch(req).then(r=>{ if(r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(()=>null);
  return guardado || (await atualizar) || Response.error();
}

self.addEventListener('fetch', (ev)=>{
  const req = ev.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // Supabase (API, login, tempo real, fotos) e qualquer outro domínio: direto na rede, sem cache.
  if(url.origin === self.location.origin){
    ev.respondWith(redePrimeiro(req, req.mode === 'navigate'));
  }else if(HOSTS_CDN.includes(url.hostname)){
    ev.respondWith(guardadoPrimeiro(req));
  }
});

self.addEventListener('message', (ev)=>{ if(ev.data === 'pular-espera') self.skipWaiting(); });
