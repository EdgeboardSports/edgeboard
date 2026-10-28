import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('props.html','utf8'),source=html.slice(html.indexOf('async function games(){'),html.indexOf("$('load').onclick=async"));
const element=(text='')=>({textContent:text,value:'',disabled:false,children:[],replaceChildren(...v){this.children=v},append(v){this.children.push(v)},closest(){return {classList:{add(){}}}}});
async function scenario(ok,data){const nodes=new Map(),calls=[],$=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};const box={$,Date,URLSearchParams,location:{search:''},make:(tag,text)=>element(text),Option:function(text,value){return {...element(text),value}},fetch:async path=>{calls.push(path);return {ok,json:async()=>data}}};vm.runInNewContext(source+';globalThis.ready=games();',box);await box.ready;return {nodes,calls}}
let r=await scenario(false,{message:'Feed held'});assert.equal(r.nodes.get('game').disabled,true);assert.equal(r.nodes.get('load').disabled,true);assert.equal(r.nodes.get('game').children[0].textContent,'Game feed unavailable');assert.deepEqual(r.calls,['/api/nhl-events']);
r=await scenario(true,{events:[]});assert.equal(r.nodes.get('game').disabled,true);assert.equal(r.nodes.get('game').children[0].textContent,'No games available');
const event={id:'a'.repeat(32),homeTeam:'Synthetic home',awayTeam:'Synthetic away',commenceTime:new Date(Date.now()+3600000).toISOString()};r=await scenario(true,{events:[event]});assert.equal(r.nodes.get('game').value,event.id);assert.equal(r.nodes.get('load').disabled,false);assert.deepEqual(r.calls,['/api/nhl-events']);
console.log('Mobile feed states: failed/empty selectors stop loading, valid matchups enable manual load, no automatic odds calls passed');
