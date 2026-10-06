# Fix Mobile Access to Local Development Server

## Problem Identified ✅

Your mobile device **cannot connect** to your computer at `10.36.92.77:5173` because:
1. ❌ The dev servers weren't running
2. ❌ Vite wasn't configured to listen on network interfaces
3. ⚠️ Windows Firewall might be blocking port 5174

## Solution Applied ✅

I've started the servers with network access enabled:
- **Backend**: Running on `0.0.0.0:8000` (accessible on network)
- **Frontend**: Running on `0.0.0.0:5174` (port changed because 5173 was in use)

---

## Your Computer's Network Addresses

Based on `ipconfig`, your computer is accessible at:

1. **WSL/Docker Network**: `172.23.224.1` (not for mobile)
2. **Local Network (WiFi/Ethernet)**: `192.168.10.100` ✅ **USE THIS**

---

## 🎯 Try These URLs on Your Mobile

### Option 1: Using 192.168.10.100 (Recommended)
```
http://192.168.10.100:5174
```

### Option 2: If you see other IPs in the Vite output
Check the terminal output for "Network:" addresses and try those.

---

## If Still Getting Connection Timeout

### Step 1: Allow Port 5174 Through Windows Firewall

**Option A: Quick Command (Run as Administrator)**

Open PowerShell as Administrator and run:
```powershell
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5174 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "FastAPI Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

**Option B: Manual Configuration**

1. Open **Windows Defender Firewall**
2. Click **"Advanced settings"**
3. Click **"Inbound Rules"** → **"New Rule..."**
4. Select **"Port"** → Next
5. Select **"TCP"** and enter **5174** → Next
6. Select **"Allow the connection"** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name: "Vite Dev Server" → Finish
9. Repeat for port **8000** (backend)

### Step 2: Verify Mobile and Computer on Same WiFi

- Both devices must be on the **same WiFi network**
- If mobile is on cellular data, it won't work
- If one is on guest WiFi, it might be isolated

### Step 3: Test Connection from Mobile

**Test Backend First:**
```
http://192.168.10.100:8000/health
```
Should show: `{"status":"healthy",...}`

**Then Test Frontend:**
```
http://192.168.10.100:5174
```
Should load the app

---

## Understanding the IP Addresses

### Your Original Attempt: `10.36.92.77:5173`
- This IP doesn't match your computer's current IPs
- Possible reasons:
  - Old IP address (computer got a new one from DHCP)
  - Different network interface
  - VPN or virtual network

### Current Valid IPs:
- **`172.23.224.1`**: WSL or Docker internal network (not accessible from mobile)
- **`192.168.10.100`**: Your local WiFi/Ethernet (✅ use this!)

---

## Quick Test Checklist

### On Your Computer (PowerShell):
```powershell
# 1. Check services are running
Get-NetTCPConnection -LocalPort 5174,8000

# 2. Test backend locally
curl http://localhost:8000/health

# 3. Test frontend locally
curl http://localhost:5174
```

### On Your Mobile:
1. **Connect to same WiFi** as your computer
2. **Open browser** (Chrome recommended)
3. **Navigate to**: `http://192.168.10.100:5174`
4. **Wait 10 seconds** for initial load

---

## Current Server Status

### Backend (FastAPI)
- **Port**: 8000
- **Host**: `0.0.0.0` (all network interfaces)
- **Status**: ✅ Running
- **Access**: 
  - Local: `http://localhost:8000`
  - Network: `http://192.168.10.100:8000`

### Frontend (Vite)
- **Port**: 5174 (changed from 5173)
- **Host**: `0.0.0.0` (all network interfaces)
- **Status**: ✅ Running
- **Access**:
  - Local: `http://localhost:5174`
  - Network: `http://192.168.10.100:5174` ✅ **Use this on mobile**

---

## Alternative: Use Render Deployment

If local network access is too complicated, use your Render deployment:

**Frontend URL**: `https://agribridge-zqvh.onrender.com`

This works from **any device, anywhere**, but you need to:
1. Set `VITE_API_BASE_URL` in Render dashboard
2. Rebuild frontend with cleared cache
3. (Follow the `QUICK_FIX_CHECKLIST.md`)

---

## Troubleshooting Commands

### Check if ports are listening
```powershell
netstat -an | findstr :5174
netstat -an | findstr :8000
```
Should show `LISTENING`

### Check firewall status
```powershell
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 5174}
```

### Get all network IPs
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*"} | Select-Object IPAddress, InterfaceAlias
```

---

## Summary

✅ **Servers are now running with network access**  
✅ **Use this URL on your mobile**: `http://192.168.10.100:5174`  
⚠️ **May need to allow through Windows Firewall**  
✅ **Both devices must be on same WiFi**

**If it still doesn't work after allowing firewall, let me know!**
