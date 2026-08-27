import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(
    new URL(
      "/sign-in",
      process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000"
    )
  );

  response.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });

  return response;
}