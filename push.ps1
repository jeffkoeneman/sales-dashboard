Copy-Item -Path "$env:USERPROFILE\Downloads\index.html" -Destination "public\index.html" -Force
git add .
git commit -m "update from claude"
git push
