async function authRequest(endpoint, data) {
  const response = await fetch(endpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(data),
  });

  const contentType = response.headers.get("content-type");

  let responseData = null;

  if (contentType?.includes("application/json")) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    throw new Error(
      typeof responseData === "string"
        ? responseData
        : responseData?.message ||
            responseData?.error ||
            "Authentication failed"
    );
  }

  return responseData;
}

export async function loginUser(data) {
  return authRequest("/api/auth/login", data);
}

export async function registerUser(data) {
  return authRequest("/api/auth/register", data);
}