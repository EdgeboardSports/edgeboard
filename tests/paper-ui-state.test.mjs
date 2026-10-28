import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {aggregate} from '../paper-core.js';
import {aggregateGames} from '../game-paper.js';
import {evaluationWindow} from '../evaluation-core.js';
const html=readFileSync('paper.html','utf8'),script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
class Element{constructor(){this.value='';this.textContent='';this.children=[]}append(...v){this.children.push(...v)}replaceChildren(...v){this.children=v}}
const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};get('market').value='shots';
let ok=true;const box={document:{getElementById:get,createElement:()=>new Element()},Option:class extends Element{constructor(text,value){super();this.textContent=text;this.value=value}},Date,aggregate,aggregateGames,evaluationWindow,localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>({ok,json:async()=>({schemaVersion:1,events:[],runs:[]})})};
vm.runInNewContext(script.replace('load();\n','globalThis.ready=load();\n'),box);await box.ready;assert.equal(get('metrics').children.length,2);assert(get('program-metrics').children.length>0);assert(get('status').textContent.includes('paused'));
ok=false;await get('refresh').onclick();assert(get('status').textContent.includes('No previous results'));for(const id of ['metrics','accuracy','calibration','records','audit','health','program-metrics','program-groups','program-daily'])assert.equal(get(id).children.length,0);assert.equal(get('program-status').textContent,'');assert.equal(get('refresh').disabled,false);
console.log('Paper UI: valid empty ledger, rendered metrics, and stale-result clearing on refresh failure passed.');
