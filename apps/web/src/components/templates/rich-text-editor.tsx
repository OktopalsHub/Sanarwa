"use client";

import { Button } from "@sanarwa/ui/button";
import { Label } from "@sanarwa/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@sanarwa/ui/popover";
import { Separator } from "@sanarwa/ui/separator";
import { cn } from "@/lib/utils";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  PencilIcon,
  LanguageIcon,
  ListBulletIcon,
  SwatchIcon,
  CodeBracketIcon,
  HashtagIcon,
  PhotoIcon as ImageIconIcon,
  LinkIcon as LinkIconIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  MinusIcon,
  TableCellsIcon as TableIconIcon,
} from "@heroicons/react/24/outline";
import React, { useCallback } from "react";

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  variables?: Array<{ name: string; description?: string }>;
  onVariableInsert?: (variable: string) => void;
}

export function RichTextEditor({
  content = "",
  onChange,
  placeholder = "Start typing...",
  className,
  editable = true,
  variables = [],
  onVariableInsert,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;

    const url = window.prompt("Image URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertVariable = useCallback(
    (variable: string) => {
      if (!editor) return;

      editor.chain().focus().insertContent(`{{${variable}}}`).run();
      onVariableInsert?.(variable);
    },
    [editor, onVariableInsert],
  );

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {editable && (
        <div className="border-b bg-muted/50 p-2">
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold"
            >
              <PencilIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic"
            >
              <LanguageIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="Strikethrough"
            >
              <MinusIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              title="Code"
            >
              <CodeBracketIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              <HashtagIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              <HashtagIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              <HashtagIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="Bullet List"
            >
              <ListBulletIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="Numbered List"
            >
              <ListBulletIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
              title="Quote"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color">
                  <SwatchIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      "#000000",
                      "#374151",
                      "#6B7280",
                      "#9CA3AF",
                      "#EF4444",
                      "#F97316",
                      "#EAB308",
                      "#22C55E",
                      "#3B82F6",
                      "#8B5CF6",
                      "#EC4899",
                      "#F43F5E",
                    ].map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400"
                        style={{ backgroundColor: color }}
                        onClick={() => editor.chain().focus().setColor(color).run()}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editor.chain().focus().unsetColor().run()}
                    className="w-full"
                  >
                    Remove Color
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive("highlight")}
              title="Highlight"
            >
              <PencilIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            <ToolbarButton onClick={setLink} isActive={editor.isActive("link")} title="Add Link">
              <LinkIconIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton onClick={addImage} title="Add Image">
              <ImageIconIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            <ToolbarButton
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              title="Insert Table"
            >
              <TableIconIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="h-6" />

            {variables.length > 0 && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2" title="Insert Variable">
                      <LanguageIcon className="h-4 w-4 mr-1" />
                      Variables
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      <Label>Insert Variable</Label>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {variables.map((variable) => (
                          <Button
                            key={variable.name}
                            variant="ghost"
                            size="sm"
                            onClick={() => insertVariable(variable.name)}
                            className="w-full justify-start text-left"
                            title={variable.description}
                          >
                            <code className="text-xs">{"{{" + variable.name + "}}"}</code>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Separator orientation="vertical" className="h-6" />
              </>
            )}

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              title="Undo"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              title="Redo"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>
      )}

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus-within:outline-none"
      />
    </div>
  );
}
