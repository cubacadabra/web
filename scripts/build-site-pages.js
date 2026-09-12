import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ABOUT_ROUTES, SITE, SITE_PAGES } from "../site/site-routes.js";
import { LANDSCAPE_ENTRIES, LANDSCAPE_GROUPS } from "../site/landscape-data.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(scriptDirectory);
const contentDirectory = path.join(projectDirectory, "site", "content");

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

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const indent = (value, spaces) => value
  .split("\n")
  .map((line) => line ? `${" ".repeat(spaces)}${line}` : line)
  .join("\n");

const pageUrl = (page) => `${SITE.origin}${page.path}`;

export const createSitemap = () => {
  const urls = SITE_PAGES
    .filter((page) => page.robots.startsWith("index"))
    .map((page) => `  <url><loc>${pageUrl(page)}</loc></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};

const createStructuredData = (page) => {
  if (page.schema === false) return null;

  if (page.schema === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${SITE.origin}/#website`,
          url: `${SITE.origin}/`,
          name: SITE.name,
          description: "An open-source 3D multiplayer world for creators and players.",
        },
        {
          "@type": "Organization",
          "@id": `${SITE.origin}/#organization`,
          name: SITE.name,
          url: `${SITE.origin}/`,
          logo: `${SITE.origin}/favicon.svg`,
          sameAs: ["https://github.com/cubacadabra"],
        },
        {
          "@type": "VideoGame",
          name: "cubacadabra World 01",
          url: `${SITE.origin}/`,
          description: "An open-source 3D multiplayer world you can explore in the browser.",
          gamePlatform: "Web browser",
          genre: ["Sandbox", "Multiplayer"],
        },
      ],
    };
  }

  if (page.kind === "about" && page.id === "overview") {
    return {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${pageUrl(page)}#webpage`,
      url: pageUrl(page),
      name: page.pageTitle,
      description: page.description,
      isPartOf: { "@id": `${SITE.origin}/#website` },
      about: { "@id": `${SITE.origin}/#organization` },
    };
  }

  if (page.kind === "about") {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${pageUrl(page)}#article`,
      url: pageUrl(page),
      headline: page.pageTitle,
      description: page.description,
      isPartOf: { "@id": `${SITE.origin}/about/#webpage` },
      author: {
        "@type": "Organization",
        name: SITE.name,
        url: `${SITE.origin}/`,
      },
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl(page)}#webpage`,
    url: pageUrl(page),
    name: page.pageTitle,
    description: page.description,
    isPartOf: { "@id": `${SITE.origin}/#website` },
  };
};

const renderHead = (page) => {
  const title = escapeHtml(page.pageTitle);
  const description = escapeHtml(page.description);
  const canonicalUrl = pageUrl(page);
  const imageUrl = `${SITE.origin}${SITE.ogImage}`;
  const structuredData = createStructuredData(page);
  const social = page.social === false ? "" : `
    <meta property="og:type" content="${page.ogType ?? "website"}" />
    <meta property="og:site_name" content="${SITE.name}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:type" content="${SITE.ogImageType}" />
    <meta property="og:image:width" content="${SITE.ogImageWidth}" />
    <meta property="og:image:height" content="${SITE.ogImageHeight}" />
    <meta property="og:image:alt" content="${escapeHtml(SITE.ogImageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta name="twitter:image:alt" content="${escapeHtml(SITE.ogImageAlt)}" />`;
  const structuredDataMarkup = structuredData ? `
    <script type="application/ld+json">
${indent(JSON.stringify(structuredData, null, 2).replaceAll("<", "\\u003c"), 6)}
    </script>` : "";

  return `  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${description}" />
    <meta name="author" content="${SITE.name}" />
    <meta name="robots" content="${page.robots}" />
    <meta name="theme-color" content="${page.themeColor}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />${social}${structuredDataMarkup}
    <link rel="stylesheet" href="/styles.css" />
    <title>${title}</title>
  </head>`;
};

