import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import { NextResponse } from "next/server";

// ============================================================
// Arcjet configuration
// ============================================================

const aj = arcjet({
  key: process.env.ARCJET_KEY,

  rules: [
    // Security protection
    shield({
      mode: "LIVE",
    }),

    // Bot protection
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "GO_HTTP",
      ],
    }),
  ],
});

// ============================================================
// Next.js middleware
// ============================================================

const middleware = async (req) => {
  /*
   * Authentication is handled by the Rust backend.
   *
   * The Rust backend validates:
   *
   *     auth_token
   *
   * JWT cookie.
   *
   * We intentionally do NOT validate the JWT here because
   * the JWT secret belongs to the Rust backend.
   */

  return NextResponse.next();
};

// ============================================================
// Arcjet + Next.js middleware
// ============================================================

export default createMiddleware(aj, middleware);

// ============================================================
// Middleware matcher
// ============================================================

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",

    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
