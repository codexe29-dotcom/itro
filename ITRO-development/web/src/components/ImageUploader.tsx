import { useRef, useState } from "react";
import { ImagePlus, Star, X, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/api";
import { Button, useToast } from "@/components/ui";

/**
 * Photo gallery uploader. Uploads real image files via POST /api/uploads and
 * manages an ordered list of image URLs (first = primary). Controlled by
 * `images` + `onChange`.
 */
export function ImageUploader({
  images,
  onChange,
  label = "Photo gallery",
  hint = "Upload one or more images. The first image is used as the primary photo.",
}: {
  images: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.push("error", `${file.name} is not an image.`);
          continue;
        }
        const { url } = await uploadFile(file);
        uploaded.push(url);
      }
      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
        toast.push("success", `Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}.`);
      }
    } catch (e: any) {
      toast.push("error", e?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }
  function makePrimary(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label">{label}</label>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            className="btn-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload images"}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-surface-border px-4 py-8 text-center text-sm text-ink-muted">
          No images yet. {hint}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((url, idx) => (
            <div
              key={url + idx}
              className="group relative aspect-square overflow-hidden rounded-lg border border-surface-border bg-surface-muted"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              {idx === 0 && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  <Star className="h-3 w-3" /> Primary
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
                {idx !== 0 && (
                  <button
                    type="button"
                    title="Set as primary"
                    className="rounded-full bg-white/90 p-1.5 text-ink hover:bg-white"
                    onClick={() => makePrimary(idx)}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Remove"
                  className="rounded-full bg-white/90 p-1.5 text-danger hover:bg-white"
                  onClick={() => remove(idx)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
