import { DomainEntity } from '../types/project';

interface ExtractionResult {
  entities: DomainEntity[];
  nonNegotiables: string[];
  criticalWorkflows: string[];
}

/**
 * Strips previous markdown headers, asterisks, bullet points, and repeated system templates from user descriptions
 */
export function cleanRawDescription(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Remove markdown headings and section numbers
  cleaned = cleaned.replace(/#{1,6}\s*\d*\.?\s*[^\n]+/gi, ' ');
  cleaned = cleaned.replace(/\b\d+\.\s*(?:What It Does|Target Users|Primary Workflows|Key Data|Reliability Expectations)[^\n:]*:?/gi, ' ');
  // Remove bold/italic markers like **** or ** or *
  cleaned = cleaned.replace(/\*{1,4}/g, ' ');
  // Remove bullet markers
  cleaned = cleaned.replace(/^[\s*•\-+]+/gm, ' ');
  // Remove boilerplate generated phrases
  cleaned = cleaned.replace(/is a dedicated platform designed for/gi, ' ');
  cleaned = cleaned.replace(/is designed to provide a reliable, streamlined solution for/gi, ' ');
  cleaned = cleaned.replace(/The system coordinates core data entities[^\n.]*\./gi, ' ');
  cleaned = cleaned.replace(/What it does & core value proposition/gi, ' ');
  cleaned = cleaned.replace(/Target users & primary workflows/gi, ' ');
  cleaned = cleaned.replace(/Key data & reliability expectations/gi, ' ');

  // Collapse excess whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Transforms raw text from AI or local generators into a clean, human-readable specification template,
 * stripping unsightly raw markdown hashes (###, ####) and asterisks (****, **).
 */
export function formatSpecificationTemplate(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // Strip code fences if model wrapped in ```
  text = text.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  // 1. Remove bold asterisks (e.g. ****word**** or **word** or *word*)
  text = text.replace(/\*{2,4}([^*]+)\*{2,4}/g, '$1');
  text = text.replace(/(^|[^\*])\*([^*\n]+)\*([^\*]|$)/g, '$1$2$3');

  // 2. Standardize section headers into clean, uniform template headers
  // Section 1: What It Does & Core Value Proposition
  text = text.replace(/^#{1,6}\s*(?:1\.?)?\s*(?:What It Does|Overview|Product Overview|Core Value Proposition)[^\n]*/gim, '1. What It Does & Core Value Proposition:');
  
  // Section 2: Target Users & Primary Workflows
  text = text.replace(/^#{1,6}\s*(?:2\.?)?\s*(?:Target Users|Workflows|Primary Workflows|Key Workflows)[^\n]*/gim, '2. Target Users & Primary Workflows:');
  
  // Section 3: Key Data & Reliability Expectations
  text = text.replace(/^#{1,6}\s*(?:3\.?)?\s*(?:Key Data|Reliability|Data & Reliability|Rules & Constraints|Reliability Expectations)[^\n]*/gim, '3. Key Data & Reliability Expectations:');

  // Any other residual markdown header markers (#### Header) -> Clean Header
  text = text.replace(/^#{1,6}\s*([^\n]+)/gm, '$1');

  // 3. Format bullets into clean bullet glyphs (• )
  text = text.replace(/^[\s]*[-*+]\s+/gm, '• ');

  // 4. Normalize spacing between sections
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export function extractDomainFromObjective(projectName: string, objective: string): ExtractionResult {
  const cleanObjective = cleanRawDescription(objective);
  const text = (cleanObjective + ' ' + projectName).toLowerCase();
  
  // 1. Social / Dating / Community / Matching archetype
  if (
    text.includes('tinder') || text.includes('match') || text.includes('swipe') || 
    text.includes('dating') || text.includes('social') || text.includes('chat') || 
    text.includes('feed') || text.includes('friend') || text.includes('community') ||
    text.includes('pet') || text.includes('horse') || text.includes('dog') || text.includes('cat')
  ) {
    const isPetApp = text.includes('horse') || text.includes('pet') || text.includes('dog') || text.includes('cat');
    const profileNoun = isPetApp ? 'Pet / Animal Profile' : 'User Profile';
    const profileDesc = isPetApp 
      ? 'Stores photo, bio, breed/type, temperament, and preferences.'
      : 'User identity with photos, personal bio, and matching criteria.';

    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: profileNoun,
          description: profileDesc
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Match / Swipe Interaction',
          description: 'Records likes, passes, and mutual matches between profiles.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Direct Message & Chat',
          description: 'Real-time conversation threads between mutually matched parties.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Notification & Activity Alert',
          description: 'Alerts users when a new match is discovered or a message arrives.'
        }
      ],
      nonNegotiables: [
        'A chat channel can only open after a verified mutual match is confirmed by both parties.',
        'Swiping on a profile must immediately register to prevent showing the exact same profile twice.',
        'Direct messages and uploaded photos must be strictly sanitized and private between conversation participants.',
        'Users can instantly block or unmatch an account, immediately revoking communication access.'
      ],
      criticalWorkflows: [
        'User creates and customizes their profile with photos and preferences',
        'User explores discovery feed and swipes on potential matches',
        'Mutual match notification triggers and unlocks real-time messaging'
      ]
    };
  }

  // 2. Payments / Billing / Fintech archetype
  if (text.includes('pay') || text.includes('bill') || text.includes('checkout') || text.includes('wallet') || text.includes('ledger') || text.includes('stripe') || text.includes('invoice')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'Customer',
          description: 'Stores customer details, contact info, and saved payment methods.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Payment Transaction',
          description: 'Records money paid or refunded, including timestamp, amount, and gateway status.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Subscription Plan',
          description: 'Recurring billing tier with active, paused, or canceled lifecycle status.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Invoice Record',
          description: 'Itemized receipt listing line items, taxes, discounts, and payment proof.'
        }
      ],
      nonNegotiables: [
        'A customer must never be charged twice for the same checkout or payment attempt (idempotency).',
        'Always store money as exact whole cents (e.g. $10.00 = 1000) to prevent rounding errors.',
        'A refund can never exceed the original settled transaction amount.',
        'A canceled subscription must immediately halt future automatic renewal charges.'
      ],
      criticalWorkflows: [
        'Customer enters payment details and completes checkout',
        'Automatic subscription renewal generates itemized invoice and receipt',
        'Customer requests a refund or updates their saved payment method'
      ]
    };
  }

  // 3. E-Commerce / Store / Marketplace archetype
  if (text.includes('shop') || text.includes('store') || text.includes('cart') || text.includes('inventory') || text.includes('product') || text.includes('ecommerce') || text.includes('marketplace')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'Product Catalog',
          description: 'Item available for sale, with price, variants, inventory count, and media.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Shopping Cart',
          description: 'Holds selected items, quantities, and applied coupons before checkout.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Customer Order',
          description: 'Confirmed purchase with ordered line items, total paid, and shipping address.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Shipment Tracking',
          description: 'Tracks fulfillment carrier, tracking number, and delivery status.'
        }
      ],
      nonNegotiables: [
        'Inventory stock can never drop below zero — out-of-stock items cannot be checked out.',
        'Product price and tax at checkout time must be permanently snapshot in the order record.',
        'An order cannot transition to "Shipped" before payment is confirmed.',
        'If an order is canceled, items must be automatically returned to available inventory.'
      ],
      criticalWorkflows: [
        'Customer browses catalog, filters items, and adds to cart',
        'Customer enters shipping details and completes checkout',
        'Fulfillment updates shipment tracking and delivers tracking link'
      ]
    };
  }

  // 4. Tasks / Project Management / Productivity
  if (text.includes('task') || text.includes('todo') || text.includes('project') || text.includes('kanban') || text.includes('board') || text.includes('ticket') || text.includes('workflow')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'Project Workspace',
          description: 'Top-level container for team milestones, goals, and member access.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Task Card',
          description: 'Actionable work item with title, status, priority, due date, and assignee.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Task Comment & Activity',
          description: 'Discussion thread and audit history documenting updates to a task.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Milestone / Sprint',
          description: 'Time-boxed target grouping related tasks toward a common release.'
        }
      ],
      nonNegotiables: [
        'Task status changes must immediately sync so teammates never work on stale states.',
        'Deleted tasks must be archived with full recovery capability for at least 30 days.',
        'Only project members with write permissions can alter task assignees or due dates.'
      ],
      criticalWorkflows: [
        'Member creates a new task with description, priority, and assignee',
        'Assignee updates task progress through visual Kanban workflow columns',
        'Team completes milestone goals and reviews activity history'
      ]
    };
  }

  // 5. Auth / Enterprise Organization archetype (strict matching only)
  if (text.includes('auth') || text.includes('rbac') || text.includes('permission') || text.includes('tenant') || text.includes('single sign on') || text.includes('sso')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'User Account',
          description: 'User identity record with verified email, authentication credentials, and status.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Organization / Tenant',
          description: 'Isolated enterprise boundary holding team members and private resources.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Role & Permission Set',
          description: 'Granular access control policies (e.g. Owner, Admin, Editor, Viewer).'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Audit Log & Session',
          description: 'Security session log recording authentication events and sensitive operations.'
        }
      ],
      nonNegotiables: [
        'Users can only access resources from their authorized organization — zero cross-tenant leakage.',
        'Session revocation or password reset must immediately invalidate all active JWTs and tokens.',
        'Every organization must retain at least one active Super Admin / Owner at all times.'
      ],
      criticalWorkflows: [
        'User registers, verifies email, and completes multi-factor setup',
        'Admin invites colleagues and assigns customized role permissions',
        'Security system records audit events and handles session termination'
      ]
    };
  }

  // 6. Generic / Adaptive Default
  const cleanName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'System';
  return {
    entities: [
      {
        id: 'ent_' + Date.now() + '_1',
        name: `${cleanName} Item`,
        description: `The core record and information entity managed within ${cleanName}.`
      },
      {
        id: 'ent_' + Date.now() + '_2',
        name: 'Member Profile',
        description: 'User account managing and interacting with records in the application.'
      },
      {
        id: 'ent_' + Date.now() + '_3',
        name: 'Activity & Audit Log',
        description: 'Chronological event record tracking creations, modifications, and system events.'
      }
    ],
    nonNegotiables: [
      'If an operation fails midway, changes must roll back cleanly to maintain data consistency.',
      'Deleted records must be safely archived and excluded from standard queries.',
      'Concurrent updates must be synchronized to prevent accidental data overwrites.'
    ],
    criticalWorkflows: [
      'User creates and saves a new record with required parameters',
      'User browses, filters, and edits existing records',
      'User reviews activity history and updates operational settings'
    ]
  };
}

export function expandDescriptionLocally(projectName: string, description: string): string {
  const cleanName = projectName.trim() 
    ? projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) 
    : 'System';
  
  const coreIdea = cleanRawDescription(description) || `a streamlined modern application for ${cleanName}`;
  const extraction = extractDomainFromObjective(projectName, coreIdea);
  const entityNames = extraction.entities.map(e => e.name).join(', ');
  
  return `1. What It Does & Core Value Proposition:
${cleanName} is a dedicated platform designed for ${coreIdea}. The system coordinates core data entities (${entityNames}) to provide an intuitive, high-performance user experience with strong data integrity.

2. Target Users & Primary Workflows:
${extraction.criticalWorkflows.map(w => `• ${w}`).join('\n')}

3. Key Data & Reliability Expectations:
${extraction.nonNegotiables.map(n => `• ${n}`).join('\n')}`;
}
