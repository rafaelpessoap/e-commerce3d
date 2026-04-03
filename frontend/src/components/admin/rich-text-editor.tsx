'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Undo,
  Redo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  simple?: boolean; // hide image/heading buttons for short descriptions
}

export function RichTextEditor({ value, onChange, placeholder, simple }: RichTextEditorProps) {
  const [htmlMode, setHtmlMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] px-4 py-3 focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  function insertImage() {
    const url = prompt('URL da imagem:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }

  function insertLink() {
    const url = prompt('URL do link:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito">
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolBtn>
        {!simple && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título H2">
              <Heading2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título H3">
              <Heading3 className="h-4 w-4" />
            </ToolBtn>
          </>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn onClick={insertLink} title="Link">
          <LinkIcon className="h-4 w-4" />
        </ToolBtn>
        {!simple && (
          <ToolBtn onClick={insertImage} title="Imagem">
            <ImageIcon className="h-4 w-4" />
          </ToolBtn>
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
          <Undo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
          <Redo className="h-4 w-4" />
        </ToolBtn>

        <div className="flex-1" />
        <Button
          variant={htmlMode ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            if (htmlMode) {
              // Switch back from HTML: update editor content
              editor.commands.setContent(value);
            }
            setHtmlMode(!htmlMode);
          }}
        >
          <Code className="h-3 w-3 mr-1" />
          HTML
        </Button>
      </div>

      {/* Editor or HTML textarea */}
      {htmlMode ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          className="border-0 rounded-none font-mono text-sm focus-visible:ring-0"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-muted transition-colors',
        active && 'bg-muted text-primary',
      )}
    >
      {children}
    </button>
  );
}
