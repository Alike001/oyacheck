/** Chrome DevTools Protocol read-only capture, restricted to synthetic localhost fixtures.
 * No dependencies. Requires a local Chromium/Chrome binary. Never accepts URLs from users.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scenarioValid, synthesizeObservations } from './demo-inspection.mjs';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_RUN_MS = 22_000;
export function chromiumBinary() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const name of ['chromium','google-chrome','chromium-browser']) {
    const check=spawnSync('which',[name],{encoding:'utf8',timeout:1500});
    if(check.status===0) return check.stdout.trim();
  }
  return null;
}
async function waitForDebugPort(dir, child, until) {
  while(Date.now() < until) {
    if (child.exitCode!==null) throw new Error('Chromium exited before starting; check CHROMIUM_PATH');
    try {const raw=(await readFile(join(dir,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];const port=Number(raw);if(port>0&&port<65536)return port;}catch{}
    await sleep(80);
  }
  throw new Error('Chromium startup timed out');
}
class CDP {
  constructor(ws) {this.ws=ws;this.pending=new Map();this.next=1;this.events=[];
    ws.addEventListener('message',(evt)=>{let d;try{d=JSON.parse(evt.data)}catch{return}
      if(d.id){const p=this.pending.get(d.id);if(p){this.pending.delete(d.id);if(d.error)p.reject(new Error(d.error.message||'Browser command error'));else p.resolve(d.result||{});}}
      else if(d.method)this.events.push(d);
    });
    ws.addEventListener('close',()=>{for(const p of this.pending.values())p.reject(new Error('Browser session closed'));this.pending.clear();});
  }
  command(method,params={}) {
    const id=this.next++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Browser ${method} timed out`));},8000);
      const finish=(fn)=>(value)=>{clearTimeout(timer);fn(value);};
      this.pending.set(id,{resolve:finish(resolve),reject:finish(reject)});
      try{this.ws.send(JSON.stringify({id,method,params}));}
      catch(e){const pending=this.pending.get(id);this.pending.delete(id);pending.reject(e);}
    });
  }
}
const INSPECT_SCRIPT=`(() => ({
  url:location.href, title:document.title,
  headings:[...document.querySelectorAll('h1,h2')].slice(0,10).map(x=>x.textContent.trim().slice(0,100)),
  text:(document.body?.innerText||'').slice(0,3500),
  forms:[...document.forms].slice(0,6).map(f=>({method:f.method,action:f.action,fields:[...f.elements].filter(x=>x.matches('input,select,textarea')).slice(0,16).map(x=>({name:x.name,type:x.type}))}))
}))()`;
export async function inspectSyntheticPage({scenario,port}) {
  if (!scenarioValid(scenario)) throw new Error('Unknown demonstration scenario');
  if (!Number.isInteger(port)||port<1||port>65535) throw new Error('Local fixture server port missing');
  const binary=chromiumBinary();if(!binary) throw new Error('Chromium was not found. Install chromium or set CHROMIUM_PATH to Chrome.');
  const dir=await mkdtemp(join(tmpdir(),'oyacheck-browser-'));
  let proc;let ws;
  try {
    // Fixed localhost path is the ONLY navigation target. Fixtures contain zero external resources.
    proc=spawn(binary,['--headless=new','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore'});
    const until=Date.now()+MAX_RUN_MS;
    const debugPort=await waitForDebugPort(dir,proc,until);
    const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(4000)})).json();
    const target=targets.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
    if(!target) throw new Error('Chromium page target missing');
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await Promise.race([new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(new Error('Cannot connect to Chromium')),{once:true})}),sleep(5000).then(()=>{throw new Error('Chromium connection timed out')})]);
    const c=new CDP(ws);
    await c.command('Page.enable');await c.command('Runtime.enable');await c.command('Network.enable');
    const requested=`http://127.0.0.1:${port}/_demo/page/${scenario}`;
    const nav=await c.command('Page.navigate',{url:requested});
    if(nav.errorText) throw new Error('Chromium could not open the local fixture ('+nav.errorText+'). Check browser policy and local firewall.');
    let data;
    while(Date.now()<until) {
      const response=await c.command('Runtime.evaluate',{expression:`document.readyState === 'complete' ? ${INSPECT_SCRIPT} : null`,returnByValue:true,awaitPromise:false});
      if(response.exceptionDetails) throw new Error('Browser evaluation failed: '+response.exceptionDetails.text+' '+(response.exceptionDetails.exception?.description||''));
      if(response.result?.value?.url?.startsWith(`http://127.0.0.1:${port}/_demo/page/`)){data=response.result.value;break;}
      await sleep(120);
    }
    if(!data) throw new Error('Local sample did not finish rendering');
    const initialRequests=c.events.filter(e=>e.method==='Network.requestWillBeSent'&&e.params?.type==='Document').map(e=>e.params?.request?.url).filter(Boolean);
    const finalUrl=new URL(data.url);
    if(finalUrl.hostname!=='127.0.0.1'||Number(finalUrl.port)!==port)throw new Error('Browser left the local test server');
    const result=synthesizeObservations(scenario,data,initialRequests);
    const image=await c.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    let screenshot=null;
    if (typeof image.data==='string' && image.data.length<2.7e6) screenshot=Buffer.from(image.data,'base64');
    return {report:result,screenshot};
  } finally {
    try{ws?.close()}catch{}
    if(proc && proc.exitCode===null){proc.kill('SIGKILL');}
    await rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}