const renderLink = ({ href, label, id }, current) => {
  const active = id === current ? ' class="is-current" aria-current="page"' : "";
  return `<a${active} href="${href}">${label}</a>`;
};

const renderHeader = (page) => {
  const variants = {
    product: {
      className: "about-topbar",
      navClass: "about-topbar-nav",
      ariaLabel: "Site navigation",
      links: [
        { id: "about", href: "/about/", label: "About" },
        { id: "developer", href: "/developer/", label: "Developer" },
        { id: "landscape", href: "/landscape/", label: "Landscape" },
        { id: "my-cube", href: "/my-cube/", label: "My Cube" },
      ],
      logout: true,
    },
    legal: {
      className: "topbar about-topbar",
      navClass: "about-nav",
      ariaLabel: "Legal pages",
      links: [
        { id: "about", href: "/about/", label: "About" },
        { id: "terms", href: "/terms/", label: "Terms" },
        { id: "privacy", href: "/privacy/", label: "Privacy" },
      ],
    },
    login: {
      className: "topbar about-topbar",
      navClass: "about-nav",
      ariaLabel: "Site pages",
      links: [
        { id: "login", href: "/login/", label: "Sign in" },
        { id: "about", href: "/about/", label: "About" },
      ],
    },
  };
  const variant = variants[page.header];
  const links = variant.links
    .map((link) => `          ${renderLink(link, page.headerCurrent)}`)
    .join("\n");
  const logout = variant.logout
    ? '\n          <button class="about-logout" type="button" data-auth-logout hidden>Sign Out</button>'
    : "";
  const workspaceSearch = page.id === "my-cube"
    ? `
  <label class="morph-topbar-search">
    <span class="sr-only">Search starter morphs</span>
    <span aria-hidden="true"></span>
    <input type="search" placeholder="Search starter morphs…" autocomplete="off" />
  </label>`
    : "";
  const mobileNavigation = page.header === "product"
    ? `
  <button class="mobile-product-nav-toggle" type="button" aria-label="Open site menu" aria-expanded="false" aria-controls="mobile-product-nav">
    <span class="mobile-product-nav-toggle-icon" aria-hidden="true"><i></i><i></i><i></i></span>
  </button>`
    : "";
  const navigationId = page.header === "product" ? ' id="mobile-product-nav"' : "";
  const navigationClass = page.header === "product"
    ? `${variant.navClass} mobile-product-nav`
    : variant.navClass;

  return `<header class="${variant.className}">
  <a class="brand" href="/" aria-label="cubacadabra home">
    <span class="brand-mark" aria-hidden="true"><span></span></span>
    <span class="brand-copy">
      <span class="brand-name">cubacadabra</span>
      <span class="brand-caption">the platform for creators, children, and parents</span>
    </span>
  </a>
${workspaceSearch}
${mobileNavigation}

  <nav${navigationId} class="${navigationClass}" aria-label="${variant.ariaLabel}">
${links}${logout}
  </nav>
</header>`;
};

const socialLinks = [
  ["https://www.youtube.com/@cubacadabra", "YouTube"],
  ["https://www.instagram.com/cubacadabra/", "Instagram"],
  ["https://www.reddit.com/r/cubacadabra/", "Reddit"],
  ["https://www.tiktok.com/@cubacadabra", "TikTok"],
  ["https://github.com/cubacadabra", "GitHub"],
  ["https://x.com/cubacadabra", "X"],
  ["https://discord.gg/KjUDhbVNDB", "Discord"],
];

const footerLinks = [
  { id: "about", href: "/about/", label: "About" },
  { id: "developer", href: "/developer/", label: "Developer" },
  { id: "landscape", href: "/landscape/", label: "Landscape" },
  { id: "download", href: "/download/", label: "Download" },
  { id: "terms", href: "/terms/", label: "Terms" },
  { id: "privacy", href: "/privacy/", label: "Privacy" },
];

