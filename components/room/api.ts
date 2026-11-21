export async function post<T = { ok: true }>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network problem. Try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Something went wrong (${res.status})`);
  return data as T;
}

export interface RoomActions {
  start: (setting: string, tone: "desi" | "noir") => Promise<void>;
  vote: (targetId: string) => Promise<void>;
  again: () => Promise<void>;
}
