export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

export default async function handler(req, res) {
  // Next can pass the public URL or the rewritten destination to the function.
  req.url = req.url
    .replace(/^\/api\/_express\/v1(?=[/?]|$)/, "/api/v1")
    .replace(/^\/api\/(?:_express\/)?health(?=[/?]|$)/, "/health");

  // Let Express parse the original URL and cookies and own the response helpers.
  delete req.query;
  delete req.cookies;
  for (const method of ["status", "send", "json", "redirect"]) delete res[method];

  const [{ default: app }, { default: connectDatabase }] = await Promise.all([
    import("../../../server/app.js"),
    import("../../../server/config/database.js"),
  ]);

  const path = req.url.split("?", 1)[0];
  const isHealth = path === "/health" || path === "/health/";
  const isReadiness = path === "/health/ready" || path === "/health/ready/";
  if (!isHealth && !(await connectDatabase()) && !isReadiness) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "The database is temporarily unavailable" },
    }));
    return;
  }

  app(req, res);
}
