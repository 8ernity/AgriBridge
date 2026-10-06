# Render Deployment Fix Guide

## Current Issues

From your screenshots:
1. **Scan Feature**: "Diagnosis Error: Not found" 
2. **Ask Feature**: "Unable to connect to streaming gateway"

## Root Cause

The frontend static site is trying to call `/api/v1/*` on its own domain, but those endpoints only exist on the backend service.

**Problem Flow:**
```
Frontend: https://agribridge-zqvh.onrender.com
  ↓ Tries to call: /api/v1/scans
  ↓ Actual URL: https://agribridge-zqvh.onrender.com/api/v1/scans
  ✗ 404 Not Found (static site has no API)
```

**Correct Flow:**
```
Frontend: https://agribridge-zqvh.onrender.com
  ↓ Should call: https://agribridge-backend.onrender.com/api/v1/scans
  ✓ Backend responds
```

---

## Fix: Set Environment Variable on Frontend

### Critical Understanding

⚠️ **Vite builds environment variables INTO the JavaScript bundle at build time.**

This means:
1. `VITE_API_BASE_URL` must be set **BEFORE** building
2. The value gets baked into `dist/assets/*.js` files
3. Changing it after build does NOTHING
4. You must **rebuild** after setting it

---

## Step-by-Step Fix

### Step 1: Set Backend Environment Variable

**Render Dashboard → agribridge-backend → Environment:**

1. Click **"Environment"** in left sidebar
2. Click **"Add Environment Variable"**
3. Set:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `AIzaSyATuOl3bQsxZk5eCAdWfjxndi4zgFDJV4o`
4. Click **"Save Changes"**
5. Service will auto-redeploy

**Verify backend works:**
- Open: `https://agribridge-backend.onrender.com/health`
- Should see: `{"status":"healthy",...}`

### Step 2: Set Frontend Environment Variable

**Render Dashboard → agribridge-frontend → Environment:**

1. Click **"Environment"** in left sidebar
2. Click **"Add Environment Variable"**
3. Set:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://agribridge-backend.onrender.com`
4. Click **"Save Changes"**

### Step 3: Force Rebuild Frontend (CRITICAL)

⚠️ **Just saving the env var is NOT enough!**

**Option A: Clear Cache & Rebuild (Recommended)**
1. Go to **"Manual Deploy"** 
2. Click **"Clear build cache & deploy"**
3. This ensures the env var is used during build

**Option B: Trigger New Deploy**
1. Make a small change to any frontend file (e.g., add a comment)
2. Push to GitHub
3. Render will rebuild with new env var

### Step 4: Verify the Build Logs

**Render Dashboard → agribridge-frontend → Logs → Build Logs**

Look for:
```
> vite build

vite v5.x.x building for production...
```

The build should complete successfully and the `VITE_API_BASE_URL` will be embedded in the bundle.

### Step 5: Test the Deployment

1. **Open frontend**: `https://agribridge-zqvh.onrender.com`
2. **Open browser console** (F12 → Console)
3. **Go to Network tab** (F12 → Network)
4. **Try uploading an image** in Scan tab
5. **Check the request URL**:
   - ✅ Should go to: `https://agribridge-backend.onrender.com/api/v1/scans`
   - ❌ If goes to: `https://agribridge-zqvh.onrender.com/api/v1/scans` → rebuild needed

---

## Verification Checklist

### Backend Health
```bash
curl https://agribridge-backend.onrender.com/health
```
Expected: `{"status":"healthy",...}`

### Backend API
```bash
curl https://agribridge-backend.onrender.com/api/v1/config
```
Expected: JSON array with country configuration

### Frontend Console
1. Open `https://agribridge-zqvh.onrender.com`
2. Press F12 → Console
3. Type: `console.log(location.origin)`
4. Try scan feature
5. Go to Network tab
6. Check request URLs - should point to backend domain

---

## Common Mistakes

### ❌ Mistake 1: Setting env var but not rebuilding
**Problem**: Old bundle still uses `/api/v1` (relative path)  
**Fix**: Must clear cache and rebuild

### ❌ Mistake 2: Wrong backend URL
**Problem**: `VITE_API_BASE_URL` doesn't match actual backend  
**Fix**: Check your actual backend URL in Render dashboard

### ❌ Mistake 3: Missing GEMINI_API_KEY on backend
**Problem**: Advisory feature fails (but scan might work)  
**Fix**: Add the API key to backend environment

### ❌ Mistake 4: Checking env var in Render UI after build
**Problem**: Env var shows correctly but still doesn't work  
**Fix**: The env var is only read DURING build, not runtime

---

## Alternative: Single Service Deployment (Easier)

If the two-service approach is too complex, deploy everything as one service:

### Create New Render Service

1. **Delete both existing services** (or create a new one)
2. **Use `render-single-service.yaml`** (I created this file)
3. **Rename it to `render.yaml`**
4. **Push to GitHub**
5. **Create new Web Service in Render**
6. **Add `GEMINI_API_KEY` in dashboard**
7. **Deploy**

Benefits:
- ✅ Single URL for everything
- ✅ No CORS issues
- ✅ No environment variable confusion
- ✅ Backend serves both API and frontend

---

## Debugging Commands

### Check if environment variable is in build output

After frontend rebuilds, download the built file and check:

1. Go to frontend deployment
2. Open `https://agribridge-zqvh.onrender.com/assets/*.js` (any js file)
3. Search for "agribridge-backend"
4. If found → env var was used ✅
5. If not found → env var not used, rebuild needed ❌

### Test backend directly

```bash
# Health
curl https://agribridge-backend.onrender.com/health

# Config
curl https://agribridge-backend.onrender.com/api/v1/config

# Test scan (requires image upload - use Postman/Insomnia)
# POST https://agribridge-backend.onrender.com/api/v1/scans
```

---

## Why This Happens

**Vite Environment Variables:**
- Prefixed with `VITE_` are exposed to client-side code
- Read at **build time** and replaced in the bundle
- Like find-and-replace: `import.meta.env.VITE_API_BASE_URL` → `"https://backend.com"`
- Once built, the value is frozen in JavaScript

**Static Sites on Render:**
- Just serve files from `dist/` folder
- No server-side logic
- No proxying
- Can't modify environment at runtime

**Result:**
- Frontend must know backend URL before building
- Must be set as `VITE_API_BASE_URL`
- Must rebuild after setting it

---

## Next Steps

1. ✅ **Set `GEMINI_API_KEY`** on backend
2. ✅ **Set `VITE_API_BASE_URL`** on frontend  
3. ✅ **Clear cache and rebuild frontend**
4. ✅ **Test with browser DevTools Network tab**
5. ✅ **Verify requests go to backend URL**

---

## Contact Points

- **Your Backend**: `https://agribridge-backend.onrender.com`
- **Your Frontend**: `https://agribridge-zqvh.onrender.com`
- **Expected API calls**: Frontend → Backend (cross-origin)
- **CORS**: Already enabled on backend (`allow_origins=["*"]`)

---

**Status**: You need to set `VITE_API_BASE_URL` on frontend and **clear cache & rebuild**.