const renderFooter = (page) => {
  const status = page.footerStatus
    ? '  <span class="meta-line" aria-hidden="true"></span>\n  <span>World 01 · In progress</span>\n'
    : "";
  const social = socialLinks
    .map(([href, label]) => `    <a href="${href}" target="_blank" rel="noreferrer">${label}</a>`)
    .join("\n");
  const legal = footerLinks
    .map((link) => `    ${renderLink(link, page.footerCurrent)}`)
    .join("\n");

  return `<footer class="about-footer" aria-label="cubacadabra status">
${status}  <nav class="about-social-links" aria-label="Social links">
    <span class="about-footer-label" aria-hidden="true">Follow</span>
${social}
  </nav>
  <nav class="about-legal-links" aria-label="Legal pages">
    <span class="about-footer-label" aria-hidden="true">Explore</span>
${legal}
  </nav>
</footer>`;
};

const renderAboutSidebar = (currentId) => {
  const groups = [
    ["open-source", "Open Source"],
    ["thinking", "Our thinking"],
    ["people", "The people and the work"],
  ];
  const overview = ABOUT_ROUTES[0];
  const overviewActive = currentId === overview.id
    ? ' class="is-active" aria-current="location"'
    : "";
  const groupMarkup = groups.map(([groupId, label]) => {
    const links = ABOUT_ROUTES
      .filter((route) => route.group === groupId)
      .map((route) => {
        const active = route.id === currentId
          ? ' class="is-active" aria-current="location"'
          : "";
        return `      <a${active} href="${route.path}"><span>${escapeHtml(route.title)}</span></a>`;
      })
      .join("\n");

    return `    <div class="about-menu-group${groupId === "open-source" ? " about-menu-group-open-source" : ""}">
      <p>${label}</p>
${links}
    </div>`;
  }).join("\n\n");

  return `<aside class="about-sidebar">
  <div class="about-sidebar-heading">
    <span>About cubacadabra</span>
    <span class="about-sidebar-status">Future plans</span>
  </div>

  <nav class="about-menu" aria-label="About sections">
    <a${overviewActive} href="${overview.path}">
      <span>Overview</span>
      <span class="about-menu-arrow" aria-hidden="true">↗</span>
    </a>

${groupMarkup}
  </nav>
</aside>`;
};

const renderDownloadSidebar = (currentPlatform) => {
  const iosActive = currentPlatform === "ios"
    ? ' class="is-active" aria-current="page"'
    : "";
  const androidActive = currentPlatform === "android"
    ? ' class="is-active" aria-current="page"'
    : "";

  return `<aside class="about-sidebar">
  <div class="about-sidebar-heading">
    <span>Download cubacadabra</span>
    <span class="about-sidebar-status">More platforms to come</span>
  </div>

  <nav class="about-menu download-menu" aria-label="Download platforms">
    <a${iosActive} href="/download/">
      <span>iPhone/iPad</span>
      <span class="about-menu-arrow" aria-hidden="true">↗</span>
    </a>
    <a${androidActive} href="/download/android/">
      <span>Android</span>
      <span class="about-menu-arrow" aria-hidden="true">↗</span>
    </a>
    <button type="button" disabled>MacOS Desktop</button>
    <button type="button" disabled>Windows</button>
    <button type="button" disabled>Linux</button>
  </nav>
</aside>`;
};

const renderMyCubeSidebar = () => `<aside class="about-sidebar">
  <div class="about-sidebar-heading">
    <span>My Cube</span>
    <span class="about-sidebar-status">Required to continue</span>
  </div>

  <nav class="about-menu" aria-label="My Cube sections">
    <a href="#birthday" data-section="birthday" aria-current="page"><span>Birthday</span></a>
    <a href="#morph-editor" data-section="morph-editor" hidden><span>Morph Editor</span></a>
    <a href="#cubes" data-section="cubes" hidden><span>Cubes</span></a>
    <a href="#blocked-users" data-section="blocked-users" hidden><span>Blocked Users</span></a>
    <a href="#subscription" data-section="subscription" hidden><span>Subscription</span></a>
  </nav>
</aside>`;

