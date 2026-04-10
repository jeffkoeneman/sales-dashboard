Copy-Item -Path 'C:\Users\Jeff Koeneman\Downloads\index.html' -Destination 'public\index.html' -Force
if (Test-Path 'C:\Users\Jeff Koeneman\Downloads\vercel.json') { Copy-Item -Path 'C:\Users\Jeff Koeneman\Downloads\vercel.json' -Destination 'vercel.json' -Force }
git add .
git commit -m 'update from claude'
git push
