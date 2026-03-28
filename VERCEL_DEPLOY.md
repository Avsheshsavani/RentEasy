# Deploy RentEase to Vercel

## Quick Setup

### 1. Vercel Project Settings

When deploying from GitHub, use these settings:

**Framework Preset:** Vite

**Root Directory:** 
- If your repo is just the `rentease` folder: `./`
- If your repo contains `Property-management/rentease`: `rentease`

**Build Command:** `npm run build` (auto-filled)

**Output Directory:** `dist` (auto-filled)

### 2. Environment Variables

Add these in Vercel → Settings → Environment Variables:

| Variable Name | Value | Where to find |
|--------------|--------|---------------|
| `VITE_SUPABASE_URL` | `https://tthqsfdklsvzoqjgxzvp.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (your anon/public key) | Supabase Dashboard → Settings → API → `anon` `public` |

**Important:** 
- Use the **anon/public** key, NOT the service role key
- Add for both **Production** and **Preview** environments
- Never commit `.env` to Git

### 3. PWA Configuration

The app is configured as a **standalone PWA**:

- **`manifest.json`** with `display: "standalone"` (hides browser chrome)
- **Service worker** (`sw.js`) for offline support
- **Icons:** `pwa-192.png`, `pwa-512.png`, `apple-touch-icon.png`
- **Meta tags** for iOS standalone mode

### 4. After Deployment

1. Open the deployed URL on your phone
2. **Android (Chrome):**
   - Tap menu (⋮) → "Add to Home screen" or "Install app"
   - The app opens fullscreen without address bar
3. **iOS (Safari):**
   - Tap Share button → "Add to Home Screen"
   - Opens with `black-translucent` status bar (no Safari chrome)

### 5. Testing Locally

```bash
npm run build
npm run preview
```

Visit `http://localhost:4173` and test "Add to Home screen" behavior.

### 6. Troubleshooting

**Address bar still shows:**
- Check that `manifest.json` has `"display": "standalone"`
- Verify service worker registered (DevTools → Application → Service Workers)
- On iOS: must add via Safari's Share → Add to Home Screen (not Chrome)
- Clear browser cache and re-add to home screen

**Icons not showing:**
- Ensure `pwa-192.png` and `pwa-512.png` exist in `public/` folder
- Check icon paths in `manifest.json` start with `/`
- Rebuild and redeploy

**Service worker not registering:**
- Check browser console for SW errors
- Verify HTTPS (required for SW; Vercel provides this)
- Check DevTools → Application → Manifest for errors
