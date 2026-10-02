import { DomainEntity } from '../types/project';

interface ExtractionResult {
  entities: DomainEntity[];
  nonNegotiables: string[];
  criticalWorkflows: string[];
}

export function extractDomainFromObjective(projectName: string, objective: string): ExtractionResult {
  const text = (objective + ' ' + projectName).toLowerCase();
  
  // Payments / Billing archetype
  if (text.includes('pay') || text.includes('bill') || text.includes('checkout') || text.includes('wallet') || text.includes('ledger') || text.includes('stripe')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'Customer',
          description: 'Stores customer details, contact info, and saved payment methods.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Payment',
          description: 'Records money paid or refunded, including the date, amount, and status.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Subscription',
          description: 'Recurring plan (e.g. Monthly or Annual) with active, paused, or canceled status.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Invoice',
          description: 'Itemized bill listing items purchased, taxes, and payment confirmation.'
        }
      ],
      nonNegotiables: [
        'A customer must never be charged twice for the same checkout or payment attempt.',
        'Always store money as exact whole cents (e.g. $10.00 = 1000) so calculations never lose pennies or round incorrectly.',
        'A refund can never be greater than the original amount paid.',
        'A canceled subscription must never trigger automatic renewal charges.'
      ],
      criticalWorkflows: [
        'Customer enters payment details and completes checkout',
        'Automatic subscription renewal and receipt email delivery',
        'Customer requests a refund or updates their payment method'
      ]
    };
  }

  // Auth / Users archetype
  if (text.includes('auth') || text.includes('user') || text.includes('rbac') || text.includes('permission') || text.includes('tenant') || text.includes('org') || text.includes('account')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'User Account',
          description: 'Person using the app, with their email, password, and profile settings.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Team / Workspace',
          description: 'Shared workspace or company group that members belong to.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Role & Permissions',
          description: 'What each person is allowed to do (e.g. Admin, Editor, Viewer).'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Login Session',
          description: 'Tracks when and where a user is signed in to keep their account secure.'
        }
      ],
      nonNegotiables: [
        'Users can only view and edit data from their own team or account — never another team’s private data.',
        'When a user logs out or resets their password, their active login sessions must immediately end.',
        'Passwords must always be securely encrypted and never shown in plain text or shared.',
        'Every team or workspace must always have at least one active Admin / Owner.'
      ],
      criticalWorkflows: [
        'New user signs up, verifies email, and logs in',
        'Admin invites a teammate and assigns them a role',
        'User securely resets their password or logs out from all devices'
      ]
    };
  }

  // E-Commerce / Store / Orders archetype
  if (text.includes('order') || text.includes('shop') || text.includes('store') || text.includes('cart') || text.includes('inventory') || text.includes('product') || text.includes('item')) {
    return {
      entities: [
        {
          id: 'ent_' + Date.now() + '_1',
          name: 'Product',
          description: 'Item available for sale, with its name, price, photos, and details.'
        },
        {
          id: 'ent_' + Date.now() + '_2',
          name: 'Shopping Cart',
          description: 'Holds items selected by a customer before they check out.'
        },
        {
          id: 'ent_' + Date.now() + '_3',
          name: 'Order',
          description: 'Confirmed purchase with ordered items, total paid, and shipping address.'
        },
        {
          id: 'ent_' + Date.now() + '_4',
          name: 'Delivery Tracking',
          description: 'Tracks shipping carrier, tracking number, and delivery status.'
        }
      ],
      nonNegotiables: [
        'Inventory stock can never drop below zero — customers cannot buy items that are out of stock.',
        'The price of items in an order must be permanently locked at checkout time so future price changes do not alter past receipts.',
        'An order cannot be marked as "Shipped" or "Completed" before payment is successfully confirmed.',
        'If an order is canceled, the items must be automatically returned to available stock.'
      ],
      criticalWorkflows: [
        'Customer browses products and adds items to shopping cart',
        'Customer enters shipping and payment info to place order',
        'Store prepares shipment and sends tracking number to customer'
      ]
    };
  }

  // Generic Approachable Default
  const cleanName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    entities: [
      {
        id: 'ent_' + Date.now() + '_1',
        name: cleanName ? cleanName.replace(/\s+/g, ' ') : 'Main Item',
        description: 'The primary record or content that this app manages and displays.'
      },
      {
        id: 'ent_' + Date.now() + '_2',
        name: 'User Profile',
        description: 'Person or member who creates and interacts with items in the app.'
      },
      {
        id: 'ent_' + Date.now() + '_3',
        name: 'Activity History',
        description: 'Keeps a record of who changed what and when for safety and auditing.'
      }
    ],
    nonNegotiables: [
      'If an action fails halfway through, undo the changes so data is never left half-saved or corrupted.',
      'Deleted items must be safely archived and never show up in active user views.',
      'Prevent two users from accidentally overwriting each other’s edits at the exact same moment.'
    ],
    criticalWorkflows: [
      'User creates and saves a new item with all required information',
      'User updates or reviews existing items',
      'User safely deletes or archives an item'
    ]
  };
}
