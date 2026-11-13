function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

const [clientArgument, apiArgument] = process.argv.slice(2);
if (!clientArgument || !apiArgument) {
  console.error("Usage: npm run security:probe -- <client-https-url> <api-https-base-url>");
  process.exitCode = 2;
} else {
  const clientUrl = new URL(clientArgument);
  const apiUrl = new URL(apiArgument);
  if (clientUrl.protocol !== "https:" || apiUrl.protocol !== "https:") fail("Both production URLs must use HTTPS");

  try {
    const pageResponse = await fetch(clientUrl, { redirect: "manual", cache: "no-store" });
    const csp = pageResponse.headers.get("content-security-policy") || "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    const page = await pageResponse.text();
    const headerChecks = [
      ["X-Content-Type-Options", "nosniff"],
      ["X-Frame-Options", "DENY"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
    ];
    if (!pageResponse.ok) fail(`Client returned HTTP ${pageResponse.status}`);
    for (const [header, expected] of headerChecks) {
      if (pageResponse.headers.get(header)?.toLowerCase() !== expected.toLowerCase()) fail(`Client ${header} header is missing or unexpected`);
    }
    if (!pageResponse.headers.get("strict-transport-security")?.includes("max-age=31536000")) fail("Client HSTS header is missing");
    if (!nonce || !csp.includes("default-src 'self'") || !csp.includes("frame-ancestors 'none'") || !csp.includes("object-src 'none'")) {
      fail("Client CSP is missing the expected nonce or restrictive directives");
    } else if (!page.includes(`nonce="${nonce}"`)) {
      fail("Client HTML contains no script with the CSP nonce");
    }
    const connectDirective = csp.split(";").find((directive) => directive.trim().startsWith("connect-src ")) || "";
    if (!connectDirective.includes(apiUrl.origin)) fail("Client CSP connect-src does not include the configured API origin");

    const allowedOrigin = clientUrl.origin;
    const logoutUrl = new URL("/api/v1/auth/logout", apiUrl);
    const allowedLogout = await fetch(logoutUrl, {
      method: "POST",
      headers: { Origin: allowedOrigin },
      redirect: "manual",
    });
    if (allowedLogout.status !== 200 || allowedLogout.headers.get("access-control-allow-origin") !== allowedOrigin || allowedLogout.headers.get("access-control-allow-credentials") !== "true") {
      fail("API does not accept the configured client origin with credentialed CORS");
    }
    const clearedCookies = allowedLogout.headers.getSetCookie?.() || [];
    for (const cookieName of ["cg_access=", "cg_refresh="]) {
      const cookie = clearedCookies.find((value) => value.startsWith(cookieName));
      if (!cookie || !/httponly/i.test(cookie) || !/secure/i.test(cookie) || !/samesite=(lax|strict|none)/i.test(cookie) || !/path=\//i.test(cookie)) {
        fail(`API ${cookieName.slice(0, -1)} cookie flags could not be confirmed from logout response`);
      }
    }

    const deniedLogout = await fetch(logoutUrl, {
      method: "POST",
      headers: { Origin: "https://security-probe.invalid" },
      redirect: "manual",
    });
    if (deniedLogout.status !== 403) fail("API did not reject an unconfigured origin");

    const originlessLogout = await fetch(logoutUrl, {
      method: "POST",
      headers: { Cookie: "cg_access=probe; cg_refresh=probe" },
      redirect: "manual",
    });
    if (originlessLogout.status !== 403) fail("API did not reject cookie-backed mutation without origin context");

    if (!process.exitCode) console.log("PASS production client headers/CSP nonce, API credentialed CORS, cookie flags, and mutation-origin checks");
  } catch (error) {
    fail(`Probe could not complete (${error.name})`);
  }
}
