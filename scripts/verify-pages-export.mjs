import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "out/index.html",
  "out/404.html",
  "out/robots.txt",
  "out/sitemap.xml",
  "out/googlecc418591f1204068.html",
  "out/Himanshu-Kumar-Resume-2026.pdf",
  "out/work/loop-engineering/index.html",
  "out/work/stocklane/index.html",
  "out/work/credit-risk-explorer/index.html",
  "out/work/loop-engineering-showcase.jpeg",
  "out/work/loop-engineering-system.svg",
  "out/work/stocklane.png",
  "out/work/stocklane-order.png",
  "out/work/credit-risk-dashboard-current.png",
  "out/work/credit-risk-result.png",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
if (missingFiles.length > 0) {
  throw new Error(`GitHub Pages export is incomplete:\n${missingFiles.join("\n")}`);
}

const homeHtml = readFileSync(resolve(root, "out/index.html"), "utf8");
const sitemap = readFileSync(resolve(root, "out/sitemap.xml"), "utf8");
const robots = readFileSync(resolve(root, "out/robots.txt"), "utf8");
const googleVerification = readFileSync(resolve(root, "out/googlecc418591f1204068.html"), "utf8").trim();

if (googleVerification !== "google-site-verification: googlecc418591f1204068.html") {
  throw new Error("Google Search Console verification file contains the wrong token.");
}

for (const [label, content] of [["homepage", homeHtml], ["sitemap", sitemap], ["robots", robots]]) {
  if (content.includes("http://localhost:3000")) {
    throw new Error(`${label} still contains the localhost canonical URL.`);
  }
}

if (!homeHtml.includes("https://legend398.github.io")) {
  throw new Error("Homepage metadata does not use the production GitHub Pages URL.");
}

for (const route of ["/work/loop-engineering", "/work/stocklane", "/work/credit-risk-explorer"]) {
  if (!sitemap.includes(`https://legend398.github.io${route}`)) {
    throw new Error(`Sitemap is missing ${route}.`);
  }
}

for (const slug of ["loop-engineering", "stocklane", "credit-risk-explorer"]) {
  const caseHtml = readFileSync(resolve(root, `out/work/${slug}/index.html`), "utf8");
  for (const heading of ["Problem", "Solution", "How it works", "What I built", "Results"]) {
    if (!caseHtml.includes(`>${heading}<`)) {
      throw new Error(`${slug} is missing the ${heading} case-study section.`);
    }
  }
  if (/limitations|trade-offs|the honest edge/i.test(caseHtml)) {
    throw new Error(`${slug} still exposes removed limitations or trade-off copy.`);
  }
}

process.stdout.write("GitHub Pages export verified: homepage, 404, metadata, resume, project routes, and images are present.\n");
