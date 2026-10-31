/**
 * The site's public address, used for share-link preview cards and the sitemap. Set SITE_URL
 * when deploying (for example https://joes-sim.example.org); it defaults to localhost.
 */
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "Joe's SIM";
