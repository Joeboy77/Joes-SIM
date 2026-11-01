# The cache

A cache sits between the processor and the 100 mailboxes (brief, Phase 7). Like the pipeline,
it is a model over the real run: the machine runs the program, and its memory accesses are
replayed through the cache. Results never change; the cache counts hits, misses and time. The
code is in `packages/engine/src/machines/cache/cache.ts`, and the examples below are its tests.

## Configuration

| Setting        | Values                                         | Default    |
| -------------- | ---------------------------------------------- | ---------- |
| Block size     | 1, 2, 4 or 8 mailboxes                         | 2          |
| Sets           | 1 (fully associative), 2, 4, 8, 16 or 32       | 4          |
| Ways           | 1 (direct-mapped), 2, 4 or 8 blocks per set    | 1          |
| Replacement    | LRU, FIFO or random (seeded, so runs repeat)   | LRU        |
| Write policy   | write-back or write-through                    | write-back |
| Miss penalty   | cycles to read a block from memory             | 10         |
| Hit time       | cycles for a hit                               | 1          |
| What it caches | data accesses only, or instruction fetches too | data only  |

Block size × sets must be at most 128. Sizes are powers of two so that an address splits into
bit fields, as in textbooks.

## Splitting an address

Addresses 00 to 99 are written as 7-bit binary numbers. The low bits are the **offset** within
the block (log₂ block size), the next bits the **index** of the set (log₂ sets), and the rest the
**tag**. For example, with 2-mailbox blocks and 2 sets, address 5 = 0000101 splits as tag 00001,
index 0, offset 1. With 4-mailbox blocks and 8 sets, 99 = 1100011 is tag 11, index 000,
offset 11. A fully associative cache with 1-mailbox blocks has no index or offset: the whole
address is the tag.

## Policies

- **Replacement** picks the way to reuse when a set is full: the least recently used (LRU), the
  one loaded longest ago (FIFO), or one at random, from a seeded xorshift generator.
- **Write-back** with **write-allocate**: a write miss loads the block, writes mark it **dirty**,
  and a dirty block is written to memory only when it is thrown out (a write-back).
- **Write-through** with **no-write-allocate**: every write also goes to memory, and a write
  miss does not load the block.
- **Average access time** = hit time + miss rate × miss penalty.

## Kinds of miss

- **Compulsory**: the block has never been in the cache before.
- **Capacity**: a fully associative LRU cache of the same total size would also miss. In a
  fully associative cache every miss that is not compulsory counts as capacity.
- **Conflict**: the fully associative cache would have hit; the block was thrown out because
  others mapped to the same set.

The fully associative cache used for this check allocates on writes exactly as the real one does.

## Hand-worked examples

Reads unless marked W. Each result is listed per access (C compulsory, P capacity, X conflict,
H hit).

1. **Direct-mapped**, 4 sets, 1-mailbox blocks; reads 0 4 0 8 1 5 1. 0, 4 and 8 share set 0; 1
   and 5 share set 1. Results C C X C C C X: no hits, 5 compulsory and 2 conflict misses. The
   second 0 and second 1 are conflict misses because a 4-block fully associative cache would
   still hold them.
2. **Two-way set-associative LRU**, 2 sets: the same reads give C C H C C C H. The 8 replaces 4,
   the least recently used block in set 0. Hit rate 2/7; average access time 1 + 5/7 × 10 ≈ 8.14
   cycles.
3. **Fully associative FIFO**, 2 ways; reads 0 1 0 2 0 1: C C H C P P. The 2 throws out 0, the
   oldest, although it was just used.
4. **Fully associative LRU**, the same reads: C C H C H P. The 2 throws out 1 instead.
5. **2-mailbox blocks**, direct-mapped, 2 sets; reads 0 1 2 3 4 0: C H C H C P. Each miss brings
   in the neighbouring mailbox, so 1 and 3 hit.
6. **Write-back**, direct-mapped, 2 sets; W0 R0 W2 R1 W1 R3: C H C C H C. W2 throws out the
   dirty block 0 and R3 the dirty block 1: 2 write-backs, no writes through.
7. **Write-through**, the same accesses: C C C C H C. W0 and W2 are write misses that load
   nothing, so R0 is still a compulsory miss. W0, W2 and W1 all go to memory: 3 writes through,
   no write-backs.
8. **Random replacement**: the same seed always gives the same results; different seeds give
   different ones.
9. **Address splitting**: as above (5, 99 and 37).
10. **A program**: `LDA a; ADD a; HLT`. Its accesses are fetch 00, read 03, fetch 01, read 03,
    fetch 02. A data-only direct-mapped cache with 4 sets sees read 03 twice: 1 miss, 1 hit.
    Caching fetches too, it sees all five: 1 hit, 4 misses.
