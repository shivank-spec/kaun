import { NextResponse } from "next/server";
import { GameError } from "./rooms";

/** Wrap a route body so every error becomes a clean { error } JSON response. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof GameError ? e.status : 500;
    if (status === 500) console.error("[api]", e);
    const message = e instanceof GameError ? e.message : "The detective lost signal. Try again.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
