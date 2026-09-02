import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock, Send, UserPlus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { computeQuota, markConversationRead } from "@/lib/chat";
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

  const { data: mutualFollow = false } = useQuery({
    queryKey: ["mutual-follow", user?.id, otherId],
    enabled: !!user && !!otherId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id, following_id")
        .or(
          `and(follower_id.eq.${user!.id},following_id.eq.${otherId}),and(follower_id.eq.${otherId},following_id.eq.${user!.id})`,
        );
      return (data ?? []).length >= 2;
    },
  });

  const quota = useMemo(
    () =>
      computeQuota(
        messages.filter((m) => m.sender_id === user?.id),
        messages.filter((m) => m.sender_id !== user?.id).length,
        mutualFollow,
      ),
    [messages, user?.id, mutualFollow],
  );

  async function followBack() {
    if (!user || !otherId) return;
    const { error: followError } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: otherId });
    if (followError && !followError.message.includes("duplicate")) return toast.error(followError.message);
    void queryClient.invalidateQueries({ queryKey: ["mutual-follow"] });
    void queryClient.invalidateQueries({ queryKey: ["following", user.id] });
    toast.success("Followed — they can now reply freely too");
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, typing]);

  // Keep the unread badge accurate.
  useEffect(() => {
    if (!conversation || !user) return;
    void markConversationRead(conversationId, conversation.user_a === user.id);
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [conversation, conversationId, user, messages.length, queryClient]);


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
      toast.error(
        insertError.message.includes("MESSAGE_LIMIT_REACHED")
          ? "You've used your messages for today. Follow each other to chat freely."
          : "Message not sent. Please try again.",
      );
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
    // A real person reads first, then starts typing — and their messages land
    // one at a time, so poll while they're composing.
    const typingTimer = window.setTimeout(() => setTyping(true), 350);
    const poll = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }, 800);

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
      window.clearTimeout(typingTimer);
      window.clearInterval(poll);
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

      {!quota.unlocked && (
        <div className="shrink-0 border-t border-border bg-secondary/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="flex-1">
              {quota.remaining > 0
                ? `${quota.remaining} intro message${quota.remaining === 1 ? "" : "s"} left. Follow each other to chat without limits.`
                : "Daily limit reached. You can send 1 more message tomorrow — or follow each other to unlock unlimited chat."}
            </p>
            <button
              type="button"
              onClick={() => void followBack()}
              className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              <UserPlus className="h-3 w-3" /> Follow
            </button>
          </div>
        </div>
      )}

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3">
        <input ref={inputRef} autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder={quota.remaining === 0 ? "Limit reached for today…" : isLoading ? "You can start typing…" : "Message…"} aria-label="Message" disabled={quota.remaining === 0} className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-3 text-[16px] outline-none focus:border-primary disabled:opacity-60" />
        <button type="submit" disabled={sending || isLoading || !!error || !body.trim() || quota.remaining === 0} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}