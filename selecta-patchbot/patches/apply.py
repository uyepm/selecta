#!/usr/bin/env python3
"""SELECTA patch runner — applies queued exact-string patches to public/selecta-app.html.
Each patches/queue/NNN_*.py defines SUBS=[(old,new),...]. Applied once, tracked in patches/applied.txt.
Aborts (no commit) if any old-string is missing or the result fails a JS parse check."""
import os,sys,subprocess,glob

HTML="public/selecta-app.html"
APPLIED="patches/applied.txt"
done=set()
if os.path.exists(APPLIED):
    done={l.strip() for l in open(APPLIED) if l.strip()}
queue=sorted(glob.glob("patches/queue/*.py"))
todo=[q for q in queue if os.path.basename(q) not in done]
if not todo:
    print("nothing to apply");sys.exit(0)
src=open(HTML,encoding="utf-8").read()
for q in todo:
    ns={}
    exec(compile(open(q,encoding="utf-8").read(),q,"exec"),ns)
    subs=ns.get("SUBS",[])
    for old,new in subs:
        if old not in src:
            print(f"FATAL: {q}: missing anchor: {old[:80]!r}");sys.exit(1)
        src=src.replace(old,new)
    print(f"applied {q} ({len(subs)} subs)")
open(HTML,"w",encoding="utf-8").write(src)
# JS parse check
check=r'''const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");const m=s.match(/<script>[\s\S]*?<\/script>/g);for(const b of m){const body=b.replace(/<\/?script[^>]*>/g,"");if(!body.trim())continue;new Function(body.replace(/"use strict";/,"return;"));}console.log("parse ok");'''
r=subprocess.run(["node","-e",check,HTML])
if r.returncode!=0:
    print("FATAL: parse check failed");sys.exit(1)
with open(APPLIED,"a") as f:
    for q in todo:f.write(os.path.basename(q)+"\n")
print("done")
