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
