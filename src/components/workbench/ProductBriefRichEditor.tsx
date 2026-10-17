import React, { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Eraser,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  htmlToPlainBrief,
  resolveBriefHtml,
  roundTripPlainBrief,
} from '../../services/productBriefRichText';

interface ProductBriefRichEditorProps {
  text: string;
  html?: string;
  onChange?: (plain: string, html: string) => void;
  inputClassName: string;
  placeholder?: string;
  readOnly?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
  isDark,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? isDark
            ? 'bg-blue-500/20 text-blue-200'
            : 'bg-blue-100 text-blue-800'
          : isDark
            ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function briefEditorStyles(isDark: boolean, readOnly: boolean): string {
  return `
    .product-brief-rich-editor .ProseMirror {
      min-height: ${readOnly ? '0' : '14rem'};
    }
    .product-brief-rich-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: ${isDark ? 'rgb(100 116 139)' : 'rgb(148 163 184)'};
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
    .product-brief-rich-editor .ProseMirror h3 {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.14em;
      margin: 1rem 0 0.5rem;
      text-transform: uppercase;
      color: ${isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)'};
    }
    .product-brief-rich-editor .ProseMirror h3:first-child {
      margin-top: 0;
    }
    .product-brief-rich-editor .ProseMirror ul,
    .product-brief-rich-editor .ProseMirror ol {
      margin: 0.35rem 0 0.75rem;
      padding-left: 1.35rem;
    }
    .product-brief-rich-editor .ProseMirror ul {
      list-style: disc;
    }
    .product-brief-rich-editor .ProseMirror ol {
      list-style: decimal;
    }
    .product-brief-rich-editor .ProseMirror blockquote {
      border-left: 3px solid ${isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(59, 130, 246, 0.35)'};
      margin: 0.5rem 0;
      padding-left: 0.75rem;
      color: ${isDark ? 'rgb(148 163 184)' : 'rgb(71 85 105)'};
    }
    .product-brief-rich-editor .ProseMirror hr {
      border: none;
      border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.45)'};
      margin: 0.75rem 0;
    }
    .product-brief-rich-editor .ProseMirror li p {
      margin: 0;
    }
    .product-brief-rich-editor .ProseMirror p {
      margin: 0.35rem 0;
    }
    .product-brief-rich-editor--readonly .ProseMirror {
      cursor: default;
    }
  `;
}

export const ProductBriefRichEditor: React.FC<ProductBriefRichEditorProps> = ({
  text,
  html,
  onChange,
  inputClassName,
  placeholder = 'Describe the product — use section headings and bullet lists for capabilities.',
  readOnly = false,
}) => {
  const { isDark } = useTheme();
  const lastEmittedPlain = useRef(text);
  const lastEmittedHtml = useRef(resolveBriefHtml(text, html));

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [3] },
        link: false,
      }),
      Link.configure({
        openOnClick: readOnly,
        autolink: !readOnly,
        linkOnPaste: !readOnly,
        HTMLAttributes: {
          class: isDark ? 'text-blue-300 underline underline-offset-2' : 'text-blue-600 underline underline-offset-2',
        },
      }),
      ...(readOnly ? [] : [Placeholder.configure({ placeholder })]),
    ],
    [isDark, placeholder, readOnly],
  );

  const editor = useEditor({
    extensions,
    content: resolveBriefHtml(text, html),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `product-brief-prosemirror px-3 py-3 text-sm leading-6 outline-none sm:px-4 ${readOnly ? 'py-4' : ''}`,
      },
    },
    onUpdate: readOnly
      ? undefined
      : ({ editor: instance }) => {
          const nextHtml = instance.getHTML();
          const plain = htmlToPlainBrief(nextHtml);
          lastEmittedPlain.current = plain;
          lastEmittedHtml.current = nextHtml;
          onChange?.(plain, nextHtml);
        },
  });

  useEffect(() => {
    if (!editor) return;
    const nextHtml = resolveBriefHtml(text, html);
    const plainUnchanged = text === lastEmittedPlain.current;
    const htmlUnchanged = nextHtml === lastEmittedHtml.current;
    if (plainUnchanged && htmlUnchanged) return;
    lastEmittedPlain.current = text;
    lastEmittedHtml.current = nextHtml;
    editor.commands.setContent(nextHtml, { emitUpdate: false });
  }, [text, html, editor]);

  useEffect(() => {
    if (!import.meta.env.DEV || readOnly) return;
    const sample = [
      'Summary',
      'A workspace for planning work and tracking delivery.',
      '',
      "Who it's for",
      '• Product managers',
      '• Engineering teams',
      '',
      'What it does (first release)',
      '• Create projects and tasks',
      '• See status on a shared board',
    ].join('\n');
    const roundTripped = roundTripPlainBrief(sample);
    const ok =
      roundTripped.includes('Product managers')
      && roundTripped.includes('Create projects and tasks')
      && roundTripped.includes('Summary');
    if (!ok) {
      console.error('[ProductBriefRichEditor] Plain-text round-trip check failed.', { sample, roundTripped });
    }
  }, [readOnly]);

  const wordCount = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text],
  );

  const setLink = () => {
    if (!editor || readOnly) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  if (!editor) {
    return (
      <div className={`min-h-[8rem] animate-pulse rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`} />
    );
  }

  const shell = isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200/80 bg-white/80';
  const toolbar = isDark ? 'border-white/[0.06] bg-black/20' : 'border-slate-200/90 bg-slate-50/90';
  const footer = isDark ? 'border-white/[0.06] text-slate-500' : 'border-slate-200 text-slate-500';

  return (
    <div className={`overflow-hidden rounded-xl border ${shell}`}>
      {!readOnly ? (
        <div className={`border-b px-2 py-1.5 ${toolbar}`}>
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarButton isDark={isDark} label="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Link" active={editor.isActive('link')} onClick={setLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span className={`mx-1 h-4 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} aria-hidden />
            <ToolbarButton isDark={isDark} label="Section heading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <Minus className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span className={`mx-1 h-4 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} aria-hidden />
            <ToolbarButton isDark={isDark} label="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
              <Eraser className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton isDark={isDark} label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </div>
        </div>
      ) : null}
      <div
        className={`product-brief-rich-editor ${readOnly ? 'product-brief-rich-editor--readonly' : ''} ${inputClassName} border-0 bg-transparent focus-within:ring-0 [&_.ProseMirror]:text-inherit`}
      >
        <EditorContent editor={editor} />
      </div>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[10px] ${footer}`}>
        <span>
          {wordCount} words
          {readOnly ? '' : ' · plain-text copy kept for AI'}
        </span>
        {!readOnly ? <span className="hidden sm:inline">Ctrl+B/I · Tab in lists</span> : null}
      </div>
      <style>{briefEditorStyles(isDark, readOnly)}</style>
    </div>
  );
};
