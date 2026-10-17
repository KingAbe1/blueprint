import { FrameworkRecommendation } from '../types/project';

export const BASE_FRAMEWORKS: Record<string, { 
  name: string; 
  category: FrameworkRecommendation['category']; 
  architecture: FrameworkRecommendation['architecture'];
  frontendStack?: string;
  backendStack?: string;
  stylingStack?: string;
  databaseStack?: string;
  description: string;
}> = {
  'nextjs': {
    name: 'Next.js 15 (React / TypeScript)',
    category: 'Full-Stack Web',
    architecture: 'Integrated Full-Stack',
    frontendStack: 'React 19 + TypeScript (App Router)',
    backendStack: 'Server Actions & Edge API Routes',
    stylingStack: 'Tailwind CSS v4 + Lucide',
    databaseStack: 'PostgreSQL + Prisma ORM',
    description: 'Production full-stack web framework with integrated server actions, API routes, and fast edge rendering.'
  },
  'react-fastapi': {
    name: 'React (Vite) + FastAPI (Python)',
    category: 'Frontend SPA',
    architecture: 'Separate (Frontend + Backend)',
    frontendStack: 'React 19 + TypeScript (Vite)',
    backendStack: 'FastAPI (Python 3.12) + asyncpg',
    stylingStack: 'Tailwind CSS v4 + shadcn/ui',
    databaseStack: 'PostgreSQL + SQLAlchemy',
    description: 'Decoupled modern frontend paired with a high-speed async Python REST API for maximum performance.'
  },
  'react-vite': {
    name: 'React + Vite (SPA)',
    category: 'Frontend SPA',
    architecture: 'Separate (Frontend + Backend)',
    frontendStack: 'React 19 + TypeScript (Vite)',
    backendStack: 'Node.js (Hono / Express) or BaaS',
    stylingStack: 'Tailwind CSS v4 + Lucide',
    databaseStack: 'Supabase PostgreSQL or REST API',
    description: 'Lightweight client-side web application with instant HMR and low-overhead deployment.'
  },
  'tauri': {
    name: 'Tauri 2.0 (Rust + Web)',
    category: 'Desktop App',
    architecture: 'Desktop App',
    frontendStack: 'React + TypeScript (Vite)',
    backendStack: 'Rust Core (Native IPC)',
    stylingStack: 'Tailwind CSS + Lucide',
    databaseStack: 'SQLite / Embedded File DB',
    description: 'Ultra-lightweight native desktop app for macOS, Windows, and Linux with tiny RAM usage.'
  },
  'fastapi': {
    name: 'FastAPI (Python) + PostgreSQL',
    category: 'Backend API',
    architecture: 'Separate (Frontend + Backend)',
    frontendStack: 'Decoupled Web Client or SPA',
    backendStack: 'FastAPI (Python) + Pydantic v2',
    stylingStack: 'Tailwind CSS (Docs UI)',
    databaseStack: 'PostgreSQL + asyncpg',
    description: 'High-speed typed async Python backend designed for data processing, AI models, and automation.'
  },
  'expo': {
    name: 'Expo (React Native / Mobile)',
    category: 'Mobile App',
    architecture: 'Mobile App',
    frontendStack: 'React Native / Expo Router',
    backendStack: 'REST / GraphQL Cloud API',
    stylingStack: 'NativeWind (Tailwind) / React Native StyleSheet',
    databaseStack: 'Cloud Database / SQLite Local',
    description: 'Universal cross-platform mobile application running natively on iOS and Android.'
  }
};

