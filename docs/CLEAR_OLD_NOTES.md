# How to Clear Old Notes from Local Storage

Since we deployed a new contract, notes from the old contract are no longer valid. Here's how to remove them:

## Option 1: Browser Console (Easiest)

Open your browser's developer console (F12) and run:

```javascript
// Remove all USDC notes
const walletAddress = window.ethereum?.selectedAddress?.toLowerCase() || 'default';
const notesKey = `dogenado_shielded_notes_${walletAddress}`;
const notes = JSON.parse(localStorage.getItem(notesKey) || '[]');
const filteredNotes = notes.filter(note => note.token !== 'USDC');
localStorage.setItem(notesKey, JSON.stringify(filteredNotes));
console.log(`Removed ${notes.length - filteredNotes.length} USDC note(s)`);
location.reload(); // Refresh the page
```

## Option 2: Clear All Notes (Nuclear Option)

If you want to clear ALL notes (useful when migrating to new contract):

```javascript
const walletAddress = window.ethereum?.selectedAddress?.toLowerCase() || 'default';
const notesKey = `dogenado_shielded_notes_${walletAddress}`;
localStorage.removeItem(notesKey);
console.log('All notes cleared');
location.reload();
```

## Option 3: Clear Notes for Specific Token

```javascript
// Replace 'USDC' with the token you want to remove
const tokenToRemove = 'USDC';
const walletAddress = window.ethereum?.selectedAddress?.toLowerCase() || 'default';
const notesKey = `dogenado_shielded_notes_${walletAddress}`;
const notes = JSON.parse(localStorage.getItem(notesKey) || '[]');
const filteredNotes = notes.filter(note => note.token !== tokenToRemove);
localStorage.setItem(notesKey, JSON.stringify(filteredNotes));
console.log(`Removed ${notes.length - filteredNotes.length} ${tokenToRemove} note(s)`);
location.reload();
```

## Option 4: Use filterValidNotes (Automatic)

The `filterValidNotes` function automatically removes notes that don't exist in the current contract. It's called automatically when you try to swap/transfer, but you can also trigger it manually by:

1. Opening swap interface
2. The system will automatically filter out invalid notes
3. Your balance should update to show only valid notes

## Note

After clearing old notes:
- Your shielded balance will show correctly for the new contract
- You'll need to re-shield tokens into the new contract
- Old contract notes are no longer usable