const renderDeveloperSidebar = () => `<aside class="about-sidebar">
  <div class="about-sidebar-heading">
    <span>Developer</span>
    <span class="about-sidebar-status">Early access</span>
  </div>

  <nav class="about-menu" aria-label="Developer sections">
    <a href="#upload" data-section="upload"><span>Upload</span></a>
    <a class="is-active" href="#pricing" data-section="pricing" aria-current="page"><span>Pricing</span></a>
    <a href="#included" data-section="included"><span>What stays free</span></a>
  </nav>
</aside>`;

const renderLandscapeSidebar = (currentId) => {
  const linkFor = (entry) => {
    const route = SITE_PAGES.find((page) => page.id === `landscape-${entry.id}`);
    if (!route) return "";
    const active = route.id === currentId ? ' class="is-active" aria-current="location"' : "";
    return `    <a${active} href="${route.path}"><span>${escapeHtml(entry.title)}</span><span class="about-menu-arrow" aria-hidden="true">↗</span></a>`;
  };
  const groups = LANDSCAPE_GROUPS.map(([groupId, label]) => {
    const links = LANDSCAPE_ENTRIES
      .filter((entry) => entry.group === groupId)
      .map(linkFor)
      .filter(Boolean)
      .join("\n");
    return `    <div class="about-menu-group">
      <p>${escapeHtml(label)}</p>
${links}
    </div>`;
  }).join("\n");

  return `<aside class="about-sidebar">
  <div class="about-sidebar-heading">
    <span>Landscape</span>
    <span class="about-sidebar-status">A candid field guide</span>
  </div>

  <nav class="about-menu landscape-menu" aria-label="Competitive landscape sections">
    <a${currentId === "landscape-overview" ? ' class="is-active" aria-current="page"' : ""} href="/landscape/">
      <span>Overview</span>
      <span class="about-menu-arrow" aria-hidden="true">↗</span>
    </a>
${groups}
  </nav>
</aside>`;
};

const renderLandscapeProfile = (page) => {
  const entry = LANDSCAPE_ENTRIES.find((candidate) => `landscape-${candidate.id}` === page.id);
  if (!entry) throw new Error(`Missing landscape entry for ${page.id}`);
  const image = entry.logo
    ? `<img class="landscape-detail-logo${entry.logo.includes("/header.jpg") || entry.logo.includes("og.jpg") ? " landscape-detail-art" : ""}" src="${escapeHtml(entry.logo)}" alt="${escapeHtml(entry.title)}" />`
    : `<div class="landscape-detail-logo landscape-detail-fallback" aria-hidden="true">${escapeHtml(entry.title.slice(0, 1))}</div>`;
  const facts = entry.facts
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  const copy = entry.copy
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");

  return `<main class="about-content developer-content landscape-content">
  <header class="landscape-detail-heading">
    <div>
      <p class="developer-kicker">Landscape / ${escapeHtml(entry.group === "core" ? "Main product comparison" : entry.group === "watchlist" ? "Emerging engine" : entry.group === "adjacent" ? "Adjacent platform" : entry.group === "transitions" ? "Shutdown / transition" : "Technical prior art")}</p>
      <h1>${escapeHtml(entry.headline)}</h1>
      <p class="developer-lede">${escapeHtml(entry.lede)}</p>
    </div>
    ${image}
  </header>
  <div class="landscape-detail-grid">
    <section class="landscape-detail-copy">
      <p class="landscape-detail-kicker">${escapeHtml(entry.kicker)}</p>
      <h2>${escapeHtml(entry.lesson)}</h2>
      ${copy}
    </section>
    <aside class="landscape-detail-aside">
      <span>Lesson for cubacadabra</span>
      <strong>${escapeHtml(entry.lesson)}</strong>
      <a href="${escapeHtml(entry.source)}" target="_blank" rel="noreferrer">${escapeHtml(entry.sourceLabel)} ↗</a>
    </aside>
  </div>
  <section class="landscape-detail-facts">${facts}</section>
</main>`;
};

