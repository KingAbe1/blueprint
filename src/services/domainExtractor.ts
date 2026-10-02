import { DomainEntity } from '../types/project';

interface ExtractionResult {
  entities: DomainEntity[];
  nonNegotiables: string[];
  criticalWorkflows: string[];
}

export function extractDomainFromObjective(projectName: string, objective: string): ExtractionResult {
  const text = (objective + ' ' + projectName).toLowerCase();
  
  // Rule-based domain archetype analyzer
  if (text.includes('pay') || text.includes('bill') || text.includes('checkout') || text.includes('wallet') || text.includes('ledger') || text.includes('stripe')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'CustomerAccount',
          description: 'Represents the billing entity with attached payment methods and currency locale.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'PaymentTransaction',
          description: 'Single attempt to charge or credit funds, enforced with an idempotency key.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Subscription',
          description: 'Recurring billing contract with status (active, past_due, canceled) and billing cycles.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'LedgerEntry',
          description: 'Immutable double-entry monetary record tracking all debits and credits in integer cents.'
        }
      ],
      nonNegotiables: [
        'A payment transaction must never be processed twice for the same idempotency key.',
        'All monetary amounts must be stored as positive integers in minor units (cents). Floating-point currency is strictly forbidden.',
        'Total refunded amount on any transaction can never exceed the original captured amount.',
        'A canceled subscription must never trigger automated renewal payment attempts.'
      ],
      criticalWorkflows: [
        'Idempotent Payment Charge & Webhook Confirmation',
        'Recurring Subscription Lifecycle & Grace Period Retry',
        'Customer Dispute & Partial/Full Refund Processing'
      ]
    };
  }

  if (text.includes('auth') || text.includes('user') || text.includes('rbac') || text.includes('permission') || text.includes('tenant') || text.includes('org')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'UserIdentity',
          description: 'Primary credential holder with verified email, password hash, and MFA status.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'OrganizationTenant',
          description: 'Isolated tenancy boundary containing workspaces, members, and billing tier.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'RoleAssignment',
          description: 'Granular permission grants mapped between users and tenant resource scopes.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'SessionToken',
          description: 'Cryptographically signed revocable token bound to client fingerprint and TTL.'
        }
      ],
      nonNegotiables: [
        'Users can never read, modify, or query records belonging to a different tenant organization ID.',
        'Revoked session tokens must immediately fail authentication across all nodes via blacklist or version check.',
        'Password hashes must never be serialized or returned in public API payloads or log output.',
        'An organization must always maintain at least one active Owner account.'
      ],
      criticalWorkflows: [
        'Multi-factor Authentication & Secure Token Issuance',
        'Organization Onboarding & Tenant Provisioning',
        'Role-Based Access Control Evaluation at Gateway'
      ]
    };
  }

  if (text.includes('order') || text.includes('shop') || text.includes('store') || text.includes('cart') || text.includes('inventory') || text.includes('product')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'ProductSKU',
          description: 'Sellable catalog item with base price, tax category, and physical dimensions.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'InventoryReservation',
          description: 'Time-locked stock allocation held during the customer checkout window.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'CustomerOrder',
          description: 'Committed purchase order with immutable line items, applied discounts, and shipping target.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'ShipmentPackage',
          description: 'Fulfillment manifest tracking carrier tracking number and dispatch status.'
        }
      ],
      nonNegotiables: [
        'Inventory stock cannot drop below zero. Overselling is physically prevented by database row-level locking.',
        'Order line item prices and tax amounts must be permanently snapshot at checkout time and never re-read from live catalog.',
        'Expired inventory reservations must automatically release stock back to available pool.',
        'An order cannot transition to Fulfilled without a valid payment confirmation.'
      ],
      criticalWorkflows: [
        'Atomic Cart Checkout & Stock Reservation',
        'Payment Authorization & Order State Transition',
        'Fulfillment Dispatch & Automated Inventory Reconciliation'
      ]
    };
  }

  // Generic High-Rigor Architecture Default
  const cleanName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    entities: [
      {
        id: 'ent_' + Date.now() + '_1',
        name: cleanName ? cleanName.replace(/\s+/g, '') + 'Entity' : 'PrimaryEntity',
        description: 'Core domain aggregate root managing primary business lifecycle and audit records.'
      },
      {
        id: 'ent_' + Date.now() + '_2',
        name: 'AuditEventLog',
        description: 'Immutable time-series log recording all state mutations, actor IDs, and reason codes.'
      },
      {
        id: 'ent_' + Date.now() + '_3',
        name: 'OperationLock',
        description: 'Concurrency control token preventing conflicting simultaneous operations on the same entity.'
      }
    ],
    nonNegotiables: [
      'All database mutations must be executed within an explicit ACID transaction boundary.',
      'Soft-deleted records must be filtered by default from all read queries and unique index validations.',
      'Concurrent update attempts must be guarded with optimistic locking (version column) or idempotent tokens.'
    ],
    criticalWorkflows: [
      'Primary Entity Creation & Validation Cycle',
      'State Mutation with Audit Trail Recording',
      'Asynchronous Event Dispatch & Reconciliation'
    ]
  };
}
