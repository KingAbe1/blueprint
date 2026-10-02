# 02. The Test-Driven Prompt Harness (Pre-Flight Gate)

> **"In AI-driven development, automated tests are not an afterthought—they are your prompt constraints."**

---

## The Paradigm Shift: Tests as AI Guardrails

In traditional development, TDD is often skipped under time pressure. In AI-assisted workflows, **skipping tests makes coding slower, not faster**.

When you give an LLM a feature prompt without tests, it has no feedback loop. It writes code that *looks* syntactically correct, but subtly fails on boundary conditions. When you provide a failing test harness, the agent can run the tests, parse the failure stack trace, and self-correct until all assertions pass.

```
Without TDD:
Prompt ──> AI Output ──> Manual Human QA ──> Bug Found ──> Confusing Prompt ──> Regression

With Blueprint TDD Harness:
Failing Test Spec ──> AI Output ──> Automated Runner ──> [Fails] ──> AI Refines ──> [Passes] ──> Diff Audit
```

---

## 1. Structuring the Closed-Loop Test Spec

A proper Pre-Flight Test Suite defines four layers of assertions before implementation begins:

1. **Happy Path**: Expected baseline behavior with standard inputs.
2. **Boundary & Value Limits**: Zero values, max integers, empty strings, oversized payloads.
3. **Domain Invariant Violations**: Attempting to violate business rules (e.g., negative balance, unauthorized transition).
4. **Failure & Rollback Behavior**: Simulating database errors or network timeouts to verify atomic rollbacks.

---

## 2. Practical Example: Pre-Flight Test Suite (Jest / Vitest)

Below is the failing test harness written **before** generating `TransferService`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TransferService } from './transfer-service';
import { db } from '../db';

describe('TransferService (Pre-Flight Harness)', () => {
  let service: TransferService;

  beforeEach(async () => {
    await db.migrate.rollback();
    await db.migrate.latest();
    service = new TransferService(db);
  });

  describe('executeTransfer()', () => {
    it('successfully transfers balance between two active accounts atomically', async () => {
      const fromAcc = await createAccount({ balanceCents: 10_000, status: 'active' });
      const toAcc = await createAccount({ balanceCents: 5_000, status: 'active' });

      const result = await service.executeTransfer({
        idempotencyKey: 'tx-001',
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        amountCents: 3_000,
      });

      expect(result.status).toBe('completed');
      expect(await getBalance(fromAcc.id)).toBe(7_000);
      expect(await getBalance(toAcc.id)).toBe(8_000);
    });

    it('rejects transfers exceeding available balance without altering state', async () => {
      const fromAcc = await createAccount({ balanceCents: 2_000, status: 'active' });
      const toAcc = await createAccount({ balanceCents: 5_000, status: 'active' });

      await expect(
        service.executeTransfer({
          idempotencyKey: 'tx-002',
          fromAccountId: fromAcc.id,
          toAccountId: toAcc.id,
          amountCents: 5_000,
        })
      ).rejects.toThrow(/insufficient funds/i);

      // Verify no partial debits occurred
      expect(await getBalance(fromAcc.id)).toBe(2_000);
      expect(await getBalance(toAcc.id)).toBe(5_000);
    });

    it('enforces idempotency on duplicate transaction keys', async () => {
      const fromAcc = await createAccount({ balanceCents: 10_000, status: 'active' });
      const toAcc = await createAccount({ balanceCents: 5_000, status: 'active' });

      const payload = {
        idempotencyKey: 'tx-duplicate-test',
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        amountCents: 1_000,
      };

      const firstCall = await service.executeTransfer(payload);
      const secondCall = await service.executeTransfer(payload);

      expect(firstCall.id).toBe(secondCall.id);
      // Balance must only be deducted ONCE
      expect(await getBalance(fromAcc.id)).toBe(9_000);
      expect(await getBalance(toAcc.id)).toBe(6_000);
    });

    it('aborts and rolls back if recipient account is frozen or closed', async () => {
      const fromAcc = await createAccount({ balanceCents: 10_000, status: 'active' });
      const frozenAcc = await createAccount({ balanceCents: 1_000, status: 'frozen' });

      await expect(
        service.executeTransfer({
          idempotencyKey: 'tx-003',
          fromAccountId: fromAcc.id,
          toAccountId: frozenAcc.id,
          amountCents: 1_000,
        })
      ).rejects.toThrow(/recipient account is not active/i);

      expect(await getBalance(fromAcc.id)).toBe(10_000);
    });
  });
});
```

---

## 3. The Closed-Loop Prompt Prompting Pattern

Once the test spec is written, feed it to the AI tool with this structured prompt:

```markdown
### TASK
Implement `TransferService` in `src/services/transfer-service.ts` to make the test suite in `tests/transfer-service.spec.ts` pass.

### BOUNDARIES & CONSTRAINTS
1. Do NOT modify any assertions in `tests/transfer-service.spec.ts`.
2. Wrap all database operations inside a single atomic transaction.
3. Handle idempotency via the `transfers` table unique constraint.
4. Run the test command `npm test tests/transfer-service.spec.ts` and iterate until all tests are green.
```

---

## Pre-Flight TDD Checklist

- [ ] Is the test harness written and failing **before** starting implementation?
- [ ] Does the test harness cover boundary conditions (zero amounts, negative values, max limits)?
- [ ] Does the test harness verify idempotency on duplicate requests?
- [ ] Does the test suite verify that failed operations leave state completely unchanged (rollback check)?
- [ ] Are test assertions strict on side effects (e.g., verifying balances in DB, not just mocked return values)?
