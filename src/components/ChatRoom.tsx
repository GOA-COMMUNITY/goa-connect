import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { toast } from "sonner";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function ChatRoom({ conversationId, onClose }: { conversationId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversation, isLoading, error, refetch } = useQuery({
    queryKey: ["conversation", conversationId, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("conversations")
        .select("id, user_a, user_b")
        .eq("id", conversationId)
        .single();
      if (queryError) throw queryError;
      return data;
    },
  });

  const otherId = conversation
    ? conversation.user_a === user?.id
      ? conversation.user_b
      : conversation.user_a
    : null;

  const { data: other } = useQuery({
    queryKey: ["profile", otherId],
    enabled: !!otherId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("display_name, avatar_emoji, avatar_url, area")
        .eq("id", otherId ?? "")
        .single();
      if (queryError) throw queryError;
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      return data as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          queryClient.setQueryData<Message[]>(["messages", conversationId], (current = []) =>
            current.some((message) => message.id === incoming.id) ? current : [...current, incoming],
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, typing]);

  useLayoutEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [conversationId]);

  useEffect(() => {
    if (!conversation || isLoading) return;
    const focusComposer = () => inputRef.current?.focus({ preventScroll: true });
    focusComposer();
    const frame = window.requestAnimationFrame(focusComposer);
    const timeout = window.setTimeout(focusComposer, 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [conversation, conversationId, isLoading]);

  const closeRoom = () => {
    if (onClose) {
      onClose();
      return;
    }
    void navigate({ to: "/chats", search: { conversation: undefined }, replace: true });
  };

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !user || sending) return;

    setSending(true);
    const optimisticId = `pending-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
    };
    setBody("");
    queryClient.setQueryData<Message[]>(["messages", conversationId], (current = []) => [...current, optimistic]);

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();

    if (insertError) {
      queryClient.setQueryData<Message[]>(["messages", conversationId], (current = []) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setBody(text);
      toast.error("Message not sent. Please try again.");
      setSending(false);
      return;
    }

    queryClient.setQueryData<Message[]>(["messages", conversationId], (current = []) => [
      ...current.filter((message) => message.id !== optimisticId && message.id !== data.id),
      data as Message,
    ]);
    await supabase
      .from("conversations")
      .update({ last_message: text, last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
    setSending(false);
    inputRef.current?.focus({ preventScroll: true });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void requestReply();
  }

  async function requestReply() {
    setTyping(true);
    try {
      const { data, error: replyError } = await supabase.functions.invoke("ai-reply", {
        body: { conversationId },
      });
      if (replyError) throw replyError;
      if (data?.error) throw new Error(data.error);
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // Human conversations do not require an automatic response.
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={closeRoom} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ProfileAvatar url={other?.avatar_url} emoji={other?.avatar_emoji} name={other?.display_name} className="h-10 w-10" fallbackClassName="text-lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{other?.display_name ?? "Goan"}</p>
          <p className="truncate text-xs text-muted-foreground">{typing ? "typing…" : other?.area ?? "Goa Social"}</p>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {isLoading && (
          <div className="flex h-full items-center justify-center" aria-label="Opening conversation">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && !isLoading && (
          <div className="mx-auto mt-12 max-w-xs text-center">
            <p className="font-semibold text-foreground">The conversation is taking longer than expected.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Try again
            </button>
          </div>
        )}
        {!isLoading && !error && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <ProfileAvatar url={other?.avatar_url} emoji={other?.avatar_emoji} name={other?.display_name} className="mx-auto h-16 w-16" />
            <p className="mt-3 font-semibold text-foreground">Start a conversation</p>
            <p className="mt-1 text-sm text-muted-foreground">Say hello to {other?.display_name ?? "your new connection"}.</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === user?.id;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-foreground shadow-soft"}`}>
                {message.body}
              </div>
            </div>
          );
        })}
        {typing && <div className="w-fit rounded-2xl rounded-bl-sm bg-card px-4 py-2 text-sm text-muted-foreground shadow-soft">typing…</div>}
      </div>

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3">
        <input ref={inputRef} autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder={isLoading ? "You can start typing…" : "Message…"} aria-label="Message" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-3 text-[16px] outline-none focus:border-primary" />
        <button type="submit" disabled={sending || isLoading || !!error || !body.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}