import {
  ArchitectureQuestion,
  ArchitectureTopology,
  HandoffFile,
  HandoffPackage,
  IDETarget,
  Project,
} from '../types/project';
import { isNextJsGreenfieldStack } from './greenfieldStackPolicy';
import {
  nextJsAgentsWorkingAgreementBullets,
  nextJsHandoffArchitectureSection,
  nextJsMilestoneZeroBullets,
} from './handoffNextJsGuidance';

const CATEGORY_LABELS: Record<ArchitectureQuestion['category'], string> = {
  product: 'Product scope',
  users: 'Users and roles',
  platform: 'Target platform',
  approach: 'Decision approach',
  ui: 'User experience',
  access: 'Identity and access',
  frontend: 'Frontend',
  topology: 'System shape',
  backend: 'Backend',
  api: 'Connections and API',
  data: 'Data and storage',
  realtime: 'Realtime and offline behavior',
  integrations: 'Integrations',
  security: 'Security and privacy',
  compliance: 'Compliance',
  scale: 'Scale and performance',
  reliability: 'Reliability and recovery',
  deployment: 'Hosting and deployment',
  delivery: 'Release process',
  testing: 'Testing and quality',
  observability: 'Monitoring and alerts',
  operations: 'Operational ownership',
  budget: 'Cost posture',
};

