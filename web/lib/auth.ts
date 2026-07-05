export const AUTH_COOKIE = "gbp_auth";

export async function authTokenFor(code: string): Promise<string> {
  const data = new TextEncoder().encode(`gbp-diag-web:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidAuthCookie(value: string | undefined): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code || !value) return false;
  return value === (await authTokenFor(code));
}
