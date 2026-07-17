## Goal

Review Goa Social apart from the demo/fake-profile topic, fix obvious product/UX issues, and improve YouTube Shorts speed as much as embedded YouTube allows, plus use extra tricks to increase the speed.

## Important reality about YouTube Shorts

Embedded YouTube videos cannot load exactly as fast as YouTube’s own app/site because YouTube controls the iframe player, network buffering, autoplay rules, and sound policy. Browsers also block autoplay with audio until the user taps once. I can still make it feel much faster by preloading earlier, keeping players mounted, improving the viewport, and making the first tap enable sound cleanly, what I will do is any tap on the screen enables sound rather than a fixed button to tap.

## What I found from the current code

- The home page fetches `/videos.json` after React mounts, then mounts only the first few YouTube iframe players.
- The Shorts feed currently creates YouTube iframe players lazily through the iframe API and keeps a preload window around the active short.
- Audio starts muted by design, which is required for browser autoplay; it needs a user gesture to unmute.
- The Shorts area is inside the normal app layout, below the sticky header and event banner, which can make the feed feel less like a native full-screen Shorts experience.
- Several pages are functional but still have rough edges: search fields that do not filter chats, profile menu items that are visual-only, business cards without real image handling, and image/avatar usage that can be improved.

## Plan

### 1. Full-site audit pass

- Check the main public and signed-in routes: `/`, `/explore`, `/business`, `/auth`, `/chats`, `/profile`, and legal pages.
- Look for layout overlap, broken images, dead buttons, slow network calls, missing loading states, and mobile viewport issues.
- Fix only the issues that are visible and useful for the current site; avoid adding unrelated features.
- Make sure latest shorts video are Fetched from channel

### 2. Make Shorts feel much faster

- Move video loading earlier by adding YouTube/thumbnail preconnects and DNS hints in the route head.
- Preload the first few thumbnails immediately instead of waiting for normal image discovery.
- Mount/warm the first 5 shorts during the splash screen, not only after the user sees the feed.
- Keep iframe/player instances stable so scrolling does not recreate them.
- Track player readiness and only show the thumbnail/spinner overlay until the active video is actually ready.
- Improve active-video detection so scrolling down activates the lower short and scrolling up activates the upper short correctly.
- Pause far-away players to reduce memory/network pressure, while keeping nearby players warm.
- Persist the user’s sound choice for the session after the first tap, then apply it immediately to the active and nearby players.
- Add a clear “Tap for sound” behavior that works reliably, while respecting browser autoplay restrictions.

### 3. Fix Shorts visual layout

- Rework the Shorts feed to use a cleaner phone-like full-screen frame that fits between the header and bottom nav on mobile.
- Ensure controls do not cover each other: sound button, tap-for-sound pill, channel area, like/comment/share stack, and bottom nav.
- Use a consistent aspect ratio and object-fit behavior so thumbnails and iframes do not show awkward black gaps more than necessary.
- Add a lightweight loading state for the active short instead of a plain black screen.

### 4. Improve core app polish

- Make chat search actually filter conversations on the screen.
- Improve profile avatars/images where supported by existing data, falling back cleanly to emoji.
- Improve business listing cards so they do not look empty when no image exists.
- Make visual-only profile menu actions either functional or clearly remove/replace them with useful actions.
- Add better empty/error states for Explore, Business, Chats, and Profile.

### 5. Performance and reliability checks

- Run a build check after implementation.
- Use the live preview to smoke-test home scrolling, sound toggle, route navigation, auth page rendering, and legal pages.
- Check console/network signals for obvious errors after the changes.

## Recommendation for the future

For true TikTok/YouTube-level instant playback, the best long-term setup is to store short videos as optimized MP4/HLS files in your app storage/CDN and play them with the native HTML video element. Embedded YouTube will always be slower and less controllable than self-hosted optimized video.