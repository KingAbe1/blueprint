# 05. Security & Production Hardening (Post-Flight Inspection)

> **"AI models prioritize syntactical functionality over threat modeling. Security hardening is an explicit verification step."**

---

## The AI Security Blindspot

Because LLMs are trained on general web code, they often produce patterns that work functional-wise but introduce critical security vulnerabilities:
- Missing tenant/authorization checks (IDOR vulnerabilities)
- Unsanitized dynamic database queries or loose ORM filters
- Missing rate limits on expensive computation or LLM-calling endpoints
- Over-permissive CORS, cookie policies, or raw exception leakage to clients

---

## 1. Insecure Direct Object References (IDOR) & Tenant Isolation

### ❌ The Common AI Mistake
```typescript
// Vulnerable to IDOR: Any authenticated user can access any document by ID!
app.get('/api/documents/:id', async (req, res) => {
  const doc = await db.documents.findUnique({
    where: { id: req.params.id },
  });
  return res.json(doc);
});
```

### ✅ Hardened Blueprint Pattern
Always enforce multi-tenant isolation at the query predicate level:

```typescript
app.get('/api/documents/:id', requireAuth, async (req, res) => {
  const doc = await db.documents.findFirst({
    where: {
      id: req.params.id,
      tenantId: req.user.tenantId, // Scoped to authenticated tenant
    },
  });

  if (!doc) {
    // Return 404 instead of 403 to prevent ID enumeration
    return res.status(404).json({ error: 'Document not found' });
  }

  return res.json(doc);
});
```

---

## 2. Input Validation & Strict Payloads

Never allow unparsed `req.body` into service logic. Enforce strict Zod schemas with `.strict()` or stripped unknown fields to prevent mass assignment vulnerabilities:

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  // role is intentionally omitted so users cannot elevate privileges via JSON body
}).strict();
```

---

## 3. Query Performance & Rate Limiting

### Unpaginated Queries (The "SELECT *" Hazard)
AI models love generating unbounded queries like `db.posts.findMany()`. In production, this can pull 500,000 records into memory and crash the container with an Out of Memory (OOM) error.

```typescript
// Enforce maximum page limits in all collection endpoints
const limit = Math.min(parseInt(req.query.limit) || 20, 100);
const cursor = req.query.cursor;

const posts = await db.posts.findMany({
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { id: 'desc' },
  select: { id: true, title: true, createdAt: true }, // Projection: only needed columns
});
```

---

## Post-Flight Security Checklist

- [ ] **Tenant Scoping**: Are all database queries scoped by `tenant_id` or `user_id` from the verified session?
- [ ] **Mass Assignment**: Are inputs strictly filtered to avoid malicious field injections (e.g., `role: "admin"`)?
- [ ] **No Unbounded Queries**: Do all list endpoints enforce a hard upper limit on `take`/`limit`?
- [ ] **Error Sanitization**: Are database error messages, stack traces, and internal query details stripped from client responses?
- [ ] **Rate Limiting**: Are public or expensive endpoints protected by a rate limiter?
