/* SELECTA relay — zero-dependency doc store with leases + SSE watch.
   Mirrors the claude.ai artifact db semantics so the game's NET layer ports unchanged. */
const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||10000;
const DOCS=new Map();        // path -> {data, lease:{owner,until}}
const WATCH=new Map();       // path -> Set(res)
const started=Date.now();

function send(res,code,obj){res.writeHead(code,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"});res.end(JSON.stringify(obj));}
function okPath(p){return typeof p==="string"&&p.length<200&&/^[\w\-\/]+$/.test(p)&&(p.startsWith("games/")||p.startsWith("data/"));}
function notify(p){
  const ws=WATCH.get(p);if(!ws)return;
  const d=DOCS.get(p);
  const payload=`data: ${JSON.stringify({exists:!!d,data:d?d.data:null})}\n\n`;
  for(const res of [...ws]){try{res.write(payload);}catch(e){ws.delete(res);}}
}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://x");
  if(req.method==="GET"&&(u.pathname==="/"||u.pathname==="/index.html")){
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
    fs.createReadStream(path.join(__dirname,"public","selecta-app.html")).pipe(res);return;
  }
  if(req.method==="GET"&&u.pathname==="/api/ping"){send(res,200,{ok:true,up:Date.now()-started,docs:DOCS.size});return;}
  if(req.method==="GET"&&u.pathname==="/api/watch"){
    const p=u.searchParams.get("path");
    if(!okPath(p)){send(res,400,{err:"path"});return;}
    res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive","Access-Control-Allow-Origin":"*"});
    res.write("retry: 1500\n\n");
    if(!WATCH.has(p))WATCH.set(p,new Set());
    WATCH.get(p).add(res);
    const d=DOCS.get(p);
    res.write(`data: ${JSON.stringify({exists:!!d,data:d?d.data:null})}\n\n`);
    const hb=setInterval(()=>{try{res.write(": hb\n\n");}catch(e){}},25000);
    req.on("close",()=>{clearInterval(hb);const ws=WATCH.get(p);if(ws)ws.delete(res);});
    return;
  }
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, GET"});res.end();return;}
  if(req.method==="POST"&&u.pathname==="/api/doc"){
    let body="";req.on("data",c=>{body+=c;if(body.length>2_500_000)req.destroy();});
    req.on("end",()=>{
      let b;try{b=JSON.parse(body);}catch(e){send(res,400,{err:"json"});return;}
      const p=b.path;
      if(!okPath(p)){send(res,400,{err:"path"});return;}
      const d=DOCS.get(p);
      if(b.op==="get"){send(res,200,{exists:!!d,data:d?d.data:null});return;}
      if(b.op==="set"){
        if(d&&d.lease&&d.lease.until>Date.now()&&d.lease.owner!==b.cid){send(res,200,{ok:false,locked:true});return;}
        DOCS.set(p,{data:b.data,lease:d?d.lease:null});notify(p);send(res,200,{ok:true});return;
      }
      if(b.op==="delete"){DOCS.delete(p);notify(p);send(res,200,{ok:true});return;}
      if(b.op==="acquire"){
        const now=Date.now(),ttl=Math.min(10000,+b.ttlMs||4000);
        if(d&&d.lease&&d.lease.until>now&&d.lease.owner!==b.cid){send(res,200,{acquired:false});return;}
        const cur=d||{data:null,lease:null};
        cur.lease={owner:b.cid,until:now+ttl};
        DOCS.set(p,cur);
        send(res,200,{acquired:true});return;
      }
      send(res,400,{err:"op"});
    });
    return;
  }
  send(res,404,{err:"nf"});
});
server.listen(PORT,()=>console.log("SELECTA relay on :"+PORT));
