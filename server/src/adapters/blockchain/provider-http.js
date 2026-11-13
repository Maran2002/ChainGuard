const timeoutMs = 12_000;

export async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error("Provider returned an RPC error");
  return payload;
}

export async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

export function errorResult() {
  return { providerStatus: "UNAVAILABLE", data: null, coverage: { complete: false, fresh: false }, error: "PROVIDER_REQUEST_FAILED" };
}
