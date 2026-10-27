// Private local collector journal. No network calls; never write this database into the repository.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdirSync,chmodSync,realpathSync,existsSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute,basename,sep} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const text=x=>typeof x==='string'?x.slice(0,200):null;
function normalize({event,capturedAt,sourceCommit,phase='discovery'}){
 if(!/^[a-f0-9]{32}$/.test(event?.id||'')||!/^\d{10}$/.test(String(event.nhlGameId||''))||!['homeAbbrev','awayAbbrev'].every(k=>/^[A-Z]{3}$/.test(event[k]||''))||!Number.isFinite(Date.parse(capturedAt))||!(Date.parse(capturedAt)<Date.parse(event.startTime))||!['discovery','game_capture'].includes(phase))throw Error('Verified pregame identity and capture time required');
 const d=event.gameDay;
 const side=k=>{const t=d?.[k],g=t?.goalie;return {team:text(t?.team),goalie:{status:['confirmed','projected'].includes(g?.status)?g.status:'unknown',name:text(g?.name),playerId:/^\d{7}$/.test(g?.playerId||'')?g.playerId:null,source:'ESPN pregame probable starters',sourceUpdatedAt:text(g?.sourceUpdatedAt)},lineup:{status:t?.lineup?.players?.length?'reported':'unknown',completeLineup:false,source:'NHL game report',players:(t?.lineup?.players||[]).filter(p=>/^\d{7}$/.test(String(p.id))).map(p=>({id:String(p.id),name:text(p.name)}))}}};
 const gameDay=d?{gameId:String(d.gameId),date:text(d.date),startTime:text(d.startTime),gameState:text(d.gameState),pregame:d.pregame===true,checkedAt:text(d.checkedAt),home:side('home'),away:side('away')}:null;
 // Explicit field allowlist prevents accidental persistence of headers, credentials or provider payloads.
 return {schemaVersion:1,capturedAt:new Date(capturedAt).toISOString(),phase,sourceCommit:/^[a-f0-9]{7,40}$/.test(sourceCommit||'')?sourceCommit:null,event:{id:event.id,nhlGameId:String(event.nhlGameId),date:text(event.date),startTime:new Date(event.startTime).toISOString(),homeAbbrev:event.homeAbbrev,awayAbbrev:event.awayAbbrev,gameDay},goalieEvidence:null};
}
export function openEvidenceStore(filename,{repositoryRoot=new URL('../',import.meta.url).pathname}={}){
 if(!filename||!isAbsolute(filename))throw Error('Absolute private evidence database path required');
 const path=resolve(filename),rel=relative(resolve(repositoryRoot),path);
 if(!rel||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel)))throw Error('Evidence database must be outside the repository');
 mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const actual=existsSync(path)?realpathSync(path):resolve(realpathSync(dirname(path)),basename(path)),root=realpathSync(repositoryRoot),actualRelative=relative(root,actual);
 if(!actualRelative||(actualRelative!=='..'&&!actualRelative.startsWith('..'+sep)&&!isAbsolute(actualRelative)))throw Error('Evidence symlink points into the repository');
 const db=new DatabaseSync(actual);chmodSync(path,0o600);
 db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS evidence (seq INTEGER PRIMARY KEY, observation_key TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, previous_hash TEXT NOT NULL, entry_hash TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS evidence_no_update BEFORE UPDATE ON evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END;
 CREATE TRIGGER IF NOT EXISTS evidence_no_delete BEFORE DELETE ON evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END;`);
 function verify(){let previous='';const rows=db.prepare('SELECT * FROM evidence ORDER BY seq').all();for(const row of rows){if(row.previous_hash!==previous||hash(previous+'\n'+row.payload)!==row.entry_hash)throw Error('Evidence journal integrity failure');previous=row.entry_hash}return {entries:rows.length,head:previous||null}}
 try{verify()}catch(e){db.close();throw e}
 return {
  append(input){const record=normalize(input),payload=JSON.stringify(record),key=hash(JSON.stringify([record.event.id,record.capturedAt,record.phase]));
   db.exec('BEGIN IMMEDIATE');try{
    const old=db.prepare('SELECT payload FROM evidence WHERE observation_key = ?').get(key);if(old){if(old.payload!==payload)throw Error('Conflicting observation; original evidence preserved');db.exec('COMMIT');return {inserted:false}}
    const previous=db.prepare('SELECT entry_hash FROM evidence ORDER BY seq DESC LIMIT 1').get()?.entry_hash||'',entryHash=hash(previous+'\n'+payload);
    db.prepare('INSERT INTO evidence(observation_key,payload,previous_hash,entry_hash) VALUES(?,?,?,?)').run(key,payload,previous,entryHash);db.exec('COMMIT');return {inserted:true,hash:entryHash};
   }catch(e){db.exec('ROLLBACK');throw e}
  },
  verify,
  snapshots(){verify();return db.prepare('SELECT payload FROM evidence ORDER BY seq').all().map(r=>JSON.parse(r.payload))},
  close(){db.close()}
 };
}
