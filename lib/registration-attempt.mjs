// Local single-attempt journal. No keys/signatures. Claim and hash are immutable.
import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
function read(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw new Error('Attempt journal unreadable; reconcile without resubmitting');}}
function create(path,value){
  mkdirSync(dirname(path),{recursive:true,mode:0o700});let fd;
  try{fd=openSync(path,'wx',0o600);writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{if(fd!==undefined)closeSync(fd);}
  const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
}
export class RegistrationAttempt {
  constructor(path){if(!isAbsolute(path))throw new Error('Absolute local journal path required');this.path=path;}
  status(){const attempt=read(this.path);if(!attempt)return {reserved:false};const tx=read(this.path+'.tx');return {reserved:true,attempt,hash:tx?.hash||null,state:tx?'pending':'needs-review'};}
  claim(plan){create(this.path,{fingerprint:plan.fingerprint,transaction:plan.preview.preparedRequest,createdAt:new Date().toISOString()});return this.status();}
  attach(hash,fingerprint){
    const state=this.status();if(!state.reserved||state.attempt.fingerprint!==fingerprint||!/^0x[0-9a-f]{64}$/i.test(hash||''))throw new Error('Recovered hash does not match the reserved attempt');
    if(state.hash){if(state.hash.toLowerCase()!==hash.toLowerCase())throw new Error('Recorded transaction hash cannot be replaced');return state;}
    create(this.path+'.tx',{hash});return this.status();
  }
}
