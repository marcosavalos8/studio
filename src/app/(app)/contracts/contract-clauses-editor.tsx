"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";
import { sanitizeContractHtml } from "./contract-template";

type ContractClausesEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection/focus
      onClick={onClick}
      className={cn(
        "h-8 w-8 p-0",
        active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

// Rich text editor for a contract's clauses. Controlled from the outside
// (`value`/`onChange`, like a normal form field) so it plugs straight into
// react-hook-form, but internally Tiptap owns the live editing state —
// editor.commands.setContent() is only called when `value` changes for a
// reason OTHER than the user's own typing (loading an existing contract,
// or clicking "Generate Template"), never on every keystroke.
export function ContractClausesEditor({ value, onChange, disabled }: ContractClausesEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: !disabled,
    // Next.js renders this client component on the server for the initial
    // HTML too; Tiptap's DOM output can differ slightly from that first
    // server-rendered pass, which throws off hydration. Deferring the
    // first render to the client avoids that mismatch.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(sanitizeContractHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class:
          "prose-contract min-h-[320px] max-w-none px-4 py-3 focus:outline-none",
      },
    },
  });

  // Sync external value changes (loading a contract, "Generate Template")
  // into the editor without fighting the user's own typing.
  React.useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className="min-h-[360px] rounded-md border bg-muted/20 animate-pulse" />
    );
  }

  return (
    <div className="rounded-md border">
      <Toolbar editor={editor} />
      <style jsx global>{`
        .prose-contract h1 {
          font-size: 1.375rem;
          font-weight: 700;
          text-align: center;
          margin: 0.5rem 0 1rem;
        }
        .prose-contract h2 {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
        }
        .prose-contract h3 {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 1rem 0 0.4rem;
        }
        .prose-contract p {
          margin: 0.5rem 0;
          line-height: 1.5;
        }
        .prose-contract ul,
        .prose-contract ol {
          margin: 0.4rem 0 0.6rem 1.25rem;
        }
        .prose-contract ul {
          list-style: disc;
        }
        .prose-contract ol {
          list-style: decimal;
        }
        .prose-contract li {
          margin: 0.2rem 0;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
