"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useRef, useState } from "react";

interface LogoUploaderProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function LogoUploader({ label, value, onChange }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file?.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      onChange(URL.createObjectURL(file));
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        onChange(URL.createObjectURL(file));
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
          "hover:border-primary/50",
        )}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 border border-border rounded-lg flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
            {value ? (
              <img src={value} alt={`${label} logo`} className="w-full h-full object-contain" />
            ) : (
              <ArrowUpTrayIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </Button>
              {value && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
