Copy-Item -Path "C:\Users\Jeff Koeneman\Downloads\index.html" -Destination "public\index.html" -Force
git add .
git commit -m "update from claude"
git push
