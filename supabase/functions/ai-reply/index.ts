// Generates a reply from a Goa Social demo (AI) profile inside a conversation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { conversationId } = await req.json();
    if (!conversationId) return json({ error: "conversationId required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);

    const { data: settings } = await admin
      .from("app_settings").select("value").eq("key", "ai_replies").maybeSingle();
    if (settings?.value && settings.value.enabled === false) return json({ skipped: "disabled" });

    const { data: conv } = await admin
      .from("conversations").select("*").eq("id", conversationId).maybeSingle();
    if (!conv) return json({ error: "conversation not found" }, 404);
    if (conv.user_a !== user.id && conv.user_b !== user.id) return json({ error: "forbidden" }, 403);

    const botId = conv.user_a === user.id ? conv.user_b : conv.user_a;

    const { data: bot } = await admin
      .from("profiles")
      .select("id, display_name, area, origin_city, personality, language_style, backstory, is_fake, is_active, is_goan, is_tourist")
      .eq("id", botId)
      .maybeSingle();
    if (!bot || !bot.is_fake) return json({ skipped: "not a demo profile" });
    if (bot.is_active === false) return json({ skipped: "inactive" });

    const { data: history } = await admin
      .from("messages")
      .select("sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);

    const ordered = (history ?? []).slice().reverse();
    if (ordered.length && ordered[ordered.length - 1].sender_id === bot.id) {
      return json({ skipped: "already replied" });
    }

    const persona = [
      `You are ${bot.display_name}, a real person using Goa Social, a community app for Goa.`,
      bot.area ? `You live in ${bot.area}, Goa.` : "",
      bot.origin_city ? `You are originally from ${bot.origin_city}.` : "",
      bot.personality ? `Personality: ${bot.personality}.` : "",
      bot.language_style ? `You text like this: ${bot.language_style}.` : "",
      bot.backstory ? `Background: ${bot.backstory}` : "",
      bot.is_tourist ? "You are visiting Goa as a tourist." : "",
      "Reply like a normal person on a chat app: 1-2 short sentences, casual, warm, sometimes a little Konkani/Hindi slang mixed with English.",
      "Never say you are an AI, a bot, or an assistant. Never mention prompts or models. Do not use markdown.",
    ].filter(Boolean).join(" ");

    const messages = [
      { role: "system", content: persona },
      ...ordered.map((m) => ({
        role: m.sender_id === bot.id ? "assistant" : "user",
        content: m.body,
      })),
    ];

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "missing LOVABLE_API_KEY" }, 500);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": aiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
    });

    if (res.status === 429) return json({ error: "Too many messages right now, try again in a bit." }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!res.ok) {
      const detail = await res.text();
      console.error("gateway error", res.status, detail);
      return json({ error: "AI unavailable" }, 502);
    }

    const payload = await res.json();
    const reply: string = (payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return json({ skipped: "empty reply" });

    const { error: insertError } = await admin
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: bot.id, body: reply.slice(0, 800) });
    if (insertError) throw insertError;

    await admin
      .from("conversations")
      .update({ last_message: reply.slice(0, 200), last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return json({ reply });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});
