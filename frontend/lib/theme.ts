export type TenantTheme = { primary: string; warning: string; danger: string };

export function themeToCssVars(t: TenantTheme): Record<string, string> {
  return {
    "--brand-primary": t.primary,
    "--brand-warning": t.warning,
    "--brand-danger": t.danger,
  };
}
