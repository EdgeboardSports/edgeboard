import {existsSync} from 'node:fs';
import {openEvidenceStore} from './evidence-store.mjs';
const path=process.argv[2];
if(!path||!existsSync(path))throw Error('Existing private evidence database path required');
const store=openEvidenceStore(path);
try{
 const integrity=store.verify(),rows=store.snapshots();
 console.log(JSON.stringify({integrity,observations:rows.length,independentGames:new Set(rows.map(r=>r.event.nhlGameId)).size,firstCapturedAt:rows[0]?.capturedAt||null,lastCapturedAt:rows.at(-1)?.capturedAt||null,missingGoalieQuality:rows.filter(r=>!r.goalieEvidence).length,collectionActivated:false,note:'Journal integrity does not prove an independent trusted timestamp. No live goalie-quality source is connected.'},null,2));
}finally{store.close()}
