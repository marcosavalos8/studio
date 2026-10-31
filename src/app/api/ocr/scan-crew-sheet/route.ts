import { NextResponse } from "next/server";
import {
  extractWordsFromVisionResponse,
  parseCrewSheet,
} from "@/lib/ocr-crew-sheet";

// Runs Google Cloud Vision's OCR server-side so the API key never reaches
// the browser, then parses the result into crew-sheet rows. The client
// still owns fuzzy-matching names against the live employee list and all
// review/correction UI — this route only turns a photo into raw rows.
export async function POST(request: Request) {
  const apiKey = process.env.VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OCR is not configured on this server." },
      { status: 500 },
    );
  }

  let body: { image?: string };
  try {
    body = (await request.json()) as { image?: string };
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const imageBase64 = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!imageBase64) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  let visionJson: any;
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      },
    );
    visionJson = await res.json();
  } catch (err) {
    console.error("Vision API request failed:", err);
    return NextResponse.json(
      { error: "Failed to reach the OCR service." },
      { status: 502 },
    );
  }

  const visionError = visionJson?.responses?.[0]?.error ?? visionJson?.error;
  if (visionError) {
    console.error("Vision API error:", visionError);
    return NextResponse.json(
      { error: visionError.message ?? "OCR service returned an error." },
      { status: 502 },
    );
  }

  const fullTextAnnotation = visionJson?.responses?.[0]?.fullTextAnnotation;
  const words = extractWordsFromVisionResponse(fullTextAnnotation);
  const { rows, headerFound } = parseCrewSheet(words);

  return NextResponse.json({ headerFound, rows });
}
