# Deploy Updated Docs Checklist

## Current Status
- ✅ Main site (`zdoge.cash`) - Live and correct
- ❌ Docs site (`docs.zdoge.cash`) - Live but showing old content

## What Needs to Happen

The docs site needs to be rebuilt and redeployed with the updated content.

## Deployment Steps

### Option 1: Vercel Auto-Deploy (If Connected to Git)
1. Commit and push all the docs changes we made
2. Vercel will automatically detect changes and redeploy
3. Wait for deployment to complete
4. Verify `docs.zdoge.cash` shows new zDoge content

### Option 2: Manual Deploy
1. Go to Vercel Dashboard → Docs Project
2. Click "Redeploy" or trigger a new deployment
3. Wait for build to complete
4. Verify `docs.zdoge.cash` shows new zDoge content

## What Changed in Docs

All these files were updated:
- `docs/docusaurus.config.ts` - Branding and URLs
- `docs/docs/intro.md` - zDoge introduction
- `docs/docs/how-it-works.md` - Shielded system explanation
- `docs/docs/user-guide/shield.md` - New shield guide
- `docs/docs/user-guide/transfer.md` - New transfer guide
- `docs/docs/user-guide/swap.md` - New swap guide
- `docs/docs/user-guide/unshield.md` - New unshield guide
- All technical docs updated
- All resource docs updated

## After Deployment

Once docs are deployed with new content:
1. ✅ Verify `docs.zdoge.cash` shows "zDoge" branding
2. ✅ Verify it shows shielded system (not mixer)
3. ✅ Verify all links point to `zdoge.cash`
4. ✅ Then remove old `docs.dogenado.cash` domain from Vercel

