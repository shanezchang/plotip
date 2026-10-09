import type { BeforeSendEvent } from "@vercel/analytics";

export function analyticsAllowed(
  location: Pick<Location, "hostname" | "protocol">,
  navigator: Pick<Navigator, "doNotTrack"> & { globalPrivacyControl?: boolean },
) {
  return (
    location.hostname === "plotip.vercel.app" &&
    location.protocol === "https:" &&
    navigator.doNotTrack !== "1" &&
    navigator.globalPrivacyControl !== true
  );
}

export function sanitizeEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (
      event.type !== "pageview" ||
      url.origin !== "https://plotip.vercel.app" ||
      url.pathname !== "/"
    )
      return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.href };
  } catch {
    return null;
  }
}

if (analyticsAllowed(location, navigator)) {
  import("@vercel/analytics")
    .then(({ inject }) =>
      inject({ mode: "production", beforeSend: sanitizeEvent }),
    )
    .catch(() => {
      /* Lookup remains usable when analytics is blocked. */
    });
}
