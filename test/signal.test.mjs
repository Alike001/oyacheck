import test from 'node:test';
import assert from 'node:assert/strict';
import {signalHeights,renderSignal} from '../public/signal.js';

test('signal has no invented idle, speaking or processing audio amplitude',()=>{
  for(const state of ['ready','permission','transcribing','reviewing','analyzing','preparing','speaking','stopped','error'])assert.deepEqual(signalHeights(state,1),Array(7).fill(8));
});
test('signal only responds to measured listening amplitude and clamps invalid levels',()=>{
  assert.deepEqual(signalHeights('listening',0),Array(7).fill(8));
  assert.deepEqual(signalHeights('listening',NaN),Array(7).fill(8));
  assert.deepEqual(signalHeights('listening',-1),Array(7).fill(8));
  assert.equal(Math.max(...signalHeights('listening',1)),84);
  assert.deepEqual(signalHeights('listening',2),signalHeights('listening',1));
  assert.ok(signalHeights('listening',.5).every((n,i)=>n>signalHeights('listening',0)[i]));
});
test('reduced motion freezes signal geometry even during actual listening',()=>{
  assert.deepEqual(signalHeights('listening',1,true),Array(7).fill(8));
});
test('SVG geometry stays centered and resets after a listening turn',()=>{
  const bars=Array.from({length:7},()=>({values:{},setAttribute(k,v){this.values[k]=Number(v);}}));const root={querySelectorAll:()=>bars};
  renderSignal(root,'listening',1);for(const bar of bars)assert.equal(bar.values.y+bar.values.height/2,80);
  renderSignal(root,'stopped',0);for(const bar of bars){assert.equal(bar.values.height,8);assert.equal(bar.values.y,76);}
});
