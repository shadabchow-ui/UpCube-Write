import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface EditorProps {
  content: string;
  onChange: (text: string) => void;
  highlights: string;
  onWordClick: (idx: number) => void;
}

export default function Editor({
  content,
  onChange,
  highlights,
  onWordClick,
}: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    autofocus: true,
    onUpdate: ({ editor }) => {
      onChange(editor.getText());
    },
  });

  // Update content when external text changes
  useEffect(() => {
    if (!editor) return;

    const current = editor.getText();
    if (current !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  // Inject highlighted HTML whenever suggestions change
  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(highlights, false);
  }, [highlights, editor]);

  // Handle clicks on highlighted spans
  useEffect(() => {
    if (!editor) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const idx = target.getAttribute("data-idx");

      if (idx) {
        onWordClick(Number(idx));
      }
    };

    const el = editor.view.dom;
    el.addEventListener("click", handler);

    return () => {
      el.removeEventListener("click", handler);
    };
  }, [editor, onWordClick]);

  return (
    <div className="border rounded-2xl bg-white shadow-sm p-2">
      <EditorContent
        editor={editor}
        className="min-h-[520px] p-4 focus:outline-none"
      />
    </div>
  );
}
