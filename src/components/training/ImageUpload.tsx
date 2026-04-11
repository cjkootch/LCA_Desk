"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploadProps {
  onUpload: (url: string, description: string) => void;
}

export function ImageUpload({ onUpload }: ImageUploadProps) {
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; description: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!description.trim()) {
      descriptionRef.current?.focus();
      toast.error("Please add a description before uploading");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description.trim());
      const res = await fetch("/api/upload/course-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPreview({ url: data.url, description: data.description });
      onUpload(data.url, data.description);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  if (preview) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={preview.description} className="w-full max-h-48 object-cover" />
          <button
            type="button"
            onClick={() => { setPreview(null); setDescription(""); }}
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
            title="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-text-muted px-3 py-2 italic">{preview.description}</p>
      </div>
    );
  }

  const hasDescription = description.trim().length > 0;

  return (
    <div className="space-y-2">
      <input
        ref={descriptionRef}
        type="text"
        className="input w-full text-sm"
        placeholder="Describe this image for accessibility and voice narration"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          hasDescription
            ? "cursor-pointer hover:border-accent/50"
            : "opacity-50 cursor-not-allowed",
          dragging && hasDescription && "border-accent bg-accent/5",
          !dragging && "border-border"
        )}
        onDragOver={e => { if (hasDescription) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={hasDescription ? handleDrop : undefined}
        onClick={() => hasDescription && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-text-muted">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-text-muted" />
            <p className="text-sm text-text-muted">
              {hasDescription ? "Drag an image here or click to browse" : "Enter a description first"}
            </p>
            <p className="text-xs text-text-muted opacity-60">JPEG, PNG, WebP, GIF · max 5MB</p>
          </div>
        )}
      </div>
    </div>
  );
}
