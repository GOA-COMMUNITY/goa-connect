import { useRef, useState } from "react";
import { Film, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_DURATION_SECONDS = 90;

type ShortUploadProps = {
  userId: string;
  area?: string | null;
  onUploaded?: () => void;
};

export function ShortUpload({ userId, area, onUploaded }: ShortUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  function clearSelection() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setDuration(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("video/")) return toast.error("Choose a video file");
    if (next.size > MAX_FILE_BYTES) return toast.error("Video must be smaller than 50 MB");
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setDuration(null);
  }

  async function uploadShort() {
    if (!file || !preview) return;
    if (duration === null) return toast.error("Wait for the video preview to load");
    if (duration > MAX_DURATION_SECONDS) return toast.error("Shorts can be up to 90 seconds");
    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: storageError } = await supabase.storage.from("shorts").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (storageError) {
      setUploading(false);
      return toast.error(storageError.message);
    }
    const { error: rowError } = await supabase.from("user_shorts").insert({
      user_id: userId,
      video_path: path,
      caption: caption.trim().slice(0, 500),
      area: area || null,
      duration_seconds: Math.round(duration),
    });
    if (rowError) {
      await supabase.storage.from("shorts").remove([path]);
      setUploading(false);
      return toast.error(rowError.message);
    }
    clearSelection();
    setCaption("");
    setUploading(false);
    toast.success("Your short is live");
    onUploaded?.();
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Film className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">Post a Short</h2>
          <p className="text-xs text-muted-foreground">Vertical video · up to 90 seconds · 50 MB</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        {!preview ? (
          <Button type="button" variant="outline" className="h-32 w-full flex-col border-dashed" onClick={() => inputRef.current?.click()}>
            <Upload className="h-6 w-6 text-primary" />
            Choose video
          </Button>
        ) : (
          <div className="relative mx-auto aspect-[9/16] max-h-[420px] overflow-hidden rounded-2xl bg-foreground">
            <video
              src={preview}
              className="h-full w-full object-contain"
              controls
              playsInline
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            />
            <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 rounded-full" onClick={clearSelection} aria-label="Remove selected video">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Write a caption about this moment in Goa…"
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <Button type="button" className="h-11 w-full rounded-full" disabled={!file || uploading || (duration ?? 0) > MAX_DURATION_SECONDS} onClick={uploadShort}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Posting…" : "Post Short"}
        </Button>
      </div>
    </section>
  );
}