import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect } from "react";

interface Props {
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
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(highlights, false);
  }, [highlights, editor]);

  useEffect(() => {
    if (!editor) return;

    const handler = (e: any) => {
      const target = e.target as HTMLElement;
      const idx = target.getAttribute("data-idx");

      if (idx) {
        onWordClick(Number(idx));
      }
    };

    const el = editor.view.dom;
    el.addEventListener("click", handler);

    return () => el.removeEventListener("click", handler);
  }, [editor, onWordClick]);

  return (
    <EditorContent
      editor={editor}
      className="min-h-[520px] bg-white border rounded-2xl p-5 shadow-sm focus:ring-2 focus:ring-indigo-100"
    />
  );
}
