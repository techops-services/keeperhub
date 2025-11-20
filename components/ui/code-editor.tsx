"use client";

import MonacoEditor, { type EditorProps, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { vercelDarkTheme } from "@/lib/monaco-theme";

export function CodeEditor(props: EditorProps) {
  const { resolvedTheme } = useTheme();

  const handleEditorMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("vercel-dark", vercelDarkTheme);
    monaco.editor.setTheme(resolvedTheme === "dark" ? "vercel-dark" : "light");

    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  return (
    <MonacoEditor
      {...props}
      onMount={handleEditorMount}
      theme={resolvedTheme === "dark" ? "vercel-dark" : "light"}
    />
  );
}

