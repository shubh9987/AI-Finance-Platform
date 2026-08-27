"use server";

import { cookies } from "next/headers";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function apiFetch(endpoint, options = {}) {
  const cookieStore = await cookies();

  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    throw new Error("Unauthorized. Please log in again.");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",

      ...(options.headers || {}),

      Authorization: `Bearer ${token}`,
    },

    cache: "no-store",
  });

  const contentType = response.headers.get("content-type");

  let data = null;

  if (contentType?.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    if (text) {
      data = text;
    }
  }

  if (!response.ok) {
    console.error(
      `API ERROR ${response.status} ${endpoint}:`,
      data
    );

    if (response.status === 401) {
      throw new Error("Unauthorized. Please log in again.");
    }

    if (response.status === 404) {
      throw new Error("Resource not found");
    }

    if (response.status === 409) {
      throw new Error(
        typeof data === "string"
          ? data
          : data?.message || "Resource already exists"
      );
    }

    if (response.status === 422) {
      throw new Error(
        typeof data === "string"
          ? data
          : data?.message ||
              data?.error ||
              "Invalid request data"
      );
    }

    throw new Error(
      typeof data === "string"
        ? data
        : data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`
    );
  }

  return data;
}