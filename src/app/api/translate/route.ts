import { NextResponse } from "next/server";
import { translateText } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      target?: string;
      source?: string;
    };
    const text = typeof body.text === "string" ? body.text : "";
    const target = typeof body.target === "string" ? body.target : "";
    const source = typeof body.source === "string" ? body.source : "en";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Missing text to translate." },
        { status: 400 }
      );
    }
    if (!target.trim()) {
      return NextResponse.json(
        { error: "Missing target language." },
        { status: 400 }
      );
    }

    const result = await translateText({
      text,
      targetCode: target,
      sourceCode: source,
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Translation failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
