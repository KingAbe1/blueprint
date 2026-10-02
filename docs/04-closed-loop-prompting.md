# 04. Closed-Loop Agentic Prompting (In-Flight Execution)

> **"Treat the AI as an ultra-fast junior engineer operating inside a closed-loop sandbox, not an autonomous architect."**

---

## The In-Flight Workflow

During Phase 2, the developer collaborates with AI coding environments (Cursor, VS Code with Copilot, Claude Code, Antigravity, etc.).

The goal is to maintain strict boundary adherence and prevent context drift.

```
┌─────────────────────────────────────────────────────────────┐
│                   PRE-FLIGHT CONSTRAINTS                    │
│   (Schema DDL, Domain Types, Failing Test Suite, Edge Matrix)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI CODE SYNTHESIS                        │
│   Generates implementation code matching types and specs    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  AUTOMATED TEST RUNNER                      │
│                (Closed-Loop Verification)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
             [FAILS]                       [PASSES]
                │                             │
                ▼                             ▼
   Feed exact stack trace to AI      Proceed to Phase 3:
      "Fix error without changing     Post-Flight Inspection
       test invariants"
```

---

## 1. The Anatomy of an In-Flight Prompt Harness

When prompting the AI, structure your instructions in four distinct compartments:

### Compartment 1: Context & Role
Declare the scope and specific files the model is allowed to touch.

### Compartment 2: Invariant Constraints
Non-negotiable architectural rules (e.g., "Must use Knex transactions", "Never modify schema migrations directly", "Do not import from `src/legacy`").

### Compartment 3: The Target Specification
The exact function signature, input validation schema (Zod/Valibot), and error types.

### Compartment 4: The Closed-Loop Verification Command
The exact test command the agent must use to verify its work.

---

## 2. In-Flight Prompt Template

```markdown
### OBJECTIVE
Implement the `TransferService.executeTransfer` method in `src/services/transfer-service.ts`.

### CONTEXT & CONTRACTS
- Data Types: `src/types/account.ts`
- Schema Constraints: `src/db/migrations/001_accounts.sql`
- Test Harness: `tests/transfer-service.spec.ts`

### ARCHITECTURAL INVARIANTS (NON-NEGOTIABLE)
1. Wrap the entire debit + credit sequence in `db.transaction()`.
2. Check account balances using atomic conditional updates or `SELECT ... FOR UPDATE`.
3. Never swallow errors. Throw domain-specific exceptions (`InsufficientFundsError`, `AccountFrozenError`).
4. Do NOT modify the test assertions in `tests/transfer-service.spec.ts`.

### VERIFICATION
Run `npm test tests/transfer-service.spec.ts`. If any test fails, analyze the output and fix the implementation until 100% green.
```

---

## 3. Handling AI Regressions & Hallucination Loops

If an agent gets stuck in a loop trying to pass tests:

1. **Stop the Generator**: Do not let the model generate larger and larger diffs.
2. **Isolate the Failure**: Run a single failing test case: `npm test -t "enforces idempotency"`.
3. **Feed the Error Trace Specifically**:
   ```
   The test failed with:
   Expected balance: 9000
   Received balance: 8000
   
   Explain the double-debit bug in your previous logic and provide a targeted fix for only that code path.
   ```
4. **Enforce Clean Diffs**: Ask the model to revert unintended changes to surrounding helper files.

---

## In-Flight Gate Checklist

- [ ] Is the AI working against pre-defined types rather than creating new arbitrary interfaces?
- [ ] Are test suites run and verified green before reviewing the diff?
- [ ] Did the AI avoid modifying test assertions to force a "pass"?
- [ ] Are edits strictly contained within the intended module boundaries?
