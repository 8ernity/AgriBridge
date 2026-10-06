# Quick Fix Checklist for Render Deployment

## Problem
- ❌ Scan feature: "Diagnosis Error: Not found"
- ❌ Ask feature: "Unable to connect to streaming gateway"

## Root Cause
Frontend static site doesn't know where the backend is. It's trying to call `/api/v1/*` on its own domain instead of the backend domain.

---

## Fix in 5 Steps

### ✅ Step 1: Set Backend API Key
**Render Dashboard → agribridge-backend → Environment**
- Add variable:
  - Key: `GEMINI_API_KEY`
  - Value: `AIzaSyATuOl3bQsxZk5eCAdWfjxndi4zgFDJV4o`
- Click "Save Changes"
- Wait for auto-redeploy

### ✅ Step 2: Set Frontend Backend URL
**Render Dashboard → agribridge-frontend → Environment**
- Add variable:
  - Key: `VITE_API_BASE_URL`  
  - Value: `https://agribridge-backend.onrender.com`
- Click "Save Changes"

### ✅ Step 3: Force Rebuild Frontend
**Render Dashboard → agribridge-frontend → Manual Deploy**
- Click **"Clear build cache & deploy"**
- ⚠️ This is CRITICAL - just saving env var is not enough!
- Wait for build to complete (~2-5 minutes)

### ✅ Step 4: Verify Backend
Open in browser:
```
https://agribridge-backend.onrender.com/health
```
Should see: `{"status":"healthy",...}`

### ✅ Step 5: Test Frontend
1. Open: `https://agribridge-zqvh.onrender.com`
2. Press F12 → Network tab
3. Try uploading an image (Scan tab)
4. Check request URL:
   - ✅ Should be: `https://agribridge-backend.onrender.com/api/v1/scans`
   - ❌ If it's: `https://agribridge-zqvh.onrender.com/api/v1/scans` → rebuild again

---

## Why Clear Build Cache is Critical

**Vite bakes environment variables into JavaScript at build time:**
- `VITE_API_BASE_URL` → Gets replaced in the code
- Old cache → Uses old value (or `/api/v1`)
- Must clear cache → Forces fresh build with new value

---

## If Still Not Working

### Check Build Logs
**Render Dashboard → agribridge-frontend → Logs**
- Look for: `vite v5.x.x building for production...`
- Should complete without errors

### Check Network Requests
**Browser (F12) → Network tab:**
- Try scan feature
- Look at request URL
- Should point to backend domain

### Check Backend is Running
```bash
curl https://agribridge-backend.onrender.com/api/v1/config
```
Should return JSON

---

## Expected Result

After completing all steps:
- ✅ Scan feature works (uploads image, shows diagnosis)
- ✅ Ask feature works (streams AI response)
- ✅ All API calls go to backend domain

---

## Time Required
- Setting env vars: 2 minutes
- Frontend rebuild: 2-5 minutes
- Backend redeploy: 1-3 minutes
- **Total: ~5-10 minutes**

---

**Do these 5 steps and it should work!** 🚀
