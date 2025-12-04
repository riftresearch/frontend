const BASE = "https://ookzpviwfhzfarouusah.supabase.co/functions/v1/chats";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Result type for operations that can fail without throwing
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Normalize address to lowercase before sending
const addr = (a: string) => a.trim().toLowerCase();

// Common headers for all requests
const getHeaders = () => ({
  "content-type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
});

// Admin headers - uses anon key for Supabase + admin secret for edge function
const getAdminHeaders = (adminPassword: string) => ({
  "content-type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "x-admin-secret": adminPassword, // the actual admin auth
});

export async function createChat(address: string, meta: any = {}) {
  const r = await fetch(`${BASE}/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ address: addr(address), meta }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).id as string;
}

export async function listChats(address: string): Promise<Result<ChatThread[]>> {
  const r = await fetch(`${BASE}/list?address=${encodeURIComponent(addr(address))}`, {
    headers: getHeaders(),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  return { ok: true, data: await r.json() };
}

export async function getThread(chatId: string, address: string) {
  const r = await fetch(`${BASE}/thread/${chatId}?address=${encodeURIComponent(addr(address))}`, {
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function appendMessage(
  chatId: string,
  address: string,
  role: "user" | "admin",
  message: string
) {
  const r = await fetch(`${BASE}/append`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ chat_id: chatId, address: addr(address), role, message }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function markRead(chatId: string, address: string) {
  const r = await fetch(`${BASE}/mark-read`, {
    method: "POST",
    headers: getHeaders(), // anon key headers
    body: JSON.stringify({ chat_id: chatId, address: addr(address) }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json(); // { ok: true, last_read_at: ... }
}

export interface ChatThread {
  id: string;
  meta: any;
  last_message_at: string;
  user_eth_address: string;
  created_at?: string;
  updated_at?: string;
  last_read_at?: string;
  last_admin_msg_at?: string;
  user_unread_count?: number;
  has_unread?: boolean;
  messages: Array<{
    role: "user" | "admin";
    message: string;
    ts: string;
  }>;
}

// ============================================================================
// ADMIN ENDPOINTS (require admin password)
// ============================================================================

export async function listAllChats(adminPassword: string): Promise<ChatThread[]> {
  const headers = getAdminHeaders(adminPassword) as any;
  console.log("[CHAT CLIENT] listAllChats - sending request with headers:", {
    hasApiKey: !!headers.apikey,
    hasAuth: !!headers.authorization,
    hasAdminSecret: !!headers["x-admin-secret"],
    adminSecretLength: headers["x-admin-secret"]?.length || 0,
  });
  console.log("[CHAT CLIENT] Request URL:", `${BASE}/admin/list`);

  const r = await fetch(`${BASE}/admin/list`, {
    headers,
  });

  console.log("[CHAT CLIENT] Response status:", r.status);
  console.log("[CHAT CLIENT] Response headers:", Object.fromEntries(r.headers.entries()));

  if (!r.ok) {
    const errorText = await r.text();
    console.log("[CHAT CLIENT] Error response body:", errorText);
    throw new Error(errorText);
  }
  return await r.json();
}

export async function getThreadAsAdmin(chatId: string, adminPassword: string): Promise<ChatThread> {
  const r = await fetch(`${BASE}/admin/thread/${chatId}`, {
    headers: getAdminHeaders(adminPassword),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

export async function appendMessageAsAdmin(
  chatId: string,
  userAddress: string,
  message: string,
  adminPassword: string
) {
  const r = await fetch(`${BASE}/append`, {
    method: "POST",
    headers: getAdminHeaders(adminPassword),
    body: JSON.stringify({ chat_id: chatId, address: addr(userAddress), role: "admin", message }),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}
