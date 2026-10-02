# 01. System Architecture & Schema First (Pre-Flight Gate)

> **"If the domain boundaries are rock-solid, the LLM cannot hallucinate bad state."**

---

## The Problem: The "Vibe Coding" Anti-Pattern

In rapid AI prototyping, developers frequently ask models to generate API routes, UI components, and business logic before formalizing the underlying data structures:

```
❌ The Vibe Path:
"Build me an endpoint where users can transfer funds to another user"
       ↓
LLM invents an ad-hoc JSON payload with untyped fields, executes unconstrained updates,
and ignores transactional boundaries.
```

### Consequences
- **Silent Invariant Violations**: Floating-point balance storage (`0.1 + 0.2 !== 0.3`), negative balances, dangling references.
- **Cascading Refactor Debt**: Changing schema details after 500 lines of UI and server logic are written creates exponential hallucination cascades during rewrites.
- **Orphan Records**: Missing foreign key cascade rules or soft-delete inconsistencies.

---

## The Blueprint Approach: Invariants First

Before writing a single line of business logic or UI, enforce a strict **Pre-Flight Schema Gate**:

```
✅ The Blueprint Path:
1. Define Strict Domain Types & Constraints (Nullability, Enums, State Transitions)
2. Enforce DB-Level Invariants (Check Constraints, Foreign Keys, Unique Indexes)
3. Formalize the State Machine
4. Feed schema contracts as the primary context to the LLM
```

---

## 1. Defining Database Invariants

Never rely solely on application-level validation. Database constraints are your last line of defense against hallucinations and race conditions.

### Anti-Pattern vs. Production-Grade Schema (PostgreSQL Example)

#### ❌ Fragile "Vibe" Schema
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    balance FLOAT, -- Precision loss, negative balances allowed
    status TEXT    -- Any arbitrary string can be inserted
);

CREATE TABLE transfers (
    id TEXT PRIMARY KEY,
    from_account TEXT,
    to_account TEXT,
    amount FLOAT,
    created_at TIMESTAMP
);
```

#### ✅ Hardened Blueprint Schema
```sql
CREATE TYPE account_status AS ENUM ('active', 'frozen', 'closed');

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    -- Explicit integer-cents representation prevents float precision errors
    balance_cents BIGINT NOT NULL DEFAULT 0,
    status account_status NOT NULL DEFAULT 'active',
    version INT NOT NULL DEFAULT 0, -- For optimistic locking
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    -- Invariants enforced directly at the storage engine
    CONSTRAINT chk_positive_balance CHECK (balance_cents >= 0)
);

CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    from_account_id UUID NOT NULL REFERENCES accounts(id),
    to_account_id UUID NOT NULL REFERENCES accounts(id),
    amount_cents BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT chk_transfer_positive_amount CHECK (amount_cents > 0),
    CONSTRAINT chk_distinct_accounts CHECK (from_account_id <> to_account_id)
);

-- Indexing foreign keys & query lookups upfront
CREATE INDEX idx_transfers_from_account ON transfers(from_account_id, created_at DESC);
CREATE INDEX idx_transfers_to_account ON transfers(to_account_id, created_at DESC);
```

---

## 2. Explicit State Machines

LLMs struggle with undefined states. If your entity has lifecycle transitions (e.g., `Draft -> Submitted -> Approved -> Rejected`), explicitly document the transition matrix in your pre-flight specification.

```
                  ┌───────────────┐
                  │     DRAFT     │
                  └───────┬───────┘
                          │ submit()
                          ▼
                  ┌───────────────┐
                  │   SUBMITTED   │
                  └──┬─────────┬──┘
          approve()  │         │ reject()
                     ▼         ▼
        ┌──────────────┐     ┌──────────────┐
        │   APPROVED   │     │   REJECTED   │
        └──────┬───────┘     └──────────────┘
               │ archive()
               ▼
        ┌──────────────┐
        │   ARCHIVED   │
        └──────────────┘
```

### Strict Transition Validator Pattern (TypeScript)

```typescript
export const VALID_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['archived'],
  rejected: ['draft'], // Allow re-opening
  archived: [],
} as const;

export type OrderStatus = keyof typeof VALID_TRANSITIONS;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = VALID_TRANSITIONS[from] as readonly string[];
  return allowed.includes(to);
}
```

---

## 3. Pre-Flight Schema Prompt Template

When feeding your data layer to an AI coding tool (Cursor, Claude Code, etc.), use this prompt framing:

```markdown
### SYSTEM CONTEXT & DATA CONTRACTS
You are implementing the service layer for `TransferService`.
Below is the authoritative database schema and domain types. 

RULES:
1. You may NOT alter the database schema or bypass constraints.
2. Every mutation affecting multiple tables MUST be wrapped in an explicit atomic transaction.
3. Every operation MUST check `account_status === 'active'` and verify sufficient funds.
4. Use optimistic locking via the `version` column to prevent concurrent write collisions.

[ATTACH SCHEMA DDL & TYPES]
```

---

## Pre-Flight Gate Checklist

Before writing implementation code, verify:

- [ ] Are all IDs strongly typed (e.g., UUID or branded types) rather than raw strings?
- [ ] Are money amounts stored as integer cents / fixed decimals rather than floats?
- [ ] Are foreign key constraints and `ON DELETE` behaviors explicitly declared?
- [ ] Are state transitions bounded by an explicit state machine / enum?
- [ ] Are database indexes added for all foreign keys and common sorting fields?
- [ ] Is an `idempotency_key` column present on financial or destructive mutation tables?
