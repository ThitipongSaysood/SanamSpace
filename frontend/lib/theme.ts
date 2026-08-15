/**
 * The venue's brand, as CSS custom properties.
 *
 * Every value here is editable by the venue in its own settings, so the
 * customer app re-themes from data rather than from a deploy. `secondary` and
 * `accent` used to be collected and then dropped — they are wired through now.
 */
export type TenantTheme = {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  danger: string;
};

export function themeToCssVars(t: TenantTheme): Record<string, string> {
  return {
    "--brand-primary": t.primary,
    // Older stored branding predates these two; fall back rather than render
    // an empty custom property, which would blank the element entirely.
    "--brand-secondary": t.secondary || t.primary,
    "--brand-accent": t.accent || t.warning,
    "--brand-warning": t.warning,
    "--brand-danger": t.danger,
  };
}

/**
 * A near-black with the venue's colour mixed into it.
 *
 * The first-entry loader is a dark splash screen, and it was a fixed navy for
 * every venue on the platform. Tinting rather than filling with the brand
 * colour is deliberate: the text on it is white, and a venue is free to pick
 * yellow. Mixing a little of their hue into black keeps the screen theirs and
 * keeps it readable whatever they picked.
 *
 * Bad input returns the plain near-black rather than throwing — a malformed
 * colour in someone's settings must not take the loading screen down with it.
 */
export function tintedDark(hex: string | null | undefined, amount = 0.18): string {
  const base = [7, 11, 20]; // #070B14
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return `rgb(${base.join(",")})`;

  const n = parseInt(m[1], 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mixed = rgb.map((c, i) => Math.round(base[i] + (c - base[i]) * amount));

  return `rgb(${mixed.join(",")})`;
}
