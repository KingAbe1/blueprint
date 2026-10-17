import {
  BRIEF_SECTION_SERIALIZE_LABEL,
  parseProductBriefSections,
  serializeProductBriefSections,
  ProductBriefSection,
} from './domainExtractor';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionHeaderLabel(section: ProductBriefSection): string {
  return BRIEF_SECTION_SERIALIZE_LABEL[section.id] ?? section.title;
}

/** Loads spec.description plain text into HTML for the rich-text editor. */
export function plainBriefToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '<p></p>';

  const sections = parseProductBriefSections(trimmed);
  if (sections.length === 1 && sections[0].id === 'overview') {
    const overview = sections[0];
    const parts: string[] = overview.paragraphs
      .filter(p => p.trim())
      .map(p => `<p>${escapeHtml(p)}</p>`);
    if (overview.bullets.length > 0) {
      parts.push(
        `<ul>${overview.bullets
          .filter(b => b.trim())
          .map(b => `<li><p>${escapeHtml(b)}</p></li>`)
          .join('')}</ul>`,
      );
    }
    return parts.join('') || '<p></p>';
  }

  return sections
    .map(section => {
      const parts: string[] = [];
      if (section.id !== 'overview') {
        parts.push(`<h3>${escapeHtml(sectionHeaderLabel(section))}</h3>`);
      }
      section.paragraphs
        .filter(p => p.trim())
        .forEach(p => parts.push(`<p>${escapeHtml(p)}</p>`));
      if (section.bullets.length > 0) {
        parts.push(
          `<ul>${section.bullets
            .filter(b => b.trim())
            .map(b => `<li><p>${escapeHtml(b)}</p></li>`)
            .join('')}</ul>`,
        );
      }
      return parts.join('');
    })
    .join('');
}

function headerLineToSectionId(header: string): string | null {
  const normalized = header.trim().toLowerCase();
  if (normalized === 'summary') return 'summary';
  if (normalized === "who it's for") return 'audience';
  if (normalized.startsWith('what it does')) return 'capabilities';
  if (normalized.startsWith('out of scope')) return 'out_of_scope';
  return null;
}

function headerIdToTitle(id: string): string {
  if (id === 'capabilities') return 'First release';
  if (id === 'out_of_scope') return 'Out of scope';
  if (id === 'audience') return "Who it's for";
  if (id === 'summary') return 'Summary';
  return 'Overview';
}

/** Plain text for a block, preserving links as "label (url)". */
export function richBlockPlainText(element: HTMLElement): string {
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'A') {
      const href = node.getAttribute('href')?.trim();
      const label = node.textContent?.trim() ?? '';
      if (href && href !== label) {
        parts.push(`${label} (${href})`);
      } else {
        parts.push(label || href || '');
      }
      return;
    }
    if (node.tagName === 'BR') {
      parts.push('\n');
      return;
    }
    node.childNodes.forEach(walk);
  };

  element.childNodes.forEach(walk);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

const BLOCK_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'LI']);

function collectBlockElements(root: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];

  const walk = (parent: HTMLElement) => {
    Array.from(parent.children).forEach(child => {
      if (!(child instanceof HTMLElement)) return;
      if (BLOCK_TAGS.has(child.tagName)) {
        blocks.push(child);
        return;
      }
      if (child.tagName === 'DIV') {
        walk(child);
        return;
      }
      blocks.push(child);
    });
  };

  walk(root);
  return blocks;
}

/** Saves editor HTML back to plain-text spec.description. */
export function htmlToPlainBrief(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sections: ProductBriefSection[] = [];
  let current: ProductBriefSection = { id: 'overview', title: 'Overview', paragraphs: [], bullets: [] };

  const flush = () => {
    if (current.paragraphs.length > 0 || current.bullets.length > 0) {
      sections.push(current);
    }
    current = { id: 'overview', title: 'Overview', paragraphs: [], bullets: [] };
  };

  const pushParagraph = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    current.paragraphs.push(trimmed);
  };

  const pushBullet = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    current.bullets.push(trimmed);
  };

  const blocks = collectBlockElements(doc.body);

  blocks.forEach(block => {
    const tag = block.tagName;

    if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') {
      flush();
      const header = block.textContent?.trim() ?? '';
      const sectionId = headerLineToSectionId(header);
      if (sectionId) {
        current = { id: sectionId, title: headerIdToTitle(sectionId), paragraphs: [], bullets: [] };
      } else if (header) {
        pushParagraph(header);
      }
      return;
    }

    if (tag === 'P') {
      pushParagraph(richBlockPlainText(block));
      return;
    }

    if (tag === 'BLOCKQUOTE') {
      pushParagraph(richBlockPlainText(block));
      return;
    }

    if (tag === 'HR') return;

    if (tag === 'UL' || tag === 'OL') {
      block.querySelectorAll(':scope > li').forEach(li => {
        if (li instanceof HTMLElement) pushBullet(richBlockPlainText(li));
      });
      return;
    }

    if (tag === 'LI') {
      pushBullet(richBlockPlainText(block));
    }
  });

  flush();

  if (sections.length === 0) {
    return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  return serializeProductBriefSections(sections);
}

/** Round-trip plain brief through HTML; used for sanity checks in devtools. */
export function roundTripPlainBrief(text: string): string {
  return htmlToPlainBrief(plainBriefToHtml(text));
}

export function resolveBriefHtml(plain: string, html?: string): string {
  if (html?.trim()) return html;
  return plainBriefToHtml(plain);
}
