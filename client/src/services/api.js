const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

async function apiEnvelope(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error("ChainGuard API is unavailable. Start the server and try again.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "The request could not be completed.");
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function apiRequest(path, options = {}) {
  const payload = await apiEnvelope(path, options);
  return payload?.data;
}

export async function apiRequestWithMeta(path, options = {}) {
  return apiEnvelope(path, options);
}

export function registerAccount(values) {
  return apiRequest("/auth/register", { method: "POST", body: JSON.stringify(values) });
}

export function loginAccount(values) {
  return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(values) });
}

export function getCurrentUser() {
  return apiRequest("/auth/me").catch(async (error) => {
    if (error.status !== 401) throw error;
    await refreshSession();
    return apiRequest("/auth/me");
  });
}

export function refreshSession() {
  return apiRequest("/auth/refresh", { method: "POST" });
}

export function logoutAccount() {
  return apiRequest("/auth/logout", { method: "POST" });
}

export function createScreening(values) {
  return apiRequest("/screenings", { method: "POST", body: JSON.stringify(values) });
}

export function getIntelligencePage(query) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  return apiRequestWithMeta(`/intelligence?${search.toString()}`);
}

export function getIntelligenceRecord(id) {
  return apiRequest(`/intelligence/${encodeURIComponent(id)}`);
}
