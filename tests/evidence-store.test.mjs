import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openEvidenceStore} from '../scripts/evidence-store.mjs';
import {runPaper} from '../scripts/paper-runner.mjs';
const dir=mkdtempSync(join(tmpdir(),'edgeboard-evidence-')),path=join(dir,'evidence.sqlite');
const now=Date.parse('2026-10-27T18:00:00Z'),start='2026-10-27T20:00:00Z',id='a'.repeat(32),event={id,nhlGameId:2026020100,date:'2026-10-27',startTime:start,homeAbbrev:'TOR',awayAbbrev:'CAR',credentials:'must not persist',gameDay:null};
const input={event,capturedAt:new Date(now).toISOString(),sourceCommit:'abcdef0',phase:'discovery',secret:'must not persist'};
try{
 const store=openEvidenceStore(path);assert.equal(store.append(input).inserted,true);assert.equal(store.append(input).inserted,false);assert.equal(store.verify().entries,1);
 assert.equal(statSync(path).mode&0o777,0o600);assert(!JSON.stringify(store.snapshots()).includes('must not persist'));
 assert.throws(()=>store.append({...input,event:{...event,awayAbbrev:'BOS'}}),/Conflicting/);assert.equal(store.verify().entries,1);
 assert.throws(()=>store.append({...input,capturedAt:start}),/pregame/);
 store.close();const reopened=openEvidenceStore(path);assert.equal(reopened.snapshots()[0].event.nhlGameId,'2026020100');reopened.close();
 const raw=new DatabaseSync(path);assert.throws(()=>raw.exec('UPDATE evidence SET payload = \'changed\''),/append-only/);assert.throws(()=>raw.exec('DELETE FROM evidence'),/append-only/);
 raw.exec("DROP TRIGGER evidence_no_update; UPDATE evidence SET payload = 'changed'");raw.close();assert.throws(()=>openEvidenceStore(path),/integrity/);
 assert.throws(()=>openEvidenceStore(join(process.cwd(),'evidence.sqlite')),/outside/);
 const link=join(dir,'repo-link');symlinkSync(process.cwd(),link,'dir');assert.throws(()=>openEvidenceStore(join(link,'evidence.sqlite')),/symlink/);
 const calls=[],read=async path=>{calls.push(path);if(path==='/api/nhl-events')return {events:[{id,commenceTime:start,homeTeam:'Toronto Maple Leafs',awayTeam:'Carolina Hurricanes'}]};if(path.startsWith('/api/nhl-schedule'))return {games:[{id:2026020100,gameType:2,gameState:'FUT',startTimeUTC:start,homeTeam:{abbrev:'TOR',name:{default:'Maple Leafs'}},awayTeam:{abbrev:'CAR',name:{default:'Hurricanes'}}}]};throw Error('source unavailable')};
 const ledger={events:[],runs:[]};let saves=0;
 await runPaper(ledger,read,{clock:()=>now,evidenceStore:{append:async data=>{saves++;assert.equal(data.phase,'discovery')}}});assert.equal(saves,1);
 calls.length=0;const failed={events:[],runs:[]};await runPaper(failed,read,{clock:()=>now,evidenceStore:{append(){throw Error('disk unavailable')}}});
 assert.equal(failed.events[0].status,'evidence_error');assert(!calls.some(p=>p.startsWith('/api/nhl-props')));
 console.log('Passed append-only persistence, reopen/hash checks, duplicate/conflict handling, secret allowlist, private paths and collector persistence-failure stop.');
}finally{rmSync(dir,{recursive:true,force:true})}
