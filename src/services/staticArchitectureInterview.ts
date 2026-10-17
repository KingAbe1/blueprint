import { ArchitecturalInterview, ArchitectureQuestion } from '../types/project';

/** Fallback question set when AI is unavailable or user prefers a standard template. */
export function createStaticArchitectureInterview(): ArchitecturalInterview {
  const questions: ArchitectureQuestion[] = [
    {
      id: 'static-platform',
      category: 'platform',
      question: 'Where should people use this product first?',
      options: [
        { id: 'web', label: 'Web app (desktop + mobile browser)', recommended: true },
        { id: 'mobile', label: 'Mobile app (iOS/Android)' },
        { id: 'both', label: 'Web and mobile' },
      ],
    },
    {
      id: 'static-users',
      category: 'users',
      question: 'Who is the primary user?',
      options: [
        { id: 'team', label: 'Internal team / operators', recommended: true },
        { id: 'customers', label: 'External customers' },
        { id: 'both-users', label: 'Both internal and external users' },
      ],
    },
    {
      id: 'static-access',
      category: 'access',
      question: 'How should users sign in?',
      options: [
        { id: 'email', label: 'Email and password', recommended: true },
        { id: 'sso', label: 'SSO (Google, Microsoft, etc.)' },
        { id: 'none', label: 'No accounts for now' },
      ],
    },
    {
      id: 'static-topology',
      category: 'topology',
      question: 'How should the system be shaped initially?',
      options: [
        { id: 'monolith', label: 'One modular application', recommended: true },
        { id: 'services', label: 'Separate services per area' },
        { id: 'serverless', label: 'Managed / serverless functions' },
      ],
    },
    {
      id: 'static-data',
      category: 'data',
      question: 'What kind of data storage fits best?',
      options: [
        { id: 'postgres', label: 'Relational (PostgreSQL-style)', recommended: true },
        { id: 'document', label: 'Document store' },
        { id: 'minimal', label: 'Minimal persistence at first' },
      ],
    },
    {
      id: 'static-realtime',
      category: 'realtime',
      question: 'Do you need live updates?',
      options: [
        { id: 'no', label: 'Not in the first version', recommended: true },
        { id: 'yes', label: 'Yes — live dashboards or notifications' },
      ],
    },
    {
      id: 'static-deployment',
      category: 'deployment',
      question: 'Where should it run?',
      options: [
        { id: 'cloud', label: 'Managed cloud (Vercel, Railway, etc.)', recommended: true },
        { id: 'self', label: 'Self-hosted / VPS' },
        { id: 'local', label: 'Local-only prototype' },
      ],
    },
    {
      id: 'static-scale',
      category: 'scale',
      question: 'Expected scale in the first year?',
      options: [
        { id: 'small', label: 'Small team or early adopters', recommended: true },
        { id: 'medium', label: 'Thousands of active users' },
        { id: 'large', label: 'High traffic from day one' },
      ],
    },
  ];

  return {
    status: 'in_progress',
    currentQuestionIndex: 0,
    totalEstimatedQuestions: questions.length,
    questions,
    answers: [],
    inferredFacts: [],
    providerName: 'Blueprint template',
  };
}
