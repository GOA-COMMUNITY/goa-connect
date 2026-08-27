import { createServerFn } from "@tanstack/react-start";

export type ChannelInfo = {
  url: string;
  name: string;
  avatarUrl: string | null;
  subscribers: string | null;
  description: string | null;
  latestShorts: number;
  ok: boolean;
};

function normalise(raw: string) {
  let url = raw.trim().replace(/[<>"']/g, "");
  if (!/^https?:/i.test(url)) {
    url = url.startsWith("@")
      ? `https://www.youtube.com/${url}`
      : `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
  }
  return url.split("?")[0].replace(/\/(shorts|videos|featured|streams)\/?$/i, "").replace(/\/$/, "");
}

function pick(html: string, re: RegExp) {
  const m = html.match(re);
  return m?.[1] ? m[1].replace(/\\u0026/g, "&").trim() : null;
}

/** Fetch public details for a YouTube channel so the admin can confirm the link. */
export const getChannelInfo = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<ChannelInfo> => {
    const base = normalise(data.url);
    const fallbackName = (base.match(/@([^/]+)/)?.[1] ?? base.split("/").filter(Boolean).pop() ?? "Channel")
      .replace(/[-_.]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    try {
      const res = await fetch(`${base}/shorts`, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) throw new Error(String(res.status));
      const html = await res.text();

      const name =
        pick(html, /<meta property="og:title" content="([^"]+)"/) ??
        pick(html, /"channelMetadataRenderer":\{"title":"([^"]+)"/) ??
        fallbackName;
      const avatarUrl =
        pick(html, /<meta property="og:image" content="([^"]+)"/) ??
        pick(html, /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
      const subscribers =
        pick(html, /"subscriberCountText":\{"accessibility".{0,120}?"simpleText":"([^"]+)"/) ??
        pick(html, /"([\d.,]+[KMB]? subscribers)"/);
      const description =
        pick(html, /<meta property="og:description" content="([^"]*)"/) ?? null;
      const latestShorts = new Set(html.match(/"videoId":"[\w-]{11}"/g) ?? []).size;

      return { url: `${base}/shorts`, name, avatarUrl, subscribers, description, latestShorts, ok: true };
    } catch {
      return {
        url: `${base}/shorts`,
        name: fallbackName,
        avatarUrl: null,
        subscribers: null,
        description: null,
        latestShorts: 0,
        ok: false,
      };
    }
  });
