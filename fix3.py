with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = """async function kvGet(key) {
  const c=cfg();
  if(!c.kvUrl||!c.kvToken) return null;
  const r=await fetch(c.kvUrl+'/get/'+encodeURIComponent(key),{
    headers:{Authorization:'Bearer '+c.kvToken}
  });
  const d=await r.json();
  if(d.result===null||d.result===undefined) return null;
  if(typeof d.result==='string'){
    try{ return JSON.parse(d.result); }catch(e){ return d.result; }
  }
  return d.result;
}"""

new = """async function kvGet(key) {
  const c=cfg();
  if(!c.kvUrl||!c.kvToken) return null;
  const r=await fetch(c.kvUrl+'/get/'+encodeURIComponent(key),{
    headers:{Authorization:'Bearer '+c.kvToken}
  });
  const d=await r.json();
  if(d.result===null||d.result===undefined) return null;
  let val=d.result;
  // Unwrap double-encoding: {value: "..."} wrapper
  if(typeof val==='string'){
    try{ val=JSON.parse(val); }catch(e){}
  }
  if(val&&typeof val==='object'&&val.value!==undefined){
    val=val.value;
    if(typeof val==='string'){ try{ val=JSON.parse(val); }catch(e){} }
  }
  return val;
}"""

if old in content:
    content = content.replace(old, new, 1)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed successfully')
else:
    print('Text not found')
