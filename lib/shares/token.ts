const TOKEN_RE = /^[A-Za-z0-9_-]{16,48}$/;

export function isShareToken(value: string | null | undefined): value is string {
  return !!value && TOKEN_RE.test(value);
}

export function newShareSecret(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const bin = String.fromCharCode(...bytes);
  if (typeof btoa === "function") {
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shareAppPath(token: string): string {
  return `/s/${encodeURIComponent(token)}`;
}

export function shareAppUrl(token: string): string {
  if (typeof window === "undefined") return shareAppPath(token);
  return `${window.location.origin}${shareAppPath(token)}`;
}
