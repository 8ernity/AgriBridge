# Run this script as Administrator to allow mobile access
# Right-click → "Run with PowerShell as Administrator"

Write-Host "Adding Windows Firewall rules for AgriBridge..." -ForegroundColor Green

# Allow Vite dev server (port 5174)
try {
    New-NetFirewallRule -DisplayName "AgriBridge Vite Dev Server" `
        -Direction Inbound `
        -LocalPort 5174 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "✓ Allowed port 5174 (Vite)" -ForegroundColor Green
} catch {
    Write-Host "! Port 5174 rule already exists or error occurred" -ForegroundColor Yellow
}

# Allow FastAPI backend (port 8000)
try {
    New-NetFirewallRule -DisplayName "AgriBridge FastAPI Backend" `
        -Direction Inbound `
        -LocalPort 8000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "✓ Allowed port 8000 (Backend)" -ForegroundColor Green
} catch {
    Write-Host "! Port 8000 rule already exists or error occurred" -ForegroundColor Yellow
}

Write-Host "`nFirewall configuration complete!" -ForegroundColor Cyan
Write-Host "Try accessing from mobile: http://192.168.10.100:5174" -ForegroundColor Cyan
Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
