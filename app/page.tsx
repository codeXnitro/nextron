"use client";

import { useEffect, useState } from "react";

const checklist = [
  ["1", "Build your interface", "Edit app/page.tsx. Changes appear instantly in the desktop window."],
  ["2", "Add desktop powers", "Expose safe native features through electron/preload.ts."],
  ["3", "Make an installer", "Run npm run make when you are ready to share your app."],
];

export default function Home() {
  const [version, setVersion] = useState("web preview");

  useEffect(() => {
    window.desktop?.getVersion().then((value) => setVersion(`desktop v${value}`));
  }, []);

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">NEXT.JS 16 × ELECTRON</p>
        <h1>Build web apps that live on the desktop.</h1>
        <p className="lede">
          A calm starting point for your first desktop application. Use familiar React and Next.js,
          then package it as an installer when it is ready.
        </p>
        <div className="actions">
          <button onClick={() => window.desktop?.openExternal("https://nextjs.org/docs")}>Read Next.js docs ↗</button>
          <span className="status"><i /> {version}</span>
        </div>
      </section>

      <section className="steps" aria-label="Getting started">
        {checklist.map(([number, title, description]) => (
          <article key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="command-card">
        <div>
          <p className="eyebrow">YOUR DAILY COMMAND</p>
          <h2>npm run dev</h2>
          <p>Starts Next.js and opens Electron together. One command, one workflow.</p>
        </div>
        <code>npm run make</code>
      </section>
    </main>
  );
}
