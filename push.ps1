$file = Get-ChildItem "C:\Users\Jeff Koeneman\Downloads" -Filter "index*.html" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($file) { Write-Host "Copying $($file.Name)"; Copy-Item -Path $file.FullName -Destination "public\index.html" -Force; git add .; git commit -m "update from claude"; git push } else { Write-Host "No index file found in Downloads" }
