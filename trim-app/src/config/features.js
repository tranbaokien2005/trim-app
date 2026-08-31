// Feature flags — one place to gate features on/off.
//
// PHOTO_AI_ENABLED: AI photo food logging. Currently open to everyone. To gate it behind
// premium later, replace `true` with a subscription check (e.g. read from the user/auth
// store) — the UI already keys the 📷 entry point off this flag, so nothing else changes.
export const PHOTO_AI_ENABLED = true;
