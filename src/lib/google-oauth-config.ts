export function getGoogleOAuthConfig() {
  const clientId =
    process.env.AUTH_GOOGLE_ID?.trim() ??
    process.env.GOOGLE_CLIENT_ID?.trim() ??
    "";
  const clientSecret =
    process.env.AUTH_GOOGLE_SECRET?.trim() ??
    process.env.GOOGLE_CLIENT_SECRET?.trim() ??
    "";

  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) return false;
  if (clientId.includes("replace-with")) return false;
  if (clientSecret.includes("replace-with")) return false;
  if (!clientId.includes(".apps.googleusercontent.com")) return false;
  return true;
}
