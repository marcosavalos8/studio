"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

// Square, tiny, and JPEG-compressed on purpose: this gets stored as a
// base64 string directly on the user's Firestore document (no Storage
// bucket), so every byte here counts against that document's 1MiB limit.
// 96px at 0.8 quality lands well under that (typically a few KB) while
// still looking sharp in an avatar circle.
const MAX_DIMENSION = 96;
const JPEG_QUALITY = 0.8;
const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024; // 8MB — just a sanity cap on the source photo

function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = MAX_DIMENSION;
        canvas.height = MAX_DIMENSION;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not supported in this browser."));
          return;
        }
        // Cover-crop to a square: scale so the shorter side fills the
        // canvas, then center the overflow so the photo isn't squished.
        const scale = Math.max(
          MAX_DIMENSION / img.width,
          MAX_DIMENSION / img.height,
        );
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (MAX_DIMENSION - w) / 2, (MAX_DIMENSION - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  value,
  onChange,
  fallback,
}: {
  value: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
  fallback: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      setError("That image is too large (max 8MB).");
      return;
    }
    setIsProcessing(true);
    try {
      const dataUrl = await resizeImageToBase64(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        {value && <AvatarImage src={value} alt="Profile photo" />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isProcessing}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="mr-2 h-4 w-4" />
            {isProcessing ? "Processing..." : value ? "Change Photo" : "Add Photo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
            >
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
