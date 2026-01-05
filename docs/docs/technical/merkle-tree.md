---
id: merkle-tree
title: Merkle Tree
sidebar_position: 4
---

# Merkle Tree

zDoge uses a Merkle tree to efficiently store and verify shielded note commitments.

## What is a Merkle Tree?

A Merkle tree is a hash-based data structure where:
- **Leaves** contain data (commitments)
- **Nodes** contain hashes of their children
- **Root** is a single hash representing all data

```
                    Root
                   /    \
                 H12     H34
                /   \   /   \
              H1    H2 H3   H4
              |     |   |    |
             C1    C2  C3   C4
        (shielded notes/commitments)
```

## Why Merkle Trees?

### Efficient Membership Proofs

To prove a commitment exists, you only need:
- The commitment
- Sibling hashes along the path
- The root

This is **O(log n)** instead of **O(n)**.

### Example (4 commitments)

To prove C2 exists:
```
Path: C2 → H2 → H12 → Root

Needed: C2, H1, H34
Steps: 
  1. H2 = hash(C2)
  2. H12 = hash(H1, H2)
  3. Root = hash(H12, H34)
  
If computed Root matches stored Root → C2 exists!
```

## zDoge's Merkle Tree

### Configuration

| Parameter | Value |
|-----------|-------|
| Height | 20 levels |
| Max Leaves | 2^20 = 1,048,576 |
| Hash Function | MiMC Sponge |
| Leaf Type | MiMC commitment |

### Root History

The contract stores the last 30 roots:

```solidity
uint32 public constant ROOT_HISTORY_SIZE = 30;
bytes32[ROOT_HISTORY_SIZE] public roots;
```

This allows transactions even if new notes are added between proof generation and submission.

## MiMC Hash Function

Merkle tree nodes use MiMC Sponge hashing:

```
H(left, right) = MiMCSponge(left, right)
```

### Why MiMC?

| Property | Benefit |
|----------|---------|
| ZK-friendly | Low constraint count in circuits |
| Collision resistant | Secure hash function |
| Deterministic | Same inputs → same output |

### Hash Computation

```javascript
function hash(left, right) {
  const result = mimcsponge.multiHash([left, right]);
  return result;
}
```

## Tree Updates

When a note is shielded:

### 1. Insert Commitment

```solidity
function _insert(bytes32 _leaf) internal returns (uint32 index) {
    uint32 _nextIndex = nextIndex;
    require(_nextIndex != uint32(2)**levels, "Merkle tree is full");
    
    uint32 currentIndex = _nextIndex;
    bytes32 currentLevelHash = _leaf;
    
    // Update path from leaf to root
    for (uint32 i = 0; i < levels; i++) {
        if (currentIndex % 2 == 0) {
            // Left child
            filledSubtrees[i] = currentLevelHash;
            currentLevelHash = hashLeftRight(currentLevelHash, zeros(i));
        } else {
            // Right child
            currentLevelHash = hashLeftRight(filledSubtrees[i], currentLevelHash);
        }
        currentIndex /= 2;
    }
    
    // Update root
    currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
    roots[currentRootIndex] = currentLevelHash;
    nextIndex = _nextIndex + 1;
    
    return _nextIndex;
}
```

### 2. Tree State After Updates

```
Initial (empty):
        0
       / \
      0   0
     /\   /\
    0  0 0  0

After shield C1:
         R1
        /  \
      H10   0
      /\   /\
    C1  0 0  0

After shield C2:
         R2
        /  \
      H12   0
      /\   /\
    C1 C2 0  0
```

## Merkle Proofs

### Proof Structure

A Merkle proof consists of:

```typescript
interface MerkleProof {
  pathElements: string[];  // Sibling hashes (20 elements)
  pathIndices: number[];   // Left(0) or Right(1) position (20 bits)
}
```

### Generating a Proof

```typescript
function generateProof(commitment, tree) {
  const index = tree.indexOf(commitment);
  const pathElements = [];
  const pathIndices = [];
  
  let currentIndex = index;
  for (let level = 0; level < TREE_HEIGHT; level++) {
    const siblingIndex = currentIndex ^ 1;  // XOR to get sibling
    pathElements.push(tree.getNode(level, siblingIndex));
    pathIndices.push(currentIndex & 1);  // 0 if left, 1 if right
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return { pathElements, pathIndices };
}
```

### Verifying a Proof

```typescript
function verifyProof(commitment, root, pathElements, pathIndices) {
  let currentHash = commitment;
  
  for (let i = 0; i < pathElements.length; i++) {
    if (pathIndices[i] === 0) {
      currentHash = hash(currentHash, pathElements[i]);
    } else {
      currentHash = hash(pathElements[i], currentHash);
    }
  }
  
  return currentHash === root;
}
```

## Zero Values

Empty tree positions use precomputed "zero" values:

```
ZERO_VALUE = keccak256("dogenado") % FIELD_SIZE

zeros[0] = ZERO_VALUE
zeros[1] = hash(zeros[0], zeros[0])
zeros[2] = hash(zeros[1], zeros[1])
...
zeros[19] = hash(zeros[18], zeros[18])
```

This allows efficient computation of roots for partially filled trees.

## Security Properties

### Collision Resistance

Finding two different sets of commitments that produce the same root is computationally infeasible.

### Preimage Resistance

Given a root, finding the commitments that produce it is computationally infeasible.

### Proof Binding

A valid Merkle proof uniquely binds a commitment to a specific position in the tree.

## Performance

| Operation | Complexity |
|-----------|------------|
| Insert | O(log n) |
| Generate Proof | O(log n) |
| Verify Proof | O(log n) |
| Storage | O(log n) for path |

With n = 1,048,576 and height = 20:
- Insert: 20 hash operations
- Proof: 20 sibling hashes
- Verify: 20 hash comparisons

---

**Back to:** [Architecture Overview](/technical/architecture)
