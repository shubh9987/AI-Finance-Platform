import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, {
        status: response.status,
      });
    }

    const nextResponse = NextResponse.json(data);

    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      const cookieValue = setCookie
        .split(";")[0]
        .trim();

      const [name, ...valueParts] = cookieValue.split("=");

      nextResponse.cookies.set({
        name,
        value: valueParts.join("="),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return nextResponse;
  } catch (error) {
    console.error("Register route error:", error);

    return NextResponse.json(
      {
        message: "Unable to connect to authentication server",
      },
      {
        status: 500,
      }
    );
  }
}