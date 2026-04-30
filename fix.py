with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = "const idxKey='snapshot:index'+(pid?':'+pid:'');\n    const index=await kvGet(idxKey);\n    const indexArr=Array.isArray(index)?index:[];\n    if(indexArr.length===0){\n      $('wow-no-data').style.display='block';\n      set('wow-dates','No snapshots yet \u2014 click Snapshot to begin');\n      return;\n    }"

new = "let index=await kvGet('snapshot:index');\n    if(!Array.isArray(index)||index.length===0){ index=await kvGet('snapshot:index'+(pid?':'+pid:'')); }\n    const indexArr=Array.isArray(index)?index:[];\n    if(indexArr.length===0){\n      $('wow-no-data').style.display='block';\n      set('wow-dates','No snapshots yet');\n      return;\n    }"

if old in content:
    content = content.replace(old, new, 1)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed successfully')
else:
    print('Text not found - trying CRLF version')
    old2 = old.replace('\n', '\r\n')
    if old2 in content:
        content = content.replace(old2, new.replace('\n', '\r\n'), 1)
        with open('public/index.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Fixed successfully with CRLF')
    else:
        print('Still not found')
