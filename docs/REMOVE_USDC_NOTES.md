# Remove USDC Notes (Quick Guide)

## Easiest Method: Browser Console

Open your browser console (F12) and run:

```javascript
// Remove all USDC notes
const { removeNotesForToken } = await import('/lib/shielded/shielded-service.js');
const removed = removeNotesForToken('USDC');
console.log(`Removed ${removed} USDC note(s)`);
```

**OR** manually via localStorage:

```javascript
// Get your wallet address
const walletAddress = window.ethereum?.selectedAddress?.toLowerCase() || 'default';
const notesKey = `dogenado_shielded_notes_${walletAddress}`;

// Load current notes
const notes = JSON.parse(localStorage.getItem(notesKey) || '[]');
console.log('Current notes:', notes);

// Filter out USDC notes
const filteredNotes = notes.filter(note => note.token !== 'USDC');
console.log('Removed:', notes.length - filteredNotes.length, 'USDC note(s)');

// Save back
localStorage.setItem(notesKey, JSON.stringify(filteredNotes));

// Refresh page
location.reload();
```

## What Happens

- ✅ Removes all USDC notes from local storage
- ✅ Your shielded balance will update immediately
- ✅ Notes are from the old contract anyway (can't use them with new contract)
