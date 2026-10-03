export function websiteTracker(projectId: string, endpoint: string) {
  const safe = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c')
  return `(function(){if(window.__awbTracked)return;window.__awbTracked=true;
try{var visitor=localStorage.getItem('awb-visitor');if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('awb-visitor',visitor);}
var data={id:crypto.randomUUID(),projectId:${safe(projectId)},visitor:visitor,path:location.pathname,referrer:document.referrer?new URL(document.referrer).hostname:''};
if(data.referrer===location.hostname)data.referrer='';
var body=JSON.stringify(data);if(navigator.sendBeacon)navigator.sendBeacon(${safe(endpoint)},new Blob([body],{type:'text/plain'}));else fetch(${safe(endpoint)},{method:'POST',body:body,mode:'no-cors',keepalive:true});
}catch(e){}})();`
}
