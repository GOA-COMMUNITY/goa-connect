import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { addComment, fetchComments, logShortEvent, type ShortComment } from "@/lib/shorts-social";
import type { Short } from "@/components/ShortsFeed";

export function CommentSheet({
  short,
  onClose,
  onCountChange,
}: {
  short: Short;
  onClose: () => void;
  onCountChange: (videoId: string, count: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ShortComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchComments(short.videoId).then((rows) => {
      if (cancelled) return;
      setComments(rows);
      onCountChange(short.videoId, rows.length);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [short.videoId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (!user) {
      toast.info("Sign in to join the conversation");
      return;
    }
    setSending(true);
    try {
      await addComment(short.videoId, user.id, text);
      logShortEvent(short.videoId, "comment", short.source ?? "youtube", 0, user.id);
      const rows = await fetchComments(short.videoId);
      setComments(rows);
      onCountChange(short.videoId, rows.length);
      setBody("");
    } catch {
      toast.error("Couldn't post that comment");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Close comments" onClick={onClose} />
      <div className="relative z-10 flex h-[72svh] w-full max-w-2xl flex-col rounded-t-3xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-bold text-foreground">Comments</p>
            <p className="text-[11px] text-muted-foreground">{comments.length} on this short</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-secondary" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              No comments yet — be the first Goan to say something.
            </p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <ProfileAvatar
                url={comment.author?.avatar_url ?? null}
                emoji={comment.author?.avatar_emoji ?? null}
                name={comment.author?.display_name ?? "Goan"}
                className="h-9 w-9"
                fallbackClassName="text-base"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {comment.author?.display_name ?? "Goan"}
                </p>
                <p className="text-sm text-foreground">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Post comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
