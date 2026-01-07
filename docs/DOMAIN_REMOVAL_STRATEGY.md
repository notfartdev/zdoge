# Domain Removal Strategy: dogenado.cash → zdoge.cash

## Recommendation: Remove Old Domain Immediately

### ✅ Clean Rebranding Approach

**Remove `dogenado.cash` and `docs.dogenado.cash` immediately** to avoid confusion and maintain clear branding.

### Why Remove Immediately?

1. **Clear Branding**: No confusion between old and new brand
2. **Clean Migration**: Forces users to new domain immediately
3. **Simpler Setup**: No need to maintain redirects
4. **Fresh Start**: Complete rebrand without old domain baggage
5. **Less Maintenance**: One less thing to manage

## Step-by-Step Plan

### Phase 1: Remove Old Domains (Immediate)

#### In Vercel (Main Site)
1. **Remove** `dogenado.cash` domain:
   - Go to Project Settings → Domains
   - Click on `dogenado.cash`
   - Click "Remove" or "Delete"
   - Confirm removal

2. **Remove** `www.dogenado.cash` domain:
   - Same process as above

#### In Vercel (Docs Site)
1. **Remove** `docs.dogenado.cash` domain:
   - Go to Docs Project Settings → Domains
   - Click on `docs.dogenado.cash`
   - Click "Remove" or "Delete"
   - Confirm removal

#### In GoDaddy (Optional)
1. Remove DNS records for `dogenado.cash` (if you want to completely let it expire)
2. Or keep DNS but point to nothing (domain will show error)

## Important Notes

### What Happens When You Remove:

1. **Old Domain Access**: 
   - `dogenado.cash` will no longer work
   - Users will get DNS/connection errors
   - Bookmarks will break

2. **SEO Impact**:
   - Search engines will eventually update to new domain
   - Old links will stop working
   - May take time for search rankings to transfer

3. **User Communication**:
   - Consider announcing the domain change
   - Update social media links
   - Update any marketing materials

## Communication Plan

Before removing old domains, consider:

1. **Social Media Announcement**:
   - Post about the rebrand
   - Update all social media links
   - Pin announcement if possible

2. **Update Links**:
   - GitHub README
   - Any documentation
   - Marketing materials
   - Email signatures

3. **Search Engine**:
   - Submit new domain to Google Search Console
   - Update sitemaps
   - Monitor indexing

## Checklist

### Pre-Removal Phase
- [ ] Deploy new domain (`zdoge.cash`) and verify it works
- [ ] Deploy new docs domain (`docs.zdoge.cash`) and verify it works
- [ ] Update all social media links to new domain
- [ ] Update GitHub README and documentation
- [ ] Announce domain change (if desired)
- [ ] Submit new domain to Google Search Console

### Removal Phase
- [ ] Remove `dogenado.cash` from Vercel main project
- [ ] Remove `www.dogenado.cash` from Vercel main project
- [ ] Remove `docs.dogenado.cash` from Vercel docs project
- [ ] Verify old domains no longer work
- [ ] Update any remaining references in code/docs

### Post-Removal Phase
- [ ] Monitor new domain traffic
- [ ] Check search engine indexing
- [ ] Verify all links updated
- [ ] Remove DNS records from GoDaddy (optional)

## Recommendation Summary

**Remove old domains immediately** to avoid confusion and maintain clear branding.

This approach:
- ✅ Clear rebranding (no confusion)
- ✅ Simpler setup (no redirects to maintain)
- ✅ Forces users to new domain
- ✅ Clean migration

