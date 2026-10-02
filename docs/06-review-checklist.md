# 06. The Code Review & Diff Audit Checklist (Post-Flight Inspection)

> **"Never merge code you cannot explain. Treat the AI's output like a fast junior engineer's pull request."**

---

## The Ruthless Diff Audit Philosophy

AI-generated pull requests often look clean and pass linters, yet hide catastrophic architectural regressions. 

Before approving or merging any AI-assisted code change, the human engineer must conduct a **Post-Flight Inspection** using this audit rubric.

---

## The 6-Point Diff Inspection Protocol

### 1. The N+1 and Query Audit
- [ ] Are queries nested inside `.map()`, `forEach()`, or loops?
- [ ] Are bulk operations batched using `WHERE id IN (...)` or bulk insert/update queries?
- [ ] Do newly added `WHERE` and `JOIN` clauses have corresponding database indexes?
- [ ] Are query result sets bounded by explicit pagination limits?

### 2. Transactional Integrity & Atomicity
- [ ] If multiple tables or documents are mutated, are they wrapped in an atomic database transaction (`db.transaction`)?
- [ ] Is there an explicit rollback mechanism if an intermediate step fails?
- [ ] Are external side effects (e.g., sending emails, charging cards) placed **after** the transaction commits successfully?

### 3. Concurrency & Race Conditions
- [ ] Are numeric increments/decrements (balances, counters, inventory) performed atomically in SQL rather than in memory?
- [ ] Is optimistic locking (`version` field) or pessimistic locking (`FOR UPDATE`) used where concurrent edits are possible?
- [ ] Are financial, billing, or critical webhook endpoints protected by an `idempotency_key`?

### 4. Auth & Tenant Isolation
- [ ] Is every data access query scoped by the authenticated user's ID or `tenant_id`?
- [ ] Are ID parameters validated against the user's permissions (preventing IDOR)?
- [ ] Are admin-only fields protected against mass-assignment from unvalidated request bodies?

### 5. Error Boundaries & Logging
- [ ] Are errors categorized into client errors (4xx) vs system errors (5xx)?
- [ ] Are internal stack traces and database error codes scrubbed from production responses?
- [ ] Are unexpected exceptions logged with contextual metadata (trace ID, user ID)?

### 6. Architectural Boundary Drift
- [ ] Did the model import utilities across forbidden domain boundaries (e.g., frontend importing server DB client, or service A bypassing service B's public interface)?
- [ ] Did the model add unnecessary npm dependencies for tasks easily solved with standard libraries?
- [ ] Are all newly introduced files and functions covered by automated tests?

---

## Quick Diff Review Cheat Sheet

| Red Flag in AI Diff | What to Replace It With |
| :--- | :--- |
| `items.map(async (i) => await db.find(...))` | `db.find({ where: { id: { in: items.map(i => i.id) } } })` |
| `account.balance -= amount; await db.save(account)` | `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1` |
| `app.get('/user/:id', (req, res) => db.user.find(req.params.id))` | Scope query with `where: { id: req.params.id, tenantId: req.user.tenantId }` |
| `catch (e) { res.json({ error: e.message }) }` | Log error internally, return generic `{ error: "Internal server error", requestId }` |
| `db.records.findMany()` (no limits) | `db.records.findMany({ take: 50, cursor: ... })` |
