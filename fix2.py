with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = "const snapKey=k=>'snapshot:'+k+(pid?':'+pid:'');"
new = "const snapKey=k=>'snapshot:'+k;"

if old in content:
    content = content.replace(old, new, 1)
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed successfully')
else:
    print('Text not found')
