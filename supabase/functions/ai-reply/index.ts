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

    const fp = fingerprint(bot.id);
    const turn = ordered.filter((m) => m.sender_id === bot.id).length;

    const persona = [
      `You are ${bot.display_name}, a real person using Goa Social, a community app for Goa.`,
      bot.area ? `You live in ${bot.area}, Goa.` : "",
      bot.origin_city ? `You are originally from ${bot.origin_city}.` : "",
      bot.personality ? `Personality: ${bot.personality}.` : "",
      bot.language_style ? `You text like this: ${bot.language_style}.` : "",
      bot.backstory ? `Background: ${bot.backstory}` : "",
      bot.is_tourist ? "You are visiting Goa as a tourist." : "",
      `Your texting style: ${fp.styleNote}.`,
      `Typical reply length: ${fp.lengthNote}.`,
      turn === 0
        ? `Opening move: ${fp.openerNote}.`
        : "You are mid-conversation — do not greet again, do not reintroduce yourself.",
      "Reply like a normal person on a chat app. Never echo the other person's words back. At most one question, and not in every message.",
      "Never say you are an AI, a bot, or an assistant. Never mention prompts or models. Never use markdown, bullet points or emoji spam.",
    ].filter(Boolean).join(" ");

    const messages = [
      { role: "system", content: persona },
      ...ordered.map((m) => ({
        role: m.sender_id === bot.id ? "assistant" : "user",
        content: m.body,
      })),
    ];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    let reply = "";

    // Primary: the project's own Google Gemini key.
    if (geminiKey) {
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: persona }] },
            contents: ordered.map((m) => ({
              role: m.sender_id === bot.id ? "model" : "user",
              parts: [{ text: m.body || "..." }],
            })),
            generationConfig: {
              temperature: fp.temperature,
              topP: 0.95,
              maxOutputTokens: 160,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );
      if (gRes.ok) {
        const gPayload = await gRes.json();
        reply = (gPayload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "").trim();
      } else {
        console.error("gemini error", gRes.status, await gRes.text());
      }
    }

    // Fallback: any OpenAI-compatible gateway. Lovable's is the default, but
    // OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL override it, so this app
    // is never locked to one provider.
    const altBase = Deno.env.get("OPENAI_BASE_URL");
    const altKey = Deno.env.get("OPENAI_API_KEY");
    if (!reply && (altKey || lovableKey)) {
      const base = altKey ? (altBase ?? "https://api.openai.com/v1") : "https://ai.gateway.lovable.dev/v1";
      const model = Deno.env.get("OPENAI_MODEL") ?? (altKey ? "gpt-4o-mini" : "google/gemini-3.6-flash");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: altKey
          ? { "Content-Type": "application/json", Authorization: `Bearer ${altKey}` }
          : {
              "Content-Type": "application/json",
              "Lovable-API-Key": lovableKey!,
              "X-Lovable-AIG-SDK": "fetch",
            },
        body: JSON.stringify({ model, messages, temperature: fp.temperature }),
      });

      if (res.status === 429) return json({ error: "Too many messages right now, try again in a bit." }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
      if (!res.ok) {
        const detail = await res.text();
        console.error("gateway error", res.status, detail);
        return json({ error: "AI unavailable" }, 502);
      }
      const payload = await res.json();
      reply = (payload?.choices?.[0]?.message?.content ?? "").trim();
    }

    reply = humanise(reply, fp);
    if (!reply) return json({ skipped: "empty reply" });

    // Real people don't answer instantly. Each persona has its own habit —
    // some check their phone constantly, some reply after work, some the next
    // morning. Messages are written now but stamped for later; members simply
    // cannot see them until that moment arrives.
    const parts = splitParts(reply, fp);
    const delayMs = replyDelay(fp);
    const firstAt = new Date(Date.now() + delayMs);

    let last = reply;
    let cursor = firstAt.getTime();
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) cursor += Math.round((4000 + Math.random() * 20000) * fp.pace);
      const { error: insertError } = await admin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: bot.id,
          body: part.slice(0, 800),
          created_at: new Date(cursor).toISOString(),
        });
      if (insertError) throw insertError;
      last = part;
    }

    // Only surface the preview in the chat list once the reply is actually due.
    if (delayMs < 45_000) {
      await sleep(delayMs + 400);
      await admin
        .from("conversations")
        .update({ last_message: last.slice(0, 200), last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return json({ scheduled: true, deliverInMs: delayMs, parts: parts.length });


  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});

/** Deterministic per-profile texting fingerprint — every persona types differently. */
function fingerprint(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = (n: number) => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return Math.abs(h) % n;
  };
  const styles = [
    "all lowercase, no full stops, short bursts",
    "proper sentences with correct punctuation",
    "lowercase with trailing dots... like thinking out loud",
    "clipped replies, sometimes literally one word",
    "warm and chatty, uses haha / arre / men",
    "mixes Konkani and Hindi words in naturally (kitem, borem, yaar, na re)",
    "types fast with small typos and never corects them",
    "polite and slightly formal, no slang",
    "dry and a bit sarcastic, short lines",
    "excited energy, occasional CAPS on one word",
  ];
  const lengths = [
    "usually 3-8 words",
    "one short sentence",
    "one or two short sentences",
    "sometimes one word, sometimes two sentences",
  ];
  const openers = [
    "reply casually, like you were already doing something else",
    "reply with a short hey plus one small thing about your day",
    "answer directly, no greeting at all",
    "be a bit curious and ask where they are from",
    "be low key and slightly shy",
  ];
  const emojis = ["😂", "🙂", "😅", "🌊", "🤙", "❤️", "🥲", "🔥"];
  return {
    styleNote: styles[rnd(styles.length)],
    lengthNote: lengths[rnd(lengths.length)],
    openerNote: openers[rnd(openers.length)],
    lowercase: rnd(10) < 5,
    dropPeriod: rnd(10) < 6,
    emoji: rnd(10) < 4 ? emojis[rnd(emojis.length)] : "",
    emojiChance: rnd(100) / 100,
    splitChance: rnd(60) / 100,
    typoChance: rnd(10) < 3 ? 0.18 : 0,
    pace: 0.6 + rnd(100) / 100,
    temperature: 0.85 + rnd(60) / 100,
    maxLen: 90 + rnd(150),
    delayBucket: rnd(100),
    delaySpread: rnd(100) / 100,
  };
}

