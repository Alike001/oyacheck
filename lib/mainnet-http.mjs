import { randomBytes, timingSafeEqual } from 'node:crypto';
import { MainnetStore, publicPurchase, digest, fail } from './mainnet-store.mjs';
import { MainnetPilot, createMainnetTransport, mainnetConfig } from './mainnet-buy.mjs';
import { isLocalRequest } from './buy-browser.mjs';

export const mainnetPreparationEnabled = () => process.env.OYACHECK_MAINNET_PREPARE === '1';
let active;
export function mainnetRuntime() {
  if (!active) {
    const config=mainnetConfig();
    const store=new MainnetStore(process.env.OYACHECK_PURCHASE_DB || '');
    active={store,pilot:new MainnetPilot(store,createMainnetTransport(config),config)};
  }
  return active;
}
export async function mainnetHTTP(req,res,u,{readJSON,respond,runtime=mainnetRuntime,enabled=mainnetPreparationEnabled()}) {
  if (!u.pathname.startsWith('/api/mainnet/')) return false;
  const host=req.headers.host || '';
  const allowedHosts=[`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`,`[::1]:${req.socket.localPort}`];
  // Loopback alone is insufficient behind a proxy; pin the direct Host too.
  if (!enabled || !isLocalRequest(req.socket.remoteAddress) || !allowedHosts.includes(host)) {
    respond(res,403,{error:'Mainnet preparation is disabled or is not a direct local connection'});return true;
  }
  try {
    const {store,pilot}=runtime();
    const rawCookie=req.headers.cookie?.match(/(?:^|;\s*)oya_mainnet=([a-f0-9]{64})(?:;|$)/)?.[1];
    const cookie=rawCookie || randomBytes(32).toString('hex');
    const owner=store.session(cookie), csrf=digest(`csrf:${cookie}`);
    if (!rawCookie) res.setHeader('Set-Cookie',`oya_mainnet=${cookie}; HttpOnly; SameSite=Strict; Path=/api/mainnet; Max-Age=86400`);
    if (req.method!=='GET') {
      const supplied=req.headers['x-oyacheck-csrf'] || '';
      if (req.headers.origin!==`http://${host}` || typeof supplied!=='string' || supplied.length!==csrf.length ||
          !timingSafeEqual(Buffer.from(supplied),Buffer.from(csrf))) throw fail('csrf-rejected','Local session and matching request origin are required',403);
      if (req.headers['content-type']?.split(';')[0]!=='application/json') throw fail('json-required','Send JSON',415);
    }
    if (req.method==='GET' && u.pathname==='/api/mainnet/session') {
      respond(res,200,{csrf,preparationOnly:true});return true;
    }
    if (req.method==='POST' && u.pathname==='/api/mainnet/quote') {
      const body=await readJSON(req);
      if (Object.keys(body).some(k=>!['input','requestId'].includes(k))) throw fail('server-plan-only','Price, wallet and service must come from the server',400);
      respond(res,200,publicPurchase(await pilot.quote(owner,body.input,body.requestId)));return true;
    }
    const route=u.pathname.match(/^\/api\/mainnet\/purchases\/([a-f0-9-]{36})(?:\/(request|cancel))?$/);
    if (route) {
      if (req.method==='GET' && !route[2]) {respond(res,200,publicPurchase(store.get(route[1],owner)));return true;}
      if (req.method==='POST' && route[2]) {
        const body=await readJSON(req);
        if (Object.keys(body).some(k=>k!=='fingerprint')) throw fail('server-plan-only','Only the exact plan fingerprint can be submitted',400);
        respond(res,200,publicPurchase(store.transition(owner,route[1],route[2],body.fingerprint)));return true;
      }
    }
    // Deliberately NO HTTP execute, approve-operator or reconcile endpoint.
    respond(res,404,{error:'No such mainnet preparation operation'});
  } catch(error) {if(!res.headersSent&&!res.destroyed)respond(res,error.safe ? error.status : 503,{error:error.safe ? error.message : 'Mainnet preparation failed safely',code:error.safe ? error.code : 'preparation-unavailable'});}
  return true;
}
