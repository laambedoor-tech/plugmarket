# Script to purge Cloudflare cache for plugmarket.es
# You need your Cloudflare API Token and Zone ID

Write-Host "=== Cloudflare Cache Purge Script ===" -ForegroundColor Cyan
Write-Host ""

# These values need to be set (get them from Cloudflare Dashboard)
# Zone ID: Go to plugmarket.es overview page, scroll down to "API" section on the right
# API Token: https://dash.cloudflare.com/profile/api-tokens (create one with "Cache Purge" permission)

$ZONE_ID = Read-Host "Enter your Cloudflare Zone ID (or press Enter to skip)"
$API_TOKEN = Read-Host "Enter your Cloudflare API Token (or press Enter to skip)" -AsSecureString

if ([string]::IsNullOrEmpty($ZONE_ID) -or $API_TOKEN.Length -eq 0) {
    Write-Host ""
    Write-Host "Skipped. To purge cache manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://dash.cloudflare.com" -ForegroundColor White
    Write-Host "2. Select domain: plugmarket.es" -ForegroundColor White
    Write-Host "3. Go to: Caching -> Configuration" -ForegroundColor White
    Write-Host "4. Click: 'Purge Everything'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use bypass cache URL: https://plugmarket.es/product-hbomax.html?v=2" -ForegroundColor Green
    exit
}

# Convert SecureString to plain text
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($API_TOKEN)
$PlainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host "Purging cache for plugmarket.es..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $PlainToken"
    "Content-Type" = "application/json"
}

$body = @{
    "purge_everything" = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" -Method Post -Headers $headers -Body $body
    
    if ($response.success) {
        Write-Host "✓ Cache purged successfully!" -ForegroundColor Green
        Write-Host "The site should show the latest version now." -ForegroundColor Green
    } else {
        Write-Host "✗ Error purging cache:" -ForegroundColor Red
        Write-Host $response.errors -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Failed to purge cache:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
