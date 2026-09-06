import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ABOUT_ROUTES } from "../about/about-routes.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(scriptDirectory);
const aboutDirectory = path.join(projectDirectory, "about");
const sourcePath = path.join(aboutDirectory, "index.html");

const marker = (name, position) => `<!-- ${name}:${position} -->`;

const extractMarkedBlock = (source, name) => {
  const startMarker = marker(name, "start");
  const endMarker = marker(name, "end");
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find ${startMarker}`);

  const contentStart = start + startMarker.length;
  const end = source.indexOf(endMarker, contentStart);
  if (end === -1) throw new Error(`Could not find ${endMarker}`);

  return source.slice(contentStart, end).trim();
};

const replaceMarkedBlock = (source, name, replacement) => {
  const startMarker = marker(name, "start");
  const endMarker = marker(name, "end");
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find ${startMarker}`);

  const contentStart = start + startMarker.length;
  const end = source.indexOf(endMarker, contentStart);
  if (end === -1) throw new Error(`Could not find ${endMarker}`);

  return `${source.slice(0, start)}${replacement.trim()}${source.slice(end + endMarker.length)}`;
};

const stripSourceMarkers = (source) => source.replace(/\s*<!-- [^>]+:(?:start|end) -->/g, "");

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const indentBlock = (value, spaces) => value
  .split("\n")
  .map((line) => line ? `${" ".repeat(spaces)}${line}` : line)
  .join("\n");

const setActiveLink = (markup, routePath, activeClass, ariaCurrent) => markup.replace(/<a([^>]*)>/g, (tag, attributes) => {
  const cleanAttributes = attributes
    .replace(new RegExp(`\\sclass="${activeClass}"`, "g"), "")
    .replace(new RegExp(`\\saria-current="${ariaCurrent}"`, "g"), "");

  if (!cleanAttributes.includes(`href="${routePath}"`)) return `<a${cleanAttributes}>`;
  return `<a class="${activeClass}"${cleanAttributes} aria-current="${ariaCurrent}">`;
});

const createHead = (route) => {
  const canonicalUrl = `https://cubacadabra.com${route.path}`;
  const description = escapeHtml(route.description);
  const title = escapeHtml(route.pageTitle);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    url: canonicalUrl,
    headline: route.pageTitle,
    description: route.description,
    isPartOf: { "@id": "https://cubacadabra.com/about/#webpage" },
    author: { "@type": "Organization", name: "cubacadabra", url: "https://cubacadabra.com/" },
  }, null, 2);

  return `  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${description}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="author" content="cubacadabra" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#e8e4cd" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="cubacadabra" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="https://cubacadabra.com/og-image.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="cubacadabra World 01 — Empty baseplate" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://cubacadabra.com/og-image.png" />
    <meta name="twitter:image:alt" content="cubacadabra World 01 — Empty baseplate" />
    <script type="application/ld+json">
${structuredData}
    </script>
    <link rel="stylesheet" href="/styles.css" />
    <title>${title}</title>
  </head>`;
};

const createPage = (source, routeId, route) => {
  const header = setActiveLink(
    extractMarkedBlock(source, "about-shared:header"),
    "/about/",
    "is-current",
    "page",
  );
  const sidebar = setActiveLink(
    stripSourceMarkers(extractMarkedBlock(source, "about-shared:sidebar")),
    route.path,
    "is-active",
    "location",
  );
  const section = extractMarkedBlock(source, `about-section:${routeId}`);
  const footer = extractMarkedBlock(source, "about-shared:footer");
  const outputDirectory = path.dirname(path.join(projectDirectory, route.path.slice(1), "index.html"));
  const scriptPath = `${path.relative(outputDirectory, path.join(aboutDirectory, "about-page.js"))}`.replaceAll(path.sep, "/");

  return `<!doctype html>
<html lang="en" class="about-document">
${createHead(route)}
  <body class="about-page" data-about-route="${routeId}">
    <!-- Generated by scripts/build-about-pages.js. Edit about/index.html and about/about-routes.js. -->
    <div class="about-shell">
${indentBlock(header, 6)}

      <div class="about-layout">
${indentBlock(sidebar, 8)}

        <main class="about-content">
          <p class="about-breadcrumb about-route-breadcrumb"><span>About</span><span aria-hidden="true">/</span><span>${escapeHtml(route.title)}</span></p>
${indentBlock(section, 10)}
        </main>
      </div>

${indentBlock(footer, 6)}
    </div>

    <script type="module" src="${scriptPath}"></script>
  </body>
</html>
`;
};

const createMyCubePage = (source) => {
  const header = setActiveLink(
    extractMarkedBlock(source, "about-shared:header"),
    "/my-cube/",
    "is-current",
    "page",
  );
  const sourceSidebar = extractMarkedBlock(source, "about-shared:sidebar");
  const sidebar = replaceMarkedBlock(
    sourceSidebar,
    "about-sidebar-content",
    `
          <div class="about-sidebar-heading">
            <span>My Cube</span>
            <span class="about-sidebar-status">Required to continue</span>
          </div>

          <nav class="about-menu" aria-label="My Cube sections">
            <a href="#birthday" data-section="birthday" aria-current="page"><span>Birthday</span></a>
            <a href="#cubes" data-section="cubes" hidden><span>Cubes</span></a>
            <a href="#blocked-users" data-section="blocked-users" hidden><span>Blocked Users</span></a>
            <a href="#subscription" data-section="subscription" hidden><span>Subscription</span></a>
          </nav>
          `,
  );
  const footer = extractMarkedBlock(source, "about-shared:footer");
  const outputDirectory = path.dirname(path.join(projectDirectory, "my-cube", "index.html"));
  const scriptPath = `${path.relative(outputDirectory, path.join(projectDirectory, "my-cube", "my-cube-page.js"))}`.replaceAll(path.sep, "/");

  return `<!doctype html>
<html lang="en" class="about-document">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Your cubacadabra space." />
    <meta name="author" content="cubacadabra" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#111315" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
    <title>My Cube · cubacadabra</title>
  </head>
  <body class="about-page my-cube-page">
    <!-- Generated by scripts/build-about-pages.js. -->
    <div class="about-shell">
${indentBlock(header, 6)}

      <div class="about-layout">
${indentBlock(sidebar, 8)}

        <main class="about-content" aria-label="My Cube content"></main>
      </div>

${indentBlock(footer, 6)}
    </div>

    <script type="module" src="${scriptPath}"></script>
  </body>
</html>
`;
};

const build = async () => {
  const source = await fs.readFile(sourcePath, "utf8");

  for (const [routeId, route] of Object.entries(ABOUT_ROUTES)) {
    if (routeId === "overview") continue;

    const outputPath = path.join(projectDirectory, route.path.slice(1), "index.html");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, createPage(source, routeId, route));
  }

  const myCubeDirectory = path.join(projectDirectory, "my-cube");
  await fs.mkdir(myCubeDirectory, { recursive: true });
  await fs.writeFile(path.join(myCubeDirectory, "index.html"), createMyCubePage(source));
};

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
