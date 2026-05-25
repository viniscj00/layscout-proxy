const http  = require("http");
const https = require("https");

/* No Render a porta vem da variável de ambiente PORT */
const PORT     = process.env.PORT || 3001;
const API_HOST = "api.football-data-api.com";

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  /* ── Rota Image Proxy ───────────────────────────────────────── */
  if (req.url.startsWith("/img-proxy")) {
    const params = new URL("http://localhost" + req.url).searchParams;
    const rawUrl = params.get("url");
    const apiKey = params.get("key") || "";
    if (!rawUrl) { res.writeHead(400); res.end("missing url"); return; }

    let finalUrl = rawUrl;
    try {
      const u = new URL(rawUrl);
      if (apiKey) u.searchParams.set("key", apiKey);
      finalUrl = u.toString();
    } catch(e) {}

    const parsed = new URL(finalUrl);
    const imgOptions = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer":    "https://footystats.org/",
        "Origin":     "https://footystats.org",
        "Accept":     "image/webp,image/png,image/*,*/*;q=0.8",
      },
    };

    const imgProxy = https.request(imgOptions, (imgRes) => {
      const ct = imgRes.headers["content-type"] || "image/png";
      res.writeHead(imgRes.statusCode, {
        "Content-Type":                ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "public, max-age=86400",
      });
      imgRes.pipe(res);
    });
    imgProxy.on("error", (e) => { res.writeHead(502); res.end(""); });
    imgProxy.end();
    return;
  }

  /* ── Rota FootyStats (todas as demais) ─────────────────────── */
  let path = req.url.replace(/^\/api/, "");

  if (path.startsWith("/lastx")) {
    if (!path.includes("num=")) {
      path += (path.includes("?") ? "&" : "?") + "num=50";
    }
  }

  console.log(`[proxy] GET https://${API_HOST}${path}`);

  const options = {
    hostname: API_HOST,
    path:     path,
    method:   "GET",
    headers:  { "Accept": "application/json" },
  };

  const proxy = https.request(options, (apiRes) => {
    res.writeHead(apiRes.statusCode, {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    apiRes.pipe(res);
  });

  proxy.on("error", (e) => {
    console.error("[proxy] Erro:", e.message);
    res.writeHead(502);
    res.end(JSON.stringify({ success: false, message: e.message }));
  });

  proxy.end();
});

server.listen(PORT, () => {
  console.log(`✅ Proxy rodando na porta ${PORT}`);
  console.log(`   FootyStats → https://${API_HOST}`);
});
