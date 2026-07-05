import { cookies } from "next/headers";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";

export async function POST(request: Request) {
  const { code } = await request.json();
  const expected = process.env.ACCESS_CODE;
  if (!expected || code !== expected) {
    return Response.json({ error: "アクセスコードが違います" }, { status: 401 });
  }
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, await authTokenFor(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return Response.json({ ok: true });
}
