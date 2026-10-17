import React from 'react';

function renderInline(text: string, isDark: boolean): React.ReactNode[] {
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  return text.split(tokenPattern).filter(Boolean).map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index} className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${isDark ? 'bg-white/10 text-blue-200' : 'bg-slate-100 text-blue-700'}`}>{token.slice(1, -1)}</code>;
    }
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index} className="font-semibold">{token.slice(2, -2)}</strong>;
    if (token.startsWith('*') && token.endsWith('*')) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith('~~') && token.endsWith('~~')) return <del key={index}>{token.slice(2, -2)}</del>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (/^https?:\/\//i.test(href)) {
        return <a key={index} href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-500">{label}</a>;
      }
      return <span key={index}>{label}</span>;
    }
    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index] || '';
  return /^\s*(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|\|)/.test(line)
    || /^\s*([-*_]\s*){3,}$/.test(line)
    || (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || ''));
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

export const MarkdownDocumentPreview: React.FC<{
  content: string;
  isDark: boolean;
  /** `embedded` fills the handoff pane; `document` keeps a centered reading column. */
  layout?: 'document' | 'embedded';
}> = ({ content, isDark, layout = 'document' }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  const bodyText = isDark ? 'text-slate-300' : 'text-slate-700';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```([^\s`]*)\s*$/);
    if (fence) {
      const language = fence[1];
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(
        <div key={`code-${index}`} className={`my-5 overflow-hidden rounded-xl border ${isDark ? 'border-white/10 bg-[#0c0d10]' : 'border-slate-200 bg-slate-50'}`}>
          {language && <div className={`border-b px-4 py-2 font-mono text-[10px] uppercase tracking-wide ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>{language}</div>}
          <pre className={`overflow-x-auto p-4 font-mono text-xs leading-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><code>{code.join('\n')}</code></pre>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = renderInline(heading[2], isDark);
      const className = level === 1
        ? `mb-5 mt-2 border-b pb-4 text-2xl font-semibold tracking-tight ${isDark ? 'border-white/10 text-white' : 'border-slate-200 text-slate-950'}`
        : level === 2
          ? `mb-3 mt-8 text-lg font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`
          : `mb-2 mt-6 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`;
      const Tag = `h${Math.min(level, 3)}` as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={`heading-${index}`} className={className}>{title}</Tag>);
      index += 1;
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} className={`my-6 ${isDark ? 'border-white/10' : 'border-slate-200'}`} />);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      blocks.push(<blockquote key={`quote-${index}`} className={`my-4 border-l-2 pl-4 italic ${isDark ? 'border-blue-400/60 text-slate-400' : 'border-blue-400 text-slate-600'}`}>{quote.map((text, quoteIndex) => <p key={quoteIndex}>{renderInline(text, isDark)}</p>)}</blockquote>);
      continue;
    }

    const nextLine = lines[index + 1] || '';
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(nextLine)) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(splitTableRow(lines[index++]));
      blocks.push(
        <div key={`table-${index}`} className="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead className={isDark ? 'bg-white/[0.04] text-slate-200' : 'bg-slate-50 text-slate-800'}>
              <tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-slate-200 px-3 py-2.5 font-semibold dark:border-white/10">{renderInline(cell, isDark)}</th>)}</tr>
            </thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex % 2 ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50/50') : ''}>{headers.map((_, cellIndex) => <td key={cellIndex} className={`border-b px-3 py-2.5 align-top leading-5 last:border-b-0 ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-600'}`}>{renderInline(row[cellIndex] || '', isDark)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listMatch) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      const matcher = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (index < lines.length) {
        const itemMatch = lines[index].match(matcher);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        index += 1;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`list-${index}`} className={`my-3 space-y-2 pl-6 text-sm leading-6 ${ordered ? 'list-decimal' : 'list-disc'} ${bodyText}`}>
          {items.map((item, itemIndex) => {
            const task = item.match(/^\[([ xX])\]\s*(.*)$/);
            return <li key={itemIndex} className="pl-1">{task && <span aria-label={task[1].toLowerCase() === 'x' ? 'Complete' : 'Incomplete'} className={`mr-2 inline-flex h-3.5 w-3.5 items-center justify-center rounded border align-[-2px] text-[9px] ${task[1].toLowerCase() === 'x' ? 'border-emerald-500 bg-emerald-500 text-white' : isDark ? 'border-slate-600' : 'border-slate-300'}`}>{task[1].toLowerCase() === 'x' ? '✓' : ''}</span>}{renderInline(task ? task[2] : item, isDark)}</li>;
          })}
        </ListTag>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) paragraph.push(lines[index++]);
    blocks.push(<p key={`paragraph-${index}`} className={`my-3 text-sm leading-7 ${bodyText}`}>{renderInline(paragraph.join(' '), isDark)}</p>);
  }

  const embedded = layout === 'embedded';

  return (
    <article
      className={`flex-1 overflow-y-auto overscroll-contain xl:min-h-0 ${bodyText} ${
        embedded
          ? 'min-h-[min(52vh,640px)] px-5 py-5 sm:px-6 sm:py-6'
          : 'min-h-[min(58vh,680px)] px-6 py-5 sm:px-8 sm:py-7'
      }`}
    >
      <div className={embedded ? mutedText : `mx-auto max-w-3xl ${mutedText}`}>{blocks}</div>
    </article>
  );
};