export function recommendFrameworkFromText(projectName: string, description: string): FrameworkRecommendation[] {
  const text = (projectName + ' ' + description).toLowerCase().trim();

  if (!text || (!description.trim() && !projectName.trim())) {
    return [];
  }

  const isDesktop = /\b(desktop app(?:lication)?|native desktop|tauri|electron|installable on (?:mac|windows|linux))\b/.test(text)
    || (text.includes('desktop') && (text.includes('macos') || text.includes('windows') || text.includes('offline')));
  const isMobile = text.includes('mobile') || text.includes('ios') || text.includes('android') || text.includes('phone') || text.includes('app store') || text.includes('tablet');
  const isAI = text.includes('ai') || text.includes('machine learning') || text.includes('llm') || text.includes('python') || text.includes('data analysis') || text.includes('rag') || text.includes('gpt') || text.includes('claude');
  const isEcomOrPayments = text.includes('pay') || text.includes('cart') || text.includes('store') || text.includes('shop') || text.includes('checkout') || text.includes('stripe') || text.includes('billing') || text.includes('order');
  const isRealtime = text.includes('chat') || text.includes('real-time') || text.includes('live') || text.includes('stream') || text.includes('websocket') || text.includes('collaboration') || text.includes('notification');
  const isApiOnly = text.includes('backend') || text.includes('api') || text.includes('microservice') || text.includes('webhook') || text.includes('cron');

  const recommendations: FrameworkRecommendation[] = [];

  if (isDesktop) {
    recommendations.push({
      id: 'tauri',
      name: BASE_FRAMEWORKS.tauri.name,
      category: 'Desktop App',
      description: 'Native cross-platform desktop application for macOS, Windows, and Linux.',
      whyReasons: [
        'Direct offline access to the user’s local computer filesystem and system notifications.',
        'Extremely lightweight (<30MB RAM), using system webviews instead of resource-heavy Electron.',
        'Build native desktop tools using modern web tech (React/TypeScript) backed by a secure Rust core.',
      ],
      bestFor: `Desktop tools, offline workstations, and local file managers matching ${projectName}`,
      isRecommended: true,
    });
  }

  if (isMobile) {
    recommendations.push({
      id: 'expo',
      name: BASE_FRAMEWORKS.expo.name,
      category: 'Mobile App',
      description: 'Universal mobile application for iOS and Android using a single TypeScript codebase.',
      whyReasons: [
        'Single codebase runs natively on both iPhone and Android devices with native UI fluidity.',
        'Immediate mobile testing: scan a QR code with the Expo Go app to test directly on your phone.',
        'Full hardware integration: Access cameras, push notifications, FaceID, and device sensors.',
      ],
      bestFor: `Mobile apps and on-the-go user experiences matching ${projectName}`,
      isRecommended: recommendations.length === 0,
    });
  }

  if (isAI && isApiOnly) {
    recommendations.push({
      id: 'fastapi',
      name: BASE_FRAMEWORKS.fastapi.name,
      category: 'Backend API',
      description: 'High-speed async Python API backend with native machine learning support.',
      whyReasons: [
        'Seamless integration with Python AI ecosystems (OpenAI, LangChain, PyTorch, HuggingFace).',
        'Automatic interactive API documentation (Swagger UI) generated directly from your code.',
        'Strict type validation with Pydantic guarantees clean data inputs across your AI pipelines.',
      ],
      bestFor: 'AI processing backends, data transformation pipelines, and intelligent services',
      isRecommended: recommendations.length === 0,
    });
  }

  if (isEcomOrPayments || !isDesktop || recommendations.length === 0) {
    const dynamicReasons = [
      isEcomOrPayments
        ? 'Built-in server routes provide secure, idempotent Stripe webhook and checkout handling.'
        : 'Unified full-stack architecture lets you build user interfaces and database logic together.',
      isRealtime
        ? 'Server components and streaming SSR deliver instant UI rendering for live data updates.'
        : 'Server-side rendering ensures fast page speeds and top search engine discovery.',
      'Out-of-the-box support for Tailwind CSS, database ORMs (Prisma/Drizzle), and user auth.',
    ];

    recommendations.push({
      id: 'nextjs',
      name: BASE_FRAMEWORKS.nextjs.name,
      category: 'Full-Stack Web',
      description: 'Production-ready full-stack web framework with server actions and edge API routes.',
      whyReasons: dynamicReasons,
      bestFor: `SaaS platforms, customer portals, and web services matching ${projectName}`,
      isRecommended: recommendations.length === 0,
    });
  }

  recommendations.push({
    id: 'react-vite',
    name: BASE_FRAMEWORKS['react-vite'].name,
    category: 'Frontend SPA',
    description: 'Fast client-side web application with instant HMR and minimal overhead.',
    whyReasons: [
      'Instant development feedback with sub-second hot module replacement.',
      'Easily connects to serverless backends like Supabase, Firebase, or custom REST APIs.',
      'Zero server maintenance - host on any global CDN for free with zero cold starts.',
    ],
    bestFor: 'Interactive dashboards, client portals, and responsive tools',
    isRecommended: recommendations.length === 0,
  });

  return recommendations.slice(0, 3).map((fw, index) => ({
    ...fw,
    isRecommended: index === 0,
  }));
}
