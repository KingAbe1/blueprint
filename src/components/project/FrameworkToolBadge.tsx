import React from 'react';
import { Code2 } from 'lucide-react';
import {
  siActix,
  siAngular,
  siCypress,
  siDjango,
  siDrizzle,
  siElectron,
  siExpo,
  siExpress,
  siFastapi,
  siFastify,
  siFlask,
  siGin,
  siJest,
  siNestjs,
  siNextdotjs,
  siPrisma,
  siReact,
  siReactquery,
  siSvelte,
  siTailwindcss,
  siTauri,
  siTestinglibrary,
  siTokio,
  siVitest,
  siVite,
  siVuedotjs,
} from 'simple-icons';
import { useTheme } from '../../context/ThemeContext';

interface FrameworkToolBadgeProps {
  name: string;
}

const frameworkIcons: Record<string, { hex: string; path: string }> = {
  'Next.js': siNextdotjs,
  React: siReact,
  'React Native': siReact,
  Expo: siExpo,
  Vue: siVuedotjs,
  Nuxt: siVuedotjs,
  Svelte: siSvelte,
  SvelteKit: siSvelte,
  Angular: siAngular,
  Express: siExpress,
  NestJS: siNestjs,
  Fastify: siFastify,
  Vite: siVite,
  'Tailwind CSS': siTailwindcss,
  Prisma: siPrisma,
  'Drizzle ORM': siDrizzle,
  Electron: siElectron,
  Tauri: siTauri,
  Vitest: siVitest,
  Jest: siJest,
  Cypress: siCypress,
  'React Testing Library': siTestinglibrary,
  'React Query': siReactquery,
  FastAPI: siFastapi,
  Django: siDjango,
  Flask: siFlask,
  'Actix Web': siActix,
  Tokio: siTokio,
  Gin: siGin,
};

export const FrameworkToolBadge: React.FC<FrameworkToolBadgeProps> = ({ name }) => {
  const { isDark } = useTheme();
  const icon = frameworkIcons[name];

  return <span
    title={name}
    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-700'}`}
  >
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-white">
      {icon
        ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-2.5 w-2.5" fill={`#${icon.hex}`}><path d={icon.path} /></svg>
        : <Code2 aria-hidden="true" className="h-2.5 w-2.5 text-slate-400" />}
    </span>
    {name}
  </span>;
};
