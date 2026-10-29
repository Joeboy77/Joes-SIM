/** Theme names, matching the `[data-theme]` blocks in styles/tokens.css. */
export const THEMES = ["light", "dark", "high-contrast"] as const;
export type ThemeName = (typeof THEMES)[number];
