import {randomBytes,createHash} from 'node:crypto';
// Preparation only. Production integrations must supply these explicit operations.
// Raw token stays in this closure and is passed only to the private-secret writer.
export function prepareCollectorRenewal({through,now=Date.now()}={}){
 const required=Date.parse(through),end=now+31*86400000;
 if(!Number.isFinite(now)||!Number.isFinite(required)||required<=now||required>end)throw Error('Future required coverage within 31 days required');
 let token=randomBytes(32).toString('hex'),phase='prepared',secretAttempted=false,busy=false,disposed=false;
 const verification=Object.freeze({EDGEBOARD_COLLECTOR_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),EDGEBOARD_COLLECTOR_NOT_BEFORE:new Date(now).toISOString(),EDGEBOARD_COLLECTOR_EXPIRES_AT:new Date(end).toISOString()});
 const status=()=>({phase,requiredThrough:new Date(required).toISOString(),expiresAt:verification.EDGEBOARD_COLLECTOR_EXPIRES_AT,secretWriteAttempted:secretAttempted,collectionMayResume:false});
 return {
  verification,status,
  async apply({holdCollection,publishVerification,storePrivateSecret,verifyPrivateAccess,clock=()=>Date.now(),verifierOnly=false}={}){
   if(disposed||busy)throw Error('Renewal unavailable');
   if(![holdCollection,publishVerification,storePrivateSecret,verifyPrivateAccess,clock].every(v=>typeof v==='function'))throw Error('Explicit renewal operations required');
   busy=true;let stage='hold_collection';
   try{
    const held=await holdCollection();if(held?.held!==true)throw Error();
    if(!Number.isFinite(clock())||clock()<now||clock()>=end)throw Error();
    
    if(phase==='prepared'){
     stage='publish_verifier';const receipt=await publishVerification(verification);
     if(receipt?.deployed!==true||receipt.verifierSha256!==verification.EDGEBOARD_COLLECTOR_TOKEN_SHA256)throw Error();
     phase='verifier_deployed';
    }
    if(verifierOnly&&phase==='verifier_deployed')return {...status(),verified:false,readyForSecretInstallation:true};
    if(phase==='verifier_deployed'){
     stage='install_private_secret';secretAttempted=true;
     const receipt=await storePrivateSecret({name:'EDGEBOARD_COLLECTOR_TOKEN',value:token});
     if(receipt?.installed!==true)throw Error();phase='private_secret_installed';
    }
    if(phase==='verified')phase='private_secret_installed';
    stage='verify_private_access';const proof=await verifyPrivateAccess(),checked=Date.parse(proof?.checkedAt),expiry=Date.parse(proof?.credentialExpiresAt),time=clock();
    if(proof?.verified!==true||proof.authentication!=='collector'||proof.providerRequests!==0||proof.auditPersisted!==true||!Number.isFinite(time)||time>=end||!Number.isFinite(checked)||checked>time||time-checked>60000||expiry!==end||expiry<required)throw Error();
    phase='verified';token=null;return {...status(),verified:true};
   }catch{return {...status(),verified:false,failedStage:stage,retryRequired:true,message:'Collection remains held. Retry this same renewal handle; never print adapter exceptions or generate a replacement blindly.'}}
   finally{busy=false}
  },
  // A pre-secret rollback is safe only after a confirmed verifier deployment.
  async rollbackBeforeSecret({holdCollection,restoreVerification}={}){
   if(disposed||busy||secretAttempted||phase!=='verifier_deployed'||typeof holdCollection!=='function'||typeof restoreVerification!=='function')throw Error('Safe pre-secret rollback unavailable');
   busy=true;try{if((await holdCollection())?.held!==true)throw Error();if((await restoreVerification())?.restored!==true)throw Error();phase='rolled_back';token=null;disposed=true;return status()}catch{throw Error('Rollback not verified; keep collection held')}finally{busy=false}
  },
  dispose(){if(busy)throw Error('Renewal in progress');token=null;disposed=true;return status()}
 };
}