type Fingerprint = ReturnType<typeof fingerprint>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long this persona takes to notice and answer a message. Habits differ per
 * profile: some are glued to their phone, most answer within the hour, a few
 * only get back that evening or the next morning.
 */
function replyDelay(fp: Fingerprint) {
  const min = 60_000;
  const jitter = 0.6 + Math.random() * 0.9;
  let ms: number;
  if (fp.delayBucket < 30) ms = (1 + fp.delaySpread * 6) * min;          // 1-7 min
  else if (fp.delayBucket < 60) ms = (8 + fp.delaySpread * 40) * min;     // 8-48 min
  else if (fp.delayBucket < 82) ms = (60 + fp.delaySpread * 180) * min;   // 1-4 h
  else if (fp.delayBucket < 95) ms = (240 + fp.delaySpread * 360) * min;  // 4-10 h
  else ms = (600 + fp.delaySpread * 900) * min;                           // 10-25 h
  ms = Math.round(ms * jitter);

  // Nobody in Goa is texting at 3am — push overnight replies to the morning.
  const istHour = (new Date(Date.now() + ms).getUTCHours() + 5.5) % 24;
  if (istHour >= 1 && istHour < 7.5) {
    ms += Math.round(((7.5 - istHour) * 60 + Math.random() * 150) * min);
  }
  return ms;
}


/** Quick-thumb typos a real person would not bother fixing. */
function typo(text: string) {
  const swaps: [RegExp, string][] = [
    [/\bthe\b/, "teh"],
    [/\bjust\b/, "jus"],
    [/\byou\b/, "u"],
    [/\bthat\b/, "tht"],
    [/\bwhat\b/, "wat"],
    [/\breally\b/, "realy"],
  ];
  const pick = swaps[Math.floor(Math.random() * swaps.length)];
  return text.replace(pick[0], pick[1]);
}

/** Strips assistant-speak, markdown and other tells so replies read like a person. */
function humanise(raw: string, fp?: Fingerprint) {
  let text = (raw ?? "").trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/[*_#>`]+/g, "");
  text = text.replace(/^\s*(assistant|bot|ai)\s*:\s*/i, "");
  // Drop any sentence that breaks character.
  text = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) =>
      !/\b(as an ai|language model|i am an ai|i'm an ai|i cannot|i can't help with|how can i (help|assist)|is there anything else|happy to help|as your assistant)\b/i.test(s),
    )
    .join(" ")
    .trim();

  // Keep it chat-length; people don't send essays on a social app.
  const limit = fp?.maxLen ?? 320;
  if (text.length > limit) {
    const cut = text.slice(0, limit);
    text = cut.slice(0, Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"), 40) + 1).trim() || cut;
  }
  text = text.replace(/\s+/g, " ").trim();

  if (fp) {
    if (fp.lowercase && Math.random() < 0.8) text = text.toLowerCase();
    if (fp.dropPeriod) text = text.replace(/\.$/, "");
    if (fp.typoChance && Math.random() < fp.typoChance) text = typo(text);
    if (fp.emoji && Math.random() < fp.emojiChance) text = `${text} ${fp.emoji}`;
  }
  return text.trim();
}

/** Occasionally breaks a reply into two quick messages, like real texting. */
function splitParts(text: string, fp?: Fingerprint): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2 && text.length > 55 && Math.random() < (fp?.splitChance ?? 0.45)) {
    const mid = Math.ceil(sentences.length / 2);
    return [sentences.slice(0, mid).join(" "), sentences.slice(mid).join(" ")];
  }
  return [text];
}
