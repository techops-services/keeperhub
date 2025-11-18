"use client";

import MonacoEditor, { type EditorProps, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { vercelDarkTheme } from "@/lib/monaco-theme";

export function CodeEditor(props: EditorProps) {
  const { theme } = useTheme();

  const handleEditorMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("vercel-dark", vercelDarkTheme);
    monaco.editor.setTheme(theme === "dark" ? "vercel-dark" : "light");

    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  return (
    <MonacoEditor
      {...props}
      onMount={handleEditorMount}
      theme={theme === "dark" ? "vercel-dark" : "light"}
    />
  );
}

