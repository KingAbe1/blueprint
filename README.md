# Blueprint

> **Architectural rigor for the generative era.**  
> A senior engineer's playbook for moving beyond fragile "vibe coding" and building scalable, test-driven, production-grade systems with AI.

---

## The Premise

Generating syntax has become cheap and instantaneous. Anyone can open an editor, prompt a model, and assemble a working prototype in hours. 

However, a dangerous feedback loop has emerged:
1. Systems are generated without architectural planning, relational constraints, or test suites.
2. These systems inevitably collapse in production under concurrency, edge cases, or schema migrations.
3. The resulting failure is blamed on the tool: *"Vibe coding produces slop; AI-generated code is unusable."*

**The model is not the failure mode—the missing verification layer is.**

An LLM is an amplifier. When fed vague intuition, it amplifies technical debt at lightning speed. When guided by disciplined architectural invariants, automated testing, and strict boundaries, it acts as an unmatched velocity multiplier.

**Blueprint** is a practical guide and desktop workstation dedicated to restoring engineering discipline to AI-assisted software development.

---

## 🖥️ Blueprint Studio (Desktop Application)

Blueprint includes a native-feel desktop workstation designed to visually construct **Pre-Flight Specs**, lint database invariants in real-time, generate **closed-loop TDD test harnesses**, and format 1-click prompt bundles for AI code editors (**Cursor, Claude Code, Antigravity, VS Code**).

### Features:
* **Interactive Schema & Invariants Designer:** Real-time PostgreSQL, SQLite, and MySQL DDL generator with built-in invariant linter (detects float money types, missing FK indexes, and missing idempotency constraints).
* **Visual State Machine Builder:** Interactive transition flow editor with automatic TypeScript domain transition matrix generation.
* **TDD Prompt Harness Studio:** Compose failing test assertion specs (happy path, invariant breach, concurrency overdraft, rollback verification).
* **Concurrency Matrix:** Declarative concurrency mitigations (Atomic SQL, OCC versioning, Pessimistic `FOR UPDATE`, Idempotency key gateways).
* **1-Click AI Prompt Bundler:** Generates `.cursorrules` and 4-compartment system prompts ready for copy/export.
* **Post-Flight Git Diff Scanner:** Paste and audit diffs for N+1 queries, unbounded `findMany()`, and unhandled mutations.

### Running Blueprint Studio Locally:

```bash
# Install dependencies
npm install

# Launch Blueprint Studio Dev Server
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser or desktop container.

---

## The 3-Phase Engineering Lifecycle

Blueprint organizes AI-assisted development into three non-negotiable operational gates:

```
┌──────────────────────────────────────────────────────────┐
│              PHASE 1: PRE-FLIGHT GATE                    │
│                 (Before Writing Code)                    │
│  • Define Data Models & Schema Invariants                │
│  • Author TDD Test Harness & Boundary Contracts          │
│  • Flag Concurrency, Failure Modes & Edge Case Matrix    │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│              PHASE 2: IN-FLIGHT EXECUTION                │
│                 (During Development)                     │
│  • Developer + AI Editor (Cursor, VS Code, Claude, AGY)  │
│  • Strict Closed-Loop Prompting against Blueprint Specs  │
│  • Automated Test Verification Loop                      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             PHASE 3: POST-FLIGHT INSPECTION              │
│                  (Before Merging to Main)                │
│  • Ruthless Git Diff Audit (N+1s, missing indexes)       │
│  • Verify Atomic Transactions & Error Boundaries         │
│  • Production-Readiness & Security Signoff               │
└──────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Invariants Before Implementation (Pre-Flight)
Never ask an LLM to generate application logic before defining your data contracts. Establish schemas, database constraints (foreign keys, nullability, unique indexes), and state transitions first. If the domain boundaries are rock-solid, the model cannot hallucinate bad state.

### 2. Tests as Prompt Constraints (In-Flight)
In an AI-driven workflow, automated tests are not an afterthought—they are your prompt harness. Enforce closed-loop verification: write the unit and integration boundaries first, and force the model to satisfy the suite before diffs are accepted.

### 3. Concurrency & Failure Modes by Design (Pre- & Post-Flight)
Code generated on the "happy path" works on `localhost` and fails under load. Every AI-assisted design must explicitly handle:
* Race conditions and idempotency keys
* Atomic database transactions and rollback paths
* Network partitions, timeouts, and offline states
* Unpaginated queries and missing indexes

### 4. Ruthless Diff Auditing (Post-Flight)
Treat the LLM as an ultra-fast junior engineer, not a system architect. Never merge code you cannot explain. Every pull request must be audited for hidden assumptions, security boundaries, and architectural leakage.

---

## Playbook Structure

### 🛫 Phase 1: Pre-Flight Gate
- **[01. System Architecture & Schema First](./docs/01-architecture-and-schemas.md)** — Designing bulletproof data models, migrations, and transactional boundaries.
- **[02. The Test-Driven Prompt Harness](./docs/02-test-driven-development.md)** — Structuring failing test suites that serve as strict AI guardrails.
- **[03. Edge Cases & Concurrency Matrix](./docs/03-concurrency-and-edge-cases.md)** — Handling distributed state, race conditions, idempotency, and failure domains upfront.

### ⚡ Phase 2: In-Flight Execution
- **[04. Closed-Loop Agentic Prompting](./docs/04-closed-loop-prompting.md)** — Patterns for directing AI agents with specs, error outputs, and incremental refinement.

### 🛬 Phase 3: Post-Flight Inspection
- **[05. Security & Production Hardening](./docs/05-security-and-hardening.md)** — Authorization checks, payload sanitization, rate limiting, and query performance.
- **[06. The Code Review & Diff Audit Checklist](./docs/06-review-checklist.md)** — The non-negotiable inspection protocol for AI-generated diffs.

---

## Contributing

Blueprint is an open-source standard built by engineers who build real software for production. 

If you have battle-tested patterns, anti-patterns to document, or architectural checklists to add:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-pattern`)
3. Commit your changes with clear rationale
4. Open a Pull Request

---

## License

MIT © [Blueprint Contributors](LICENSE)