# Domain Migration Guide: dogenado.cash → zdoge.cash

This guide covers migrating from `dogenado.cash` to `zdoge.cash` and `docs.dogenado.cash` to `docs.zdoge.cash`.

## ✅ Code Changes (Already Done)

### Backend (Render)
- ✅ Updated CORS allowed origins in `backend/src/index.ts`
  - Changed `https://dogenado.cash` → `https://zdoge.cash`
  - Changed `https://www.dogenado.cash` → `https://www.zdoge.cash`

### Documentation
- ✅ Updated `docs/docusaurus.config.ts` URL to `https://docs.zdoge.cash`
- ✅ All documentation content updated to zDoge branding

### Frontend
- ✅ Navbar already references `docs.zdoge.cash`

## 🔧 Infrastructure Changes (You Need to Do)

### 1. GoDaddy DNS Configuration

Since `zdoge.cash` is on GoDaddy, you need to set up DNS records:

#### For Main Site (zdoge.cash)
```
Type: A Record
Name: @
Value: [Vercel IP or CNAME to Vercel]
TTL: 3600

Type: CNAME
Name: www
Value: [Vercel domain or zdoge.cash]
TTL: 3600
```

#### For Docs Site (docs.zdoge.cash)
```
Type: CNAME
Name: docs
Value: [Vercel domain for docs or docs.zdoge.cash]
TTL: 3600
```

### 2. Vercel Configuration

#### Main Site (zdoge.cash)
1. Go to Vercel Dashboard → Your Project
2. Settings → Domains
3. Add Domain:
   - `zdoge.cash`
   - `www.zdoge.cash`
4. Vercel will provide DNS instructions if needed

#### Docs Site (docs.zdoge.cash)
1. Go to Vercel Dashboard → Your Docs Project
2. Settings → Domains
3. Add Domain:
   - `docs.zdoge.cash`
4. Follow DNS setup instructions

### 3. Render Backend (No Changes Needed)

The backend CORS is already updated in code. After you deploy:
- Backend will accept requests from `zdoge.cash` and `www.zdoge.cash`
- No Render configuration changes needed

### 4. Environment Variables (Check)

Check if you have any environment variables referencing the old domain:

#### Vercel Environment Variables
- Check for `NEXT_PUBLIC_*` variables with `dogenado.cash`
- Update to `zdoge.cash` if found

#### Render Environment Variables
- Check backend environment variables
- Update any `dogenado.cash` references to `zdoge.cash`

## 📋 Migration Checklist

### DNS Setup
- [ ] Configure `zdoge.cash` A/CNAME record in GoDaddy
- [ ] Configure `www.zdoge.cash` CNAME record in GoDaddy
- [ ] Configure `docs.zdoge.cash` CNAME record in GoDaddy
- [ ] Wait for DNS propagation (can take up to 48 hours, usually 1-2 hours)

### Vercel Setup
- [ ] Add `zdoge.cash` domain to main project
- [ ] Add `www.zdoge.cash` domain to main project
- [ ] Add `docs.zdoge.cash` domain to docs project
- [ ] Verify SSL certificates are issued (automatic)

### Code Deployment
- [ ] Deploy backend with updated CORS (already done in code)
- [ ] Deploy frontend (no code changes needed)
- [ ] Deploy docs (already updated)

### Testing
- [ ] Test `https://zdoge.cash` loads correctly
- [ ] Test `https://www.zdoge.cash` redirects/loads correctly
- [ ] Test `https://docs.zdoge.cash` loads correctly
- [ ] Test API calls from frontend to backend work
- [ ] Test CORS is working (no CORS errors in browser console)

### Old Domain (Optional)
- [ ] Set up redirects from `dogenado.cash` → `zdoge.cash` (if you want to keep old domain)
- [ ] Set up redirects from `docs.dogenado.cash` → `docs.zdoge.cash` (if you want to keep old domain)

## 🚨 Important Notes

1. **DNS Propagation**: DNS changes can take 1-48 hours to propagate globally. Use tools like:
   - https://dnschecker.org
   - https://www.whatsmydns.net

2. **SSL Certificates**: Vercel automatically provisions SSL certificates via Let's Encrypt. This happens automatically after DNS is configured.

3. **Backend CORS**: The backend code is already updated. After deploying, it will accept requests from the new domain.

4. **No Breaking Changes**: The backend API endpoints don't change, only the CORS configuration.

5. **Documentation**: All docs are already updated to reference `zdoge.cash`.

## 🔍 Verification Steps

After DNS is configured and sites are deployed:

1. **Check Main Site**:
   ```bash
   curl -I https://zdoge.cash
   # Should return 200 OK
   ```

2. **Check Docs Site**:
   ```bash
   curl -I https://docs.zdoge.cash
   # Should return 200 OK
   ```

3. **Check Backend CORS**:
   - Open browser console on zdoge.cash
   - Make an API call
   - Should not see CORS errors

4. **Check SSL**:
   - Visit https://zdoge.cash
   - Should show valid SSL certificate
   - Browser should show lock icon

## 📞 Support

If you encounter issues:
1. Check DNS propagation status
2. Verify Vercel domain configuration
3. Check Vercel deployment logs
4. Verify backend is deployed with new CORS settings

