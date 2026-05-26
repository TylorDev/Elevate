Write-Host "Limpiando archivos .env del índice actual..."
git rm -r --cached .env 2>$null
git rm -r --cached .env.* 2>$null

Write-Host "Reescribiendo el historial de commits (Esto puede tardar unos minutos)..."
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all

Write-Host "Limpieza residual del repositorio..."
rm -r -fo .git/refs/original/ 2>$null
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "====================================="
Write-Host "¡Limpieza local completada con éxito!"
Write-Host "Revisa tu repositorio con 'git log' y 'git status'."
Write-Host "Para actualizar el repositorio remoto, ejecuta: git push --force --all"
Write-Host "====================================="
