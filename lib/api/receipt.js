"use server";

import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.6-flash";

const MAX_RETRIES = 3;

const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function isRetryableError(error) {
  const message =
    error?.message?.toLowerCase?.() ?? "";

  const status =
    error?.status ??
    error?.code ??
    error?.statusCode;

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  );
}

export async function scanReceipt(file) {
  try {
    // ========================================================
    // VALIDATE API KEY
    // ========================================================

    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured"
      );
    }

    // ========================================================
    // VALIDATE FILE
    // ========================================================

    if (!file) {
      throw new Error(
        "No receipt file was provided"
      );
    }

    if (!file.type) {
      throw new Error(
        "Receipt file type is missing"
      );
    }

    // ========================================================
    // READ FILE
    // ========================================================

    const arrayBuffer =
      await file.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(
        "Receipt file is empty"
      );
    }

    const base64String =
      Buffer.from(arrayBuffer).toString(
        "base64"
      );

    // ========================================================
    // PROMPT
    // ========================================================

    const prompt = `
Analyze this receipt image and extract the following information.

Return ONLY valid JSON in this exact format:

{
  "amount": number,
  "date": "ISO date string",
  "description": "string",
  "merchantName": "string",
  "category": "string"
}

Rules:

- amount must be only the numeric total amount.
- Do not include currency symbols.
- date must be a valid ISO date string.
- description should briefly describe the purchase.
- merchantName should contain the store or merchant name.
- category should be a reasonable spending category.
- If the receipt does not contain a clear amount, use 0.
- If the date cannot be determined, use an empty string.
- If the merchant name cannot be determined, use an empty string.
- If this is not a receipt, return {}.
`;

    // ========================================================
    // GEMINI REQUEST WITH RETRY
    // ========================================================

    let response = null;
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        console.log(
          `Receipt scan attempt ${attempt}/${MAX_RETRIES}`
        );

        response =
          await genAI.models.generateContent({
            model: MODEL,

            contents: [
              {
                inlineData: {
                  data: base64String,
                  mimeType: file.type,
                },
              },

              {
                text: prompt,
              },
            ],

            config: {
              responseMimeType:
                "application/json",
            },
          });

        // Request succeeded.
        break;
      } catch (error) {
        lastError = error;

        console.error(
          `Receipt scan attempt ${attempt} failed:`,
          error
        );

        // Only retry temporary errors.
        if (
          !isRetryableError(error) ||
          attempt === MAX_RETRIES
        ) {
          break;
        }

        // Exponential-ish backoff:
        // 1.5s -> 3s
        const delay =
          RETRY_DELAY_MS * attempt;

        console.log(
          `Retrying receipt scan in ${delay}ms...`
        );

        await sleep(delay);
      }
    }

    // ========================================================
    // ALL RETRIES FAILED
    // ========================================================

    if (!response) {
      const message =
        lastError?.message ?? "";

      if (isRetryableError(lastError)) {
        throw new Error(
          "Receipt scanning is temporarily unavailable. Please try again in a moment or enter the transaction manually."
        );
      }

      throw new Error(
        message ||
          "Failed to scan receipt"
      );
    }

    // ========================================================
    // READ GEMINI RESPONSE
    // ========================================================

    const text =
      response.text?.trim?.() ?? "";

    if (!text) {
      throw new Error(
        "Gemini returned an empty response"
      );
    }

    // ========================================================
    // PARSE JSON
    // ========================================================

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error(
        "Failed to parse Gemini response:",
        text
      );

      throw new Error(
        "Gemini returned an invalid JSON response"
      );
    }

    // ========================================================
    // EMPTY RESULT
    // ========================================================

    if (
      !data ||
      Object.keys(data).length === 0
    ) {
      throw new Error(
        "No receipt data could be found"
      );
    }

    // ========================================================
    // NORMALIZE AMOUNT
    // ========================================================

    const amount = Number(
      data.amount
    );

    if (Number.isNaN(amount)) {
      throw new Error(
        "Receipt amount could not be determined"
      );
    }

    // ========================================================
    // NORMALIZE DATE
    // ========================================================

    let parsedDate = null;

    if (data.date) {
      const date = new Date(
        data.date
      );

      if (!Number.isNaN(date.getTime())) {
        parsedDate = date;
      }
    }

    // ========================================================
    // RETURN NORMALIZED RESULT
    // ========================================================

    return {
      amount,

      date: parsedDate,

      description:
        data.description ?? "",

      category:
        data.category ?? "",

      merchantName:
        data.merchantName ?? "",
    };
  } catch (error) {
    console.error(
      "Error scanning receipt:",
      error
    );

    throw new Error(
      error?.message ||
        "Failed to scan receipt"
    );
  }
}