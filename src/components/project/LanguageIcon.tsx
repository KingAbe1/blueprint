import React from 'react';
import { Code2 } from 'lucide-react';
import {
  siC,
  siCplusplus,
  siCss,
  siDart,
  siDotnet,
  siGo,
  siGnubash,
  siHtml5,
  siJavascript,
  siKotlin,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  siSass,
  siSvelte,
  siSwift,
  siTypescript,
  siVuedotjs,
  siYaml,
} from 'simple-icons';
import { useTheme } from '../../context/ThemeContext';

interface LanguageIconProps {
  name: string;
  files: number;
}

const languageIcons: Record<string, { hex: string; path: string }> = {
  'C': siC,
  'C/C++': siCplusplus,
  'C++': siCplusplus,
  'C#': siDotnet,
  CSS: siCss,
  SCSS: siSass,
  Dart: siDart,
  Go: siGo,
  HTML: siHtml5,
  Java: siOpenjdk,
  JavaScript: siJavascript,
  Kotlin: siKotlin,
  PHP: siPhp,
  Python: siPython,
  Ruby: siRuby,
  Rust: siRust,
  Shell: siGnubash,
  Svelte: siSvelte,
  Swift: siSwift,
  TypeScript: siTypescript,
  Vue: siVuedotjs,
  YAML: siYaml,
};

export const LanguageIcon: React.FC<LanguageIconProps> = ({ name, files }) => {
  const { isDark } = useTheme();
  const icon = languageIcons[name];

  return <span
    title={`${name} · ${files} ${files === 1 ? 'file' : 'files'}`}
    aria-label={`${name}, ${files} ${files === 1 ? 'file' : 'files'}`}
    className={`inline-flex h-10 items-center gap-2 rounded-lg border px-2 ${isDark ? 'border-white/[0.08] bg-white/[0.035]' : 'border-slate-200 bg-slate-50'}`}
  >
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white">
      {icon
        ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill={`#${icon.hex}`}><path d={icon.path} /></svg>
        : <Code2 aria-hidden="true" className={`h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />}
    </span>
    <span className={`text-[10px] font-medium tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{files}</span>
    <span className="sr-only">{name}</span>
  </span>;
};
