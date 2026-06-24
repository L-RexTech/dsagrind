/**
 * Startup script for Replit:
 * 1. Starts the HTTP server immediately on port 5000 (landing page / static files)
 * 2. Runs the build script in the background to generate the static Expo bundle
 * 3. Once the build finishes the server will serve the updated manifests
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "5000", 10);
const STATIC_ROOT = path.resolve(__dirname, "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "server", "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "app.json"), "utf-8"));
    return appJson.expo?.name || "DSA Grind";
  } catch {
    return "DSA Grind";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res) {
  const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const appName = getAppName();
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = host;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }
    if (pathname === "/") {
      return serveLandingPage(req, res);
    }
  }

  serveStaticFile(pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Listening on port ${PORT}`);
  startBuild();
});

function startBuild() {
  console.log("[Build] Starting Expo static build in background...");

  const buildEnv = {
    ...process.env,
  };

  const build = spawn("node", ["scripts/build.js"], {
    stdio: "inherit",
    cwd: __dirname,
    env: buildEnv,
  });

  build.on("exit", (code) => {
    if (code === 0) {
      console.log("[Build] Complete! The landing page now has an updated bundle.");
    } else {
      console.error(`[Build] Failed with exit code ${code}. Server continues serving.`);
    }
  });

  build.on("error", (err) => {
    console.error("[Build] Error:", err.message);
  });
}