const landscapeGroupLabel = (groupId) => LANDSCAPE_GROUPS.find(([id]) => id === groupId)?.[1] ?? groupId;

const renderLandscapeEntryTable = () => {
  const rows = LANDSCAPE_ENTRIES.map((entry) => {
    const logo = entry.logo
      ? `<img class="landscape-index-logo" src="${escapeHtml(entry.logo)}" alt="" />`
      : `<span class="landscape-index-fallback" aria-hidden="true">${escapeHtml(entry.title.slice(0, 1))}</span>`;
    const [factLabel, factValue] = entry.facts[0] ?? ["Status", "See profile"];
    return `      <tr>
        <th scope="row"><a class="landscape-index-project" href="${escapeHtml(entry.path)}">${logo}<span>${escapeHtml(entry.title)}</span></a></th>
        <td><span class="landscape-index-group">${escapeHtml(landscapeGroupLabel(entry.group))}</span></td>
        <td><strong>${escapeHtml(factLabel)}:</strong> ${escapeHtml(factValue)}</td>
        <td><a href="${escapeHtml(entry.source)}" target="_blank" rel="noreferrer">${escapeHtml(entry.sourceLabel)} ↗</a></td>
      </tr>`;
  }).join("\n");

  return `<section class="landscape-field-index" aria-labelledby="landscape-field-index-title">
    <div class="developer-section-heading">
      <div>
        <h2 id="landscape-field-index-title">The broader field</h2>
        <p>Direct competitors, adjacent products, transitions, and technical prior art in one scan.</p>
      </div>
      <span>${LANDSCAPE_ENTRIES.length} names tracked</span>
    </div>
    <div class="landscape-index-table-wrap" tabindex="0" aria-label="Scrollable broader competitive field">
      <table class="landscape-index-table">
        <caption>The broader cubacadabra competitive field.</caption>
        <thead><tr><th scope="col">Project</th><th scope="col">Category</th><th scope="col">Snapshot</th><th scope="col">Source</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="landscape-table-scroll-hint">Swipe horizontally to browse the full field <span aria-hidden="true">→</span></p>
  </section>`;
};

const renderScripts = (page) => [
  ...(page.externalScripts ?? []),
  ...(page.header === "product" ? ["<script type=\"module\" src=\"/site/mobile-product-nav.js\"></script>"] : []),
  ...(page.scripts ?? []).map((source) => `<script type="module" src="${source}"></script>`),
].map((script) => `    ${script}`).join("\n");

const renderDocument = (page, body) => {
  const htmlClass = page.htmlClass ? ` class="${page.htmlClass}"` : "";
  const bodyClass = page.bodyClass ? ` class="${page.bodyClass}"` : "";
  const scripts = renderScripts(page);

  return `<!doctype html>
<html lang="en"${htmlClass}>
${renderHead(page)}
  <body${bodyClass}>
    <!-- Generated by scripts/build-site-pages.js. Edit site/ sources instead. -->
${indent(body, 4)}
${scripts ? `\n${scripts}` : ""}
  </body>
</html>
`;
};

const renderAboutPage = (page, sectionsSource) => {
  const section = extractMarkedBlock(sectionsSource, `about-section:${page.id}`);
  const breadcrumb = page.id === "overview"
    ? ""
    : `<p class="about-breadcrumb about-route-breadcrumb"><span>About</span><span aria-hidden="true">/</span><span>${escapeHtml(page.title)}</span></p>\n`;
  const main = `<main class="about-content">
${indent(breadcrumb + section, 2)}
</main>`;

  return `<div class="about-shell">
${indent(renderHeader(page), 2)}

  <div class="about-layout">
${indent(renderAboutSidebar(page.id), 4)}

${indent(main, 4)}
  </div>

${indent(renderFooter(page), 2)}
</div>`;
};

