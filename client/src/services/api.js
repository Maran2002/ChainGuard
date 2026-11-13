const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";
const currentUserCacheDurationMs = 15_000;
let currentUserCache = null;
let currentUserCacheAt = 0;
let currentUserRequest = null;
let currentUserVersion = 0;

function rememberCurrentUser(payload) {
  currentUserCache = payload;
  currentUserCacheAt = Date.now();
  return payload;
}

function clearCurrentUserCache() {
  currentUserVersion += 1;
  currentUserCache = null;
  currentUserCacheAt = 0;
  currentUserRequest = null;
}

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

export function resendEmailVerification(email) {
  return apiRequest("/auth/email/verification/resend", { method: "POST", body: JSON.stringify({ email }) });
}

export function verifyAccountEmail(token) {
  return apiRequest("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
}

export function requestPasswordReset(email) {
  return apiRequest("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
}

export function verifyPasswordResetToken(token) {
  return apiRequest("/auth/password/reset/verify", { method: "POST", body: JSON.stringify({ token }) });
}

export function resetPasswordWithToken(values) {
  return apiRequest("/auth/password/reset", { method: "POST", body: JSON.stringify(values) });
}

export function loginAccount(values) {
  return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(values) });
}

export function getCurrentUser() {
  if (currentUserCache && Date.now() - currentUserCacheAt < currentUserCacheDurationMs) {
    return Promise.resolve(currentUserCache);
  }
  if (currentUserRequest) return currentUserRequest;
  const requestVersion = currentUserVersion;
  const request = apiRequest("/auth/me").catch(async (error) => {
    if (error.status !== 401) throw error;
    await refreshSession();
    return apiRequest("/auth/me");
  }).then((payload) => {
    return requestVersion === currentUserVersion ? rememberCurrentUser(payload) : payload;
  }).finally(() => {
    if (currentUserRequest === request) currentUserRequest = null;
  });
  currentUserRequest = request;
  return request;
}

export function updateCurrentUser(values) {
  return apiRequest("/auth/me", { method: "PATCH", body: JSON.stringify(values) }).then(rememberCurrentUser);
}

export function updateUserPreferences(values) {
  return apiRequest("/auth/preferences", { method: "PATCH", body: JSON.stringify(values) }).then(rememberCurrentUser);
}

export function changeAccountPassword(values) {
  return apiRequest("/auth/password", { method: "PATCH", body: JSON.stringify(values) });
}

export function deleteOwnAccount(values) {
  return apiRequest("/auth/me", { method: "DELETE", body: JSON.stringify(values) }).then((result) => {
    clearCurrentUserCache();
    return result;
  });
}

export function refreshSession() {
  return apiRequest("/auth/refresh", { method: "POST" });
}

export function logoutAccount() {
  return apiRequest("/auth/logout", { method: "POST" }).then((result) => {
    clearCurrentUserCache();
    return result;
  });
}

export function logoutAllSessions() {
  return apiRequest("/auth/logout-all", { method: "POST" }).then((result) => {
    clearCurrentUserCache();
    return result;
  });
}

export function getAuthSessions() {
  return apiRequest("/auth/sessions");
}

export function revokeAuthSession(sessionId) {
  return apiRequest(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).then((result) => {
    if (result.current) clearCurrentUserCache();
    return result;
  });
}

export function createScreening(values) {
  return apiRequest("/screenings", { method: "POST", body: JSON.stringify(values) });
}

export function getScreeningHistory(query) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  return apiRequestWithMeta(`/screenings?${search.toString()}`);
}

export function getScreeningRecord(id) {
  return apiRequest(`/screenings/${encodeURIComponent(id)}`);
}

export function deleteScreeningRecord(id) {
  return apiRequest(`/screenings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function reinvestigateScreeningRecord(id, depth = 1) {
  return apiRequest(`/screenings/${encodeURIComponent(id)}/reinvestigate`, { method: "POST", body: JSON.stringify({ depth }) });
}

export function getScreeningGraph(id, depth = 1) {
  return apiRequest(`/screenings/${encodeURIComponent(id)}/graph?depth=${encodeURIComponent(depth)}`);
}

export function getDashboardSummary() {
  return apiRequest("/dashboard/summary");
}

export function getProviderSetup() {
  return apiRequest("/admin/providers");
}

export function getIntelligencePage(query) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  return apiRequestWithMeta(`/intelligence?${search.toString()}`);
}

export async function downloadIntelligenceCsv(query) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  let response;
  try {
    response = await fetch(`${apiBase}/intelligence/export.csv?${search.toString()}`, { credentials: "include" });
  } catch {
    throw new Error("ChainGuard API is unavailable. Start the server and try again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.error?.message || "The CSV export could not be created.");
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return { blob: await response.blob(), count: Number(response.headers.get("X-Export-Count") || 0) };
}

export function getIntelligenceRecord(id) {
  return apiRequest(`/intelligence/${encodeURIComponent(id)}`);
}

export function getIngestionSources() {
  return apiRequest("/admin/ingestion/sources");
}

export function getIngestionJobs(limit = 30) {
  return apiRequest(`/admin/ingestion/jobs?limit=${encodeURIComponent(limit)}`);
}

export function getAdminAuditLogs(limit = 30) {
  return apiRequest(`/admin/ingestion/audit-logs?limit=${encodeURIComponent(limit)}`);
}

export function getAdminUsers(query = {}) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  return apiRequestWithMeta(`/admin/users?${search.toString()}`);
}

export function updateAdminUser(userId, changes) {
  return apiRequest(`/admin/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(changes) });
}

export function getAdminIntelligence(query = {}) {
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined && value !== null));
  return apiRequestWithMeta(`/admin/intelligence?${search.toString()}`);
}

export function createAdminIntelligenceRecord(values) {
  return apiRequest("/admin/intelligence", { method: "POST", body: JSON.stringify(values) });
}

export function updateAdminIntelligenceRecord(recordId, values) {
  return apiRequest(`/admin/intelligence/${encodeURIComponent(recordId)}`, { method: "PATCH", body: JSON.stringify(values) });
}

export function runIntelligenceIngestion(sourceId, { dryRun = true } = {}) {
  return apiRequest(`/admin/ingestion/${encodeURIComponent(sourceId)}/run`, {
    method: "POST",
    body: JSON.stringify({ dryRun }),
  });
}
