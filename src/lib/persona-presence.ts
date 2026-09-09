/**
 * Plausible "online / last seen" text for a community persona.
 *
 * Every profile gets its own daily rhythm derived from its id, so the same
 * person is consistently an early riser or a night owl, and the status line
 * changes through the day the way a real person's would.
 */

function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Hours (IST) this person is usually awake and on their phone. */
export function personaAwakeWindow(id: string) {
  const h = hash(id);
  const wake = 6 + (h % 5); // 6am - 10am
  const sleep = 22 + ((h >> 5) % 4); // 10pm - 1am
  return { wake, sleep };
}

function istHourNow(now = new Date()) {
  return (now.getUTCHours() + now.getUTCMinutes() / 60 + 5.5) % 24;
}

/** Short status line shown under a persona's name in chat. */
export function personaPresence(id: string | null | undefined, fallback: string, now = new Date()) {
  if (!id) return fallback;
  const h = hash(id);
  const { wake, sleep } = personaAwakeWindow(id);
  const hour = istHourNow(now);
  const awake = hour >= wake && hour < sleep;

  if (!awake) {
    const asleepFor = hour < wake ? hour + (24 - sleep) : hour - sleep;
    if (asleepFor < 1) return "last seen recently";
    return `last seen ${Math.max(1, Math.round(asleepFor))}h ago`;
  }

  // Within waking hours, cycle between online and away in a stable pattern.
  const slot = Math.floor(now.getTime() / (18 * 60 * 1000));
  const roll = (slot * 2654435761 + h) % 100;
  if (roll < 28) return "online";
  if (roll < 55) return "last seen recently";
  const mins = 5 + (roll % 55);
  return `last seen ${mins} min ago`;
}
