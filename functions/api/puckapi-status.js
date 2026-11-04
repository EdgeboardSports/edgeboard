import {authenticate,ACCESS_IDENTITY,securityHeaders,denied} from '../../lib/access.js';
// Configuration-only probe: no provider calls, billing, key readback or activation.
export async function onRequestGet(context){
 const {request,env}=context;
 if(new URL(request.url).search)return denied('No query parameters accepted.',400);
 let identity=context.data?.[ACCESS_IDENTITY];
 if(!identity||identity.expires<=Date.now()/1000){const auth=await authenticate(request,env);if(auth.response)return auth.response;identity=auth.identity;}
 const key=env.PUCKAPI_API_KEY;
 return securityHeaders(Response.json({provider:'PuckAPI',keyConfigured:typeof key==='string'&&key.trim().length>0,providerRequests:0,connectionOnly:true,liveAdapterVerified:false,trialStarted:false,requirements:['Verify actual authenticated provider responses and remaining account credits','Validate event times, period metadata and source coverage before model use'],rightsReference:'https://puckapi.com/terms'}));
}
