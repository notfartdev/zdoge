# Clear All Shielded Notes

## Quick Method: Browser Console

Open your browser's developer console (F12) and run this command:

```javascript
// Clear all shielded notes
const walletAddress = window.ethereum?.selectedAddress?.toLowerCase() || 'default';
const notesKey = `dogenado_shielded_notes_${walletAddress}`;
localStorage.removeItem(notesKey);
console.log('✅ All shielded notes cleared!');
location.reload();
```

This will:
1. ✅ Remove all notes from local storage
2. ✅ Refresh the page (balance will show 0)
3. ✅ Keep your shielded identity (you don't need to re-initialize)

## After Clearing

- Your shielded balance will show 0 (correct, since new contract has empty Merkle tree)
- You'll need to **re-shield tokens** into the new contract
- Old contract notes won't work anyway, so it's safe to clear them

## Note

This only clears notes from **local storage** (your wallet state). If you had tokens in the old contract, you'd need to unshield them from that contract separately. But since you're starting fresh with the new contract, clearing local notes is fine.
