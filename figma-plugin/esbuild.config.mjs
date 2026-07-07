import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Read public build-time config from parent project's .env (publishable keys + URLs, not secrets).
// All four values are safe to bake into the plugin bundle:
//  - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY: identical to what the web app ships.
//  - VITE_APP_URL: public web app base URL (default https://qualia-ux.com).
//  - VITE_POSTHOG_KEY / VITE_POSTHOG_HOST: public PostHog project key + ingest host.
// Falls back to process.env so CI / non-Soba builds work without a local .env.
let posthogKey   = process.env.VITE_POSTHOG_KEY ?? "";
let posthogHost  = process.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com";
let supabaseUrl  = process.env.VITE_SUPABASE_URL ?? "";
let supabaseAnon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
let appUrl       = process.env.VITE_APP_URL ?? "https://qualia-ux.com";
// Try both `.env.local` (developer override, gitignored) and `.env` (defaults),
// in that order. First match wins per variable.
const envDir = dirname(fileURLToPath(import.meta.url));
const candidates = ["../.env.local", "../.env"];
let envContent = "";
for (const rel of candidates) {
  try {
    envContent += "\n" + readFileSync(join(envDir, rel), "utf-8");
  } catch { /* file not present — keep going */ }
}
const pick = (name) => {
  const m = envContent.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) return null;
  let val = m[1].trim();
  // Strip surrounding quotes per dotenv convention. Without this, an env
  // value written as `VITE_X="foo"` ends up as `"foo"` (literal quote
  // chars in the string), which then gets JSON.stringify'd into `"\"foo\""`
  // — breaks downstream URL parsing.
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
};
posthogKey   = pick("VITE_POSTHOG_KEY")              ?? posthogKey;
posthogHost  = pick("VITE_POSTHOG_HOST")             ?? posthogHost;
supabaseUrl  = pick("VITE_SUPABASE_URL")             ?? supabaseUrl;
supabaseAnon = pick("VITE_SUPABASE_PUBLISHABLE_KEY") ?? supabaseAnon;
appUrl       = pick("VITE_APP_URL")                  ?? appUrl;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "[figma-plugin/esbuild] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
    "Set them in the parent .env or as environment variables before building the plugin.",
  );
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

async function buildCSS() {
  const cssIn = readFileSync(join(__dirname, "src/ui/plugin.css"), "utf-8");
  const result = await postcss([
    tailwindcss(join(__dirname, "tailwind.config.js")),
    autoprefixer,
  ]).process(cssIn, { from: join(__dirname, "src/ui/plugin.css") });
  return result.css;
}

async function buildUI() {
  const uiEntry = join(__dirname, "src/ui/index.html");
  const html = readFileSync(uiEntry, "utf-8");
  const scriptMatch = html.match(/<script\s+type="module"\s+src="([^"]+)"/);
  if (!scriptMatch) throw new Error("index.html must have <script type=\"module\" src=\"...\">");
  const scriptSrc = scriptMatch[1];
  const scriptPath = join(__dirname, "src/ui", scriptSrc);

  await esbuild.build({
    entryPoints: [scriptPath],
    bundle: true,
    outfile: join(__dirname, "dist/ui.js"),
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: !isWatch,
    sourcemap: isWatch,
    logLevel: "info",
    loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
    jsx: "automatic",
    define: {
      __POSTHOG_KEY__:   JSON.stringify(posthogKey),
      __POSTHOG_HOST__:  JSON.stringify(posthogHost),
      __SUPABASE_URL__:  JSON.stringify(supabaseUrl),
      __SUPABASE_ANON__: JSON.stringify(supabaseAnon),
      __APP_URL__:       JSON.stringify(appUrl),
    },
  });

  const compiledCss = await buildCSS();
  const safeCss = compiledCss.replace(/<\/style/gi, "<\\/style");
  const uiJs = readFileSync(join(__dirname, "dist/ui.js"), "utf-8");
  const safeJs = uiJs.replace(/<\/script/gi, "<\\/script");
  const outHtml = html
    .replace("</head>", `<style>${safeCss}</style></head>`)
    .replace(
      /<script\s+type="module"\s+src="[^"]+"><\/script>/,
      () => "<script>" + safeJs + "</script>"
    );
  writeFileSync(join(__dirname, "dist/ui.html"), outHtml);
}

async function build() {
  await buildUI();
  const uiHtmlPath = join(__dirname, "dist/ui.html");
  const uiHtml = readFileSync(uiHtmlPath, "utf-8");

  const htmlInjectPlugin = {
    name: "html-inject",
    setup(build) {
      build.onResolve({ filter: /^virtual:html$/ }, () => ({ path: "virtual:html", namespace: "html" }));
      build.onLoad({ filter: /.*/, namespace: "html" }, () => ({
        contents: "export default " + JSON.stringify(uiHtml),
        loader: "js",
      }));
    },
  };

  await esbuild.build({
    entryPoints: [join(__dirname, "src/code.ts")],
    bundle: true,
    outfile: join(__dirname, "dist/code.js"),
    format: "iife",
    platform: "browser",
    target: "es2015",
    minify: !isWatch,
    sourcemap: isWatch,
    logLevel: "info",
    plugins: [htmlInjectPlugin],
  });
  console.log("Plugin build done: dist/code.js, dist/ui.html");
}

if (isWatch) {
  const ctx = await esbuild.context({
    entryPoints: [join(__dirname, "src/code.ts")],
    bundle: true,
    outfile: join(__dirname, "dist/code.js"),
    format: "iife",
    platform: "browser",
    target: "es2015",
    sourcemap: true,
    logLevel: "info",
  });
  await ctx.watch();
  console.log("Watching code.ts...");
  build().catch(console.error);
  const scriptMatch = readFileSync(join(__dirname, "src/ui/index.html"), "utf-8").match(/<script\s+type="module"\s+src="([^"]+)"/);
  const scriptPath = join(__dirname, "src/ui", scriptMatch[1]);
  const uiCtx = await esbuild.context({
    entryPoints: [scriptPath],
    bundle: true,
    outfile: join(__dirname, "dist/ui.js"),
    format: "iife",
    platform: "browser",
    target: "es2020",
    sourcemap: true,
    logLevel: "info",
    loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
    jsx: "automatic",
    define: {
      __POSTHOG_KEY__:   JSON.stringify(posthogKey),
      __POSTHOG_HOST__:  JSON.stringify(posthogHost),
      __SUPABASE_URL__:  JSON.stringify(supabaseUrl),
      __SUPABASE_ANON__: JSON.stringify(supabaseAnon),
      __APP_URL__:       JSON.stringify(appUrl),
    },
  });
  await uiCtx.watch();
  console.log("Watching UI...");
} else {
  build().catch(() => process.exit(1));
}
