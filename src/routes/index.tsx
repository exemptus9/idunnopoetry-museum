import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import postsAsset from "../posts.js.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "I Dunno Poetry :: Messageboard Museum" },
      {
        name: "description",
        content:
          "A reconstructed, privacy-conscious museum of the IDunnoPoetry messageboard and poetry community.",
      },
      { property: "og:title", content: "I Dunno Poetry :: Messageboard Museum" },
      {
        property: "og:description",
        content:
          "Browse the reconstructed phpBB 2.0.6 forum, 23,957 surviving public posts, recovered poetry, exhibits and the reclamation workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: "/museum.css" }],
  }),
  component: Museum,
});

async function loadScript(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Failed to load " + src);
  const code = await res.text();
  const s = document.createElement("script");
  s.textContent = code;
  document.body.appendChild(s);
}

function Museum() {
  useEffect(() => {
    const w = window as unknown as { __idpMuseumBooted?: boolean };
    if (w.__idpMuseumBooted) return;
    w.__idpMuseumBooted = true;
    document.body.classList.add("skin-subsilver");
    (async () => {
      await loadScript("/museum-config.js");
      await loadScript("/data/core.js");
      await loadScript(postsAsset.url);
      await loadScript("/data/poetry.js");
      await loadScript("/museum.js");
    })().catch((e) => console.error(e));
  }, []);

  return (
    <div className="phpbb-page">
      <a id="top"></a>
      <header className="board-header">
        <div className="brand-row">
          <a className="brand" href="#home" aria-label="I Dunno Poetry forum index">
            <span className="brand-title">I Dunno Poetry</span>
            <span className="brand-tagline">
              Submit teen poetry, poems, advice from poets, depression help, teen guy, etc.
            </span>
            <span className="museum-label">
              Messageboard Museum · reconstructed public archive
            </span>
          </a>
          <div className="skin-control">
            <label htmlFor="skinSelect">Board style:</label>
            <select id="skinSelect" aria-label="Choose historical board style" defaultValue="subsilver">
              <option value="subsilver">subSilver (default)</option>
              <option value="skyline">skyLineGrey</option>
              <option value="helius">Helius</option>
              <option value="museum">Museum modern</option>
            </select>
          </div>
        </div>
        <nav className="board-nav" aria-label="Museum navigation">
          <a href="#forums">Forum Index</a>
          <a href="#search">Search</a>
          <a href="#people">Memberlist</a>
          <a href="#poetry">Poetry</a>
          <a href="#timeline">Timeline</a>
          <a href="#exhibits">Exhibits</a>
          <a href="#reclaim">Reclaim</a>
          <a href="#about">FAQ / About</a>
        </nav>
      </header>
      <div id="notice" className="notice">
        <strong>Archive content notice:</strong> historical public posts may discuss self-harm,
        abuse, drugs, sexuality, and other difficult subjects.{" "}
        <button id="dismissNotice">Dismiss</button>
      </div>
      <main id="app" tabIndex={-1} suppressHydrationWarning />
      <footer>
        <div>
          <strong>I Dunno Poetry :: Messageboard Museum</strong>
          <br />
          Historical interface reconstructed from the surviving phpBB 2.0.6 database and sanitized
          public archive.
        </div>
        <div>
          Public archive only. No private messages, email addresses, IP addresses, credentials, or
          password material.
        </div>
      </footer>
    </div>
  );
}