const renderShellPage = (page, content) => {
  const center = page.sidebar === "download"
    ? `<div class="about-layout">
${indent(renderDownloadSidebar(page.downloadPlatform), 2)}

${indent(content, 2)}
</div>`
    : content;

  return `<div class="about-shell">
${indent(renderHeader(page), 2)}

${indent(center, 2)}

${indent(renderFooter(page), 2)}
</div>`;
};

const renderMyCubePage = (page) => `<div class="about-shell">
${indent(renderHeader(page), 2)}

  <div class="about-layout">
${indent(renderMyCubeSidebar(), 4)}

    <main class="about-content" aria-label="My Cube content"></main>
  </div>

${indent(renderFooter(page), 2)}
</div>`;

const renderDeveloperPage = (page, content) => `<div class="about-shell">
${indent(renderHeader(page), 2)}

  <div class="about-layout developer-layout">
${indent(renderDeveloperSidebar(), 4)}

${indent(content, 4)}
  </div>

${indent(renderFooter(page), 2)}
</div>`;

const renderLandscapePage = (page, content) => {
  const pageContent = page.id === "landscape-overview"
    ? content.replace("<!-- landscape-entry-table -->", renderLandscapeEntryTable())
    : content || renderLandscapeProfile(page);

  return `<div class="about-shell">
${indent(renderHeader(page), 2)}

  <div class="about-layout landscape-layout">
${indent(renderLandscapeSidebar(page.id), 4)}

${indent(pageContent, 4)}
  </div>

${indent(renderFooter(page), 2)}
</div>`;
};

const renderCubePage = (page) => `<div class="about-shell cube-route-shell">
${indent(renderHeader(page), 2)}

  <main class="cube-route-main" id="cube-page-root" aria-live="polite">
    <div class="cube-route-loading">
      <span class="cube-route-loading-mark" aria-hidden="true"></span>
      <p>Loading cube…</p>
    </div>
  </main>

${indent(renderFooter(page), 2)}
</div>`;

const outputPathForPage = (outputDirectory, page) => page.path === "/"
  ? path.join(outputDirectory, "index.html")
  : path.join(outputDirectory, page.path.slice(1), "index.html");

export const buildSitePages = async ({ outputDirectory }) => {
  if (!outputDirectory) throw new Error("An output directory is required");

  const sectionsSource = await fs.readFile(
    path.join(contentDirectory, "about-sections.html"),
    "utf8",
  );
  const contentNames = [...new Set(SITE_PAGES.map((page) => page.content).filter(Boolean))];
  const contentEntries = await Promise.all(contentNames.map(async (name) => [
    name,
    (await fs.readFile(path.join(contentDirectory, `${name}.html`), "utf8")).trim(),
  ]));
  const content = Object.fromEntries(contentEntries);

  for (const page of SITE_PAGES) {
    let body;
    if (page.kind === "about") body = renderAboutPage(page, sectionsSource);
    else if (page.kind === "shell-content") body = renderShellPage(page, content[page.content]);
    else if (page.kind === "my-cube") body = renderMyCubePage(page);
    else if (page.kind === "developer") body = renderDeveloperPage(page, content[page.content]);
    else if (page.kind === "landscape") body = renderLandscapePage(page, content[page.content]);
    else if (page.kind === "cube") body = renderCubePage(page);
    else body = content[page.content];

    const outputPath = outputPathForPage(outputDirectory, page);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, renderDocument(page, body));
  }

  await fs.writeFile(path.join(outputDirectory, "sitemap.xml"), createSitemap());
  return outputDirectory;
};

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const outputDirectory = process.env.CUBACADABRA_PAGES_DIR
    ? path.resolve(process.env.CUBACADABRA_PAGES_DIR)
    : path.join(projectDirectory, ".generated");

  buildSitePages({ outputDirectory }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