const TOPOLOGY_LABELS: Record<ArchitectureTopology, string> = {
  modular_monolith: 'Modular monolith',
  microservices: 'Independent microservices',
  serverless: 'Managed serverless functions',
  event_driven: 'Event-driven system',
  hybrid: 'Hybrid core and services',
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

function topologyFor(project: Project): ArchitectureTopology {
  const recommendation = project.spec.frameworkRecommendation || project.spec.frameworkRecommendations?.[0];
  if (recommendation?.topology) return recommendation.topology;
  const source = `${recommendation?.architecture || ''} ${recommendation?.category || ''}`.toLowerCase();
  if (source.includes('microservice')) return 'microservices';
  if (source.includes('serverless')) return 'serverless';
  if (source.includes('event-driven')) return 'event_driven';
  if (source.includes('hybrid')) return 'hybrid';
  return 'modular_monolith';
}

function modulesFor(project: Project) {
  const recommendation = project.spec.frameworkRecommendation || project.spec.frameworkRecommendations?.[0];
  if (recommendation?.systemModules?.length) return recommendation.systemModules;
  const source = `${project.name} ${project.spec.description}`.toLowerCase();
  if (/store|commerce|checkout|payment|order|inventory|catalog/.test(source)) {
    return ['Accounts & access', 'Catalog', 'Cart & checkout', 'Orders & inventory', 'Payments', 'Notifications'];
  }
  if (/saas|workspace|subscription|organization|team/.test(source)) {
    return ['Accounts & access', 'Workspaces', 'Membership & roles', 'Billing', 'Notifications', 'Administration'];
  }
  if (/\bai\b|assistant|llm|retrieval|chat/.test(source)) {
    return ['Accounts & access', 'Conversations', 'Knowledge & retrieval', 'Model gateway', 'Usage & limits', 'Administration'];
  }
  return ['Accounts & access', 'Core product', 'Notifications', 'Administration'];
}

function decisionsFor(project: Project) {
  const interview = project.spec.interview;
  if (!interview) return [];
  const facts = (interview.inferredFacts || []).map(fact => ({
    category: fact.category,
    value: fact.value,
    source: 'Product description',
  }));
  const answers = interview.questions.map(question => ({
    category: question.category,
    value: interview.answers.find(answer => answer.questionId === question.id)?.label || 'No preference',
    source: 'Build questions',
  }));
  return [...facts, ...answers];
}

function decisionValue(project: Project, ...categories: ArchitectureQuestion['category'][]) {
  return decisionsFor(project)
    .filter(decision => categories.includes(decision.category))
    .map(decision => decision.value)
    .filter(Boolean)
    .join(' · ') || 'Not explicitly constrained';
}

function decisionTable(project: Project) {
  const seen = new Set<string>();
  return decisionsFor(project).filter(decision => {
    const key = `${decision.category}:${decision.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(decision => `| ${CATEGORY_LABELS[decision.category]} | ${decision.value} | ${decision.source} |`).join('\n');
}

function moduleSlug(module: string) {
  return slug(module).replace(/-and-/g, '-');
}

function makeFiles(project: Project, ide: IDETarget): HandoffFile[] {
  const recommendation = project.spec.frameworkRecommendation || project.spec.frameworkRecommendations?.[0];
  if (!recommendation) throw new Error('Complete the architecture before generating a build handoff.');
  const topology = topologyFor(project);
  const topologyLabel = TOPOLOGY_LABELS[topology];
  const modules = modulesFor(project);
  const projectSlug = slug(project.name);
  const integrations = decisionValue(project, 'integrations');
  const description = project.spec.description.trim();
  const generatedOn = new Date().toISOString().slice(0, 10);
  const nextJs = isNextJsGreenfieldStack(recommendation);

  const files: HandoffFile[] = [
    {
      path: 'AGENTS.md',
      description: 'Primary instructions for coding agents',
      content: `# ${project.name}: Agent Instructions

This repository is governed by the product blueprint in \`blueprint/\`. Read the documents in this order before making implementation decisions:

1. \`blueprint/PRODUCT.md\`
2. \`blueprint/ARCHITECTURE.md\`
3. \`blueprint/ROADMAP.md\`
4. \`blueprint/REQUIREMENTS.md\`
5. \`blueprint/ACCEPTANCE_CRITERIA.md\`
6. \`blueprint/INTEGRATIONS.md\` and \`blueprint/OPERATIONS.md\`

## Working agreement

- Implement one roadmap milestone at a time and preserve its stated dependencies.
- Treat the architecture decisions as constraints. Do not replace the selected stack or ${topologyLabel.toLowerCase()} without recording a new decision.
- Keep domain boundaries explicit: ${modules.join(', ')}.
- Prefer the smallest implementation that satisfies the acceptance criteria.
${nextJs ? `${nextJsAgentsWorkingAgreementBullets()}\n` : ''}
- Add or update automated tests for behavior changed in a milestone.
- Never commit credentials. Use environment variables and update \`.env.example\` with names only.
- Before declaring a milestone complete, run the relevant tests and verify its acceptance criteria.
- If the documents conflict or leave a high-impact decision unresolved, stop and surface the conflict instead of silently inventing a requirement.

Generated by Blueprint on ${generatedOn}.
`,
    },
    {
      path: 'blueprint/PRODUCT.md',
      description: 'Product intent, users, and scope',
      content: `# ${project.name}: Product Blueprint

## Product intent

${description}

## First-release direction

- **Scope:** ${decisionValue(project, 'product')}
- **Users and roles:** ${decisionValue(project, 'users')}
- **Target platform:** ${decisionValue(project, 'platform')}
- **Experience:** ${decisionValue(project, 'ui')}
- **Identity and access:** ${decisionValue(project, 'access')}

## Product boundaries

The first release should prioritize the complete user journeys implied by the description and build-question answers. Capabilities not required for those journeys should remain deferred until a roadmap decision introduces them.

## Source of truth

When implementation details compete with product intent, preserve the user-visible behavior and constraints documented here and record any necessary architectural change explicitly.
`,
    },
    {
      path: 'blueprint/ARCHITECTURE.md',
      description: 'Selected stack, topology, and module boundaries',
      content: `# ${project.name}: Architecture

## Selected architecture

- **Stack:** ${recommendation.name}
- **System shape:** ${topologyLabel}
- **Frontend:** ${recommendation.frontendStack || 'Defined by the selected stack'}
- **Backend:** ${recommendation.backendStack || 'Defined by the selected stack'}
- **Data:** ${recommendation.databaseStack || 'Defined by the selected stack'}
- **Deployment:** ${recommendation.deploymentTarget || 'Defined during implementation setup'}

${recommendation.description}

## Why this shape

${recommendation.topologyRationale || (topology === 'modular_monolith'
  ? 'Use one deployable application with clear internal modules. This keeps delivery and operations simple while preserving boundaries that can be separated later if evidence justifies it.'
  : `Use ${topologyLabel.toLowerCase()} because your build-question answers identified a need for independently operated workloads or boundaries.`)}

## Domain boundaries

${modules.map(module => `- **${module}:** Own the behavior and data associated with ${module.toLowerCase()}. Communicate through explicit interfaces rather than reaching into another module’s internals.`).join('\n')}

## System flow

\`\`\`mermaid
flowchart LR
  U[Users] --> C[${recommendation.frontendStack || 'Product client'}]
  C --> A[Identity and access]
  C --> S[${topologyLabel}]
  S --> D[${recommendation.databaseStack || 'Primary data store'}]
  S --> I[External integrations]
  S --> O[Monitoring and recovery]
\`\`\`

## Architecture decisions

| Area | Decision | Source |
| --- | --- | --- |
${decisionTable(project)}
${nextJs ? `\n${nextJsHandoffArchitectureSection()}\n` : ''}
`,
    },
    {
      path: 'blueprint/ROADMAP.md',
      description: 'Ordered implementation milestones and dependencies',
      content: `# ${project.name}: Development Roadmap

Build vertical, demonstrable slices. Do not build every database or infrastructure layer before proving a complete user journey.

## Milestone 0 — Foundation and walking skeleton

**Goal:** Prove the client, application layer, data store, automated checks, and deployment path work together.

${nextJs ? nextJsMilestoneZeroBullets() : `- Establish the repository structure for ${topologyLabel.toLowerCase()}.
- Configure local, test, staging, and production environment conventions.
- Add automated formatting, type checking, and a minimal test pipeline.
- Implement one thin end-to-end read/write path with health monitoring.
- Document required environment variables in \`.env.example\` without values.`}

**Exit criteria:** A small end-to-end feature is testable locally and deployable through the selected release path.

${modules.map((module, index) => `## Milestone ${index + 1} — ${module}

**Goal:** Deliver the smallest production-usable ${module.toLowerCase()} capability.

- Define the module’s public responsibilities and boundaries.
- Implement its primary user journey end to end.
- Add authorization and failure handling at the boundary.
- Add automated tests for its highest-risk behavior.
- Add the signals needed to understand failures in production.

**Depends on:** ${index === 0 ? 'Milestone 0' : `Milestone ${index}`}

**Exit criteria:** The capability works through the real product interface, persists correctly, and satisfies its acceptance criteria.
`).join('\n')}
## Milestone ${modules.length + 1} — Integration hardening

- Validate ${integrations} using test or sandbox accounts.
- Handle timeouts, retries, duplicate events, and reconciliation.
- Confirm secrets are stored outside the repository.
- Exercise critical workflows when an external provider is unavailable.

## Milestone ${modules.length + 2} — Release readiness

- Complete security and privacy review for the documented risk level.
- Verify monitoring, alerting, backups, restore procedures, and rollback.
- Run the complete acceptance suite on the release candidate.
- Complete ${recommendation.deploymentTarget || 'the production deployment process'}.
- Record intentionally deferred scope for the next roadmap cycle.
`,
    },
    {
      path: 'blueprint/REQUIREMENTS.md',
      description: 'Functional and non-functional constraints',
      content: `# ${project.name}: Requirements

## Functional areas

${modules.map(module => `- **${module}:** Support the complete user-facing and operational workflows associated with this domain.`).join('\n')}

## Non-functional requirements

- **Security and privacy:** ${decisionValue(project, 'security', 'compliance')}
- **Scale and performance:** ${decisionValue(project, 'scale')}
- **Realtime and offline behavior:** ${decisionValue(project, 'realtime')}
- **Reliability and recovery:** ${decisionValue(project, 'reliability')}
- **Testing:** ${decisionValue(project, 'testing')}
- **Monitoring:** ${decisionValue(project, 'observability')}
- **Cost posture:** ${decisionValue(project, 'budget')}

## Constraint handling

Translate these outcomes into measurable implementation targets during Milestone 0. Do not invent stricter requirements that add material complexity without a documented product need.
`,
    },
    {
      path: 'blueprint/INTEGRATIONS.md',
      description: 'External services and safe integration rules',
      content: `# ${project.name}: Integrations

## Required connections

${integrations}

## Implementation rules

- Keep provider credentials in environment-managed secrets, never source control.
- Verify webhook or callback authenticity where supported.
- Make externally triggered mutations idempotent so retries cannot duplicate work.
- Record provider identifiers needed for reconciliation and support.
- Use bounded retries with backoff; do not retry permanent failures indefinitely.
- Provide a visible recovery path when a provider is unavailable.
- Use provider sandbox environments in automated and pre-release testing.

## Access model

${decisionValue(project, 'api')}
`,
    },
    {
      path: 'blueprint/OPERATIONS.md',
      description: 'Deployment, monitoring, recovery, and ownership',
      content: `# ${project.name}: Operations

## Hosting and delivery

- **Hosting posture:** ${decisionValue(project, 'deployment')}
- **Release controls:** ${decisionValue(project, 'delivery')}
- **Deployment target:** ${recommendation.deploymentTarget || 'To be finalized during foundation work'}

## Reliability

- **Recovery expectation:** ${decisionValue(project, 'reliability')}
- **Monitoring and alerts:** ${decisionValue(project, 'observability')}
- **Operational owner:** ${decisionValue(project, 'operations')}

## Required runbooks

- Deployment and rollback
- Credential rotation
- Database backup verification and restore
- External-provider outage response
- High-error-rate or unavailable-service response
- Customer-impacting incident communication

Every runbook must name an owner, the trigger for using it, verification steps, and the safe rollback or recovery action.
`,
    },
    {
      path: 'blueprint/ACCEPTANCE_CRITERIA.md',
      description: 'Definition of done for agents and reviewers',
      content: `# ${project.name}: Acceptance Criteria

## Product-level definition of done

- A new user can complete the primary product journey on ${decisionValue(project, 'platform')}.
- Every protected action enforces the documented identity and access decision.
- Failures are visible, recoverable, and do not silently corrupt or duplicate information.
- Critical user journeys have automated coverage appropriate to: ${decisionValue(project, 'testing')}.
- The deployed system exposes the health and failure signals required by: ${decisionValue(project, 'observability')}.
- No credentials or private keys are committed to the repository.

## Module completion checklist

${modules.map(module => `### ${module}

- [ ] Primary user journey works through the real interface.
- [ ] Access rules are enforced on the trusted application boundary.
- [ ] Invalid and duplicate operations fail safely.
- [ ] Highest-risk behavior has automated tests.
- [ ] Production failures produce useful logs or alerts.
`).join('\n')}
## Release gate

- [ ] All milestone exit criteria are satisfied.
- [ ] Integration sandbox tests pass.
- [ ] Backup and rollback procedures have been exercised.
- [ ] Deferred scope is documented and not partially shipped.
`,
    },
  ];

  if (ide === 'cursor') {
    files.push({
      path: '.cursor/rules/blueprint.mdc',
      description: 'Cursor rule pointing to the blueprint source of truth',
      content: `---
description: Follow the approved ${project.name} product blueprint and roadmap
alwaysApply: true
---

Read \`AGENTS.md\` and the referenced \`blueprint/*.md\` documents before planning or implementing work. Preserve the selected architecture and complete one roadmap milestone at a time. Do not commit secrets or silently invent high-impact product requirements.
`,
    });
  } else if (ide === 'claude') {
    files.push({
      path: 'CLAUDE.md',
      description: 'Claude Code entry instructions',
      content: `# ${project.name} instructions

Read \`AGENTS.md\` first. It defines the authoritative document order, architecture constraints, roadmap workflow, testing expectations, and completion rules for this repository.
`,
    });
  } else if (ide === 'vscode') {
    files.push({
      path: '.github/copilot-instructions.md',
      description: 'VS Code and GitHub Copilot repository instructions',
      content: `Follow \`AGENTS.md\` and the documents in \`blueprint/\`. Preserve the approved architecture, implement one roadmap milestone at a time, add tests for changed behavior, and never place credentials in source control.
`,
    });
  } else if (ide === 'jetbrains') {
    files.push({
      path: '.aiassistant/rules/blueprint.md',
      description: 'JetBrains AI Assistant project guidance',
      content: `# Blueprint guidance

Use \`AGENTS.md\` as the entry point for this project. Read the linked product, architecture, roadmap, requirements, and acceptance documents before proposing implementation work.
`,
    });
  }

  files.push({
    path: 'blueprint/MANIFEST.md',
    description: 'Generated-file inventory and refresh metadata',
    content: `# Blueprint handoff manifest

- **Project:** ${project.name}
- **Project slug:** ${projectSlug}
- **Generated:** ${generatedOn}
- **Target IDE:** ${ide}
- **Blueprint topology:** ${topologyLabel}

The files in this package were generated from the approved Blueprint product brief and build-question answers. Review changes before regenerating over files that have been edited by hand.
`,
  });

  return files;
}

export function generateHandoffPackage(project: Project, ide: IDETarget): HandoffPackage {
  return {
    generatedAt: Date.now(),
    ide,
    files: makeFiles(project, ide),
  };
}

export function updateHandoffForIDE(project: Project, handoff: HandoffPackage, ide: IDETarget): HandoffPackage {
  if (handoff.ide === ide) return handoff;
  return generateHandoffPackage(project, ide);
}
