# 03. Edge Cases & Concurrency Matrix (Pre-Flight Gate)

> **"Code generated on the happy path works on `localhost:3000` and collapses under production concurrency."**

---

## The Concurrency Blindspot in Generative Code

LLMs default to sequential, single-threaded, happy-path mental models. When asked to implement balance updates, inventory decrements, or token refreshes, an AI model will almost invariably write the classic **Read-Modify-Write Race Condition**:

```typescript
// ❌ VIBE ANTI-PATTERN: Prone to double-spend / lost updates
const account = await db.account.findUnique({ where: { id } });
if (account.balance >= amount) {
  // If two requests reach here simultaneously, both read the same balance!
  await db.account.update({
    where: { id },
    data: { balance: account.balance - amount },
  });
}
```

---

## 1. Concurrency Patterns for AI-Assisted Workflows

Before prompting the AI to implement stateful logic, choose and declare the concurrency mitigation strategy.

### Strategy A: Atomic SQL Decrements with Conditionals (Best for simple counters/balances)

Instead of reading to memory and calculating in JS, delegate the atomic decrement directly to the database engine:

```sql
-- ✅ Atomic & safe against concurrent requests
UPDATE accounts 
SET balance_cents = balance_cents - $1, updated_at = NOW()
WHERE id = $2 AND balance_cents >= $1;
```

If `rows_affected === 0`, you know immediately that either the account doesn't exist or funds were insufficient. Zero race condition possible.

---

### Strategy B: Optimistic Concurrency Control (OCC) with Versioning

When complex entity state must be read and validated across multiple fields:

```sql
UPDATE orders
SET status = 'shipped', version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $2;
```

If `rows_affected === 0`, another process modified the record in the interim. Throw a `ConcurrencyConflictError` and trigger an automated retry loop.

---

### Strategy C: Explicit Pessimistic Locking (`SELECT FOR UPDATE`)

For high-value, strictly ordered financial operations within a transaction:

```typescript
await db.transaction(async (tx) => {
  // Locks the rows until the transaction commits or aborts
  const [sender] = await tx.raw(
    'SELECT * FROM accounts WHERE id = ? FOR UPDATE',
    [fromAccountId]
  );
  const [recipient] = await tx.raw(
    'SELECT * FROM accounts WHERE id = ? FOR UPDATE',
    [toAccountId]
  );

  if (sender.balance_cents < amountCents) {
    throw new Error('Insufficient funds');
  }

  await tx('accounts').where({ id: fromAccountId }).decrement('balance_cents', amountCents);
  await tx('accounts').where({ id: toAccountId }).increment('balance_cents', amountCents);
});
```

> **Warning on Deadlocks:** Always acquire locks in a deterministic order (e.g., sort account IDs lexicographically: `[idA, idB].sort()`) to prevent deadlock loops between concurrent reciprocal transfers.

---

## 2. Idempotency Key Architecture

Every non-idempotent mutation (payments, emails, webhook dispatches) must be protected by an idempotency gate.

```
Incoming Request (with Idempotency-Key: "req_xyz")
       │
       ▼
[Check Idempotency Table]
   ├── Key exists & status = 'completed' ──> Return cached response (200 OK)
   ├── Key exists & status = 'in_progress' ──> Return 409 Conflict / Retry-After
   └── Key does NOT exist ──> Insert key ('in_progress') ──> Execute ──> Update ('completed')
```

---

## 3. The Edge Case Matrix Template

Before handing a task to an LLM, document the Edge Case Matrix in the pre-flight spec:

| Trigger / Condition | Failure Mode | Mitigation Strategy |
| :--- | :--- | :--- |
| **Duplicate Rapid Clicks** | Double debit / duplicate record | Idempotency Key in DB unique constraint |
| **Simultaneous Transfers** | Lost update / negative balance | Atomic SQL decrement or `FOR UPDATE` |
| **Partial Failure Mid-Operation** | Money debited but not credited | Wrap in single ACID database transaction |
| **Downstream 3rd Party Timeout** | Hanging connection / connection exhaustion | Strict 3000ms timeout + circuit breaker |
| **Large Result Set** | Memory overflow / OOM crash | Enforce keyset or cursor-based pagination |

---

## Pre-Flight Concurrency Checklist

- [ ] Are simultaneous mutations on shared state protected by atomic updates, OCC, or pessimistic locks?
- [ ] Are multiple lock acquisitions ordered deterministically to avoid deadlocks?
- [ ] Is an idempotency mechanism defined for financial or state-altering endpoints?
- [ ] Are outbound network calls bounded by strict timeout configurations?
- [ ] Are unbounded lists protected with mandatory pagination limits?
