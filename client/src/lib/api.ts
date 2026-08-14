import { toast } from "sonner";

/**
 * fetch wrapper that checks res.ok and surfaces a toast on failure instead of
 * silently treating a 401/400/500 as success. Returns null on failure (after
 * showing the error) so callers can `if (!result) return;` and skip the
 * optimistic success path (toast.success, reload, clearing an input, etc).
 */
export async function apiRequest<T = unknown>(url: string, options?: RequestInit): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", ...options });
  } catch {
    toast.error("通信に失敗しました。ネットワーク接続を確認してください");
    return null;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    toast.error(typeof data.error === "string" ? data.error : "操作に失敗しました");
    return null;
  }
  if (res.status === 204) return {} as T;
  return res.json().catch(() => ({}) as T);
}
