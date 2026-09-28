import { FURYPIPE_FAVICON_SVG } from './studio-brand.js';

export const STUDIO_PWA_MANIFEST_PATH = '/studio.webmanifest' as const;
export const STUDIO_PWA_ICON_PATH = '/studio-icon.svg' as const;
export const STUDIO_PWA_SERVICE_WORKER_PATH = '/studio-service-worker.js' as const;
export const STUDIO_PWA_OFFLINE_PATH = '/studio-offline' as const;

const NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
});

const OFFLINE_SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>Offline · FuryPipe Studio</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050506;color:#f4f1ec;font:16px/1.5 system-ui,sans-serif}main{max-width:36rem;padding:2rem;border:1px solid #332015;border-radius:16px;background:#0f0f12}b{color:#ff8a3d}</style></head><body><main><p><b>FuryPipe Studio</b></p><h1>Offline shell</h1><p>The Studio needs its local gateway to load workspace data. No chat, session, artifact, memory, or API response is cached for offline use.</p></main></body></html>`;

const SERVICE_WORKER = `const CACHE_NAME='furypipe-studio-offline-v1';
const OFFLINE_PATH='${STUDIO_PWA_OFFLINE_PATH}';
self.addEventListener('install',(event)=>{event.waitUntil(caches.open(CACHE_NAME).then((cache)=>cache.add(OFFLINE_PATH)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',(event)=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',(event)=>{
  const request=event.request;
  if(request.method!=='GET'||request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE_PATH).then((response)=>response||Response.error())));
});`;

function textResponse(body: string, contentType: string): Response {
  return new Response(body, { headers: { ...NO_STORE_HEADERS, 'content-type': contentType } });
}

/**
 * Returns only static PWA support files. The main Studio document, API
 * responses, and all user or runtime data deliberately remain out of CacheStorage.
 */
export function studioPwaResponse(pathname: string): Response | null {
  switch (pathname) {
    case STUDIO_PWA_MANIFEST_PATH:
      return textResponse(JSON.stringify({
        name: 'FuryPipe Studio',
        short_name: 'FuryPipe',
        description: 'Local FuryPipe Studio shell. Workspace data stays behind the local gateway.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#050506',
        theme_color: '#050506',
        icons: [{ src: STUDIO_PWA_ICON_PATH, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      }), 'application/manifest+json; charset=utf-8');
    case STUDIO_PWA_ICON_PATH:
      return textResponse(FURYPIPE_FAVICON_SVG, 'image/svg+xml; charset=utf-8');
    case STUDIO_PWA_SERVICE_WORKER_PATH:
      return new Response(SERVICE_WORKER, {
        headers: {
          ...NO_STORE_HEADERS,
          'content-type': 'application/javascript; charset=utf-8',
          'service-worker-allowed': '/',
        },
      });
    case STUDIO_PWA_OFFLINE_PATH:
      return textResponse(OFFLINE_SHELL, 'text/html; charset=utf-8');
    default:
      return null;
  }
}
