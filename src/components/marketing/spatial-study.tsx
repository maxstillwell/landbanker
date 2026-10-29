"use client";

import Image from "next/image";
import { useState } from "react";
import s from "./marketing.module.css";

const studies = [
  {
    name: "Properties",
    title: "Start with the land that matters.",
    text: "Keep saved parcels and imported property boundaries in your own workspace.",
    label: "Your property boundary",
  },
  {
    name: "Research",
    title: "Give your investigation a place.",
    text: "Define a Research Area and connect it with properties and observations as your work develops.",
    label: "Your area of investigation",
  },
  {
    name: "Layers",
    title: "Build a richer picture.",
    text: "Bring supported official spatial references together with your own drawings and imported layers.",
    label: "Your spatial context",
  },
] as const;

export function SpatialStudy() {
  const [active, setActive] = useState(0);
  const study = studies[active];
  return (
    <div className={s.study}>
      <div className={s.studyImage} data-study={active}>
        <Image
          src="/marketing/spatial-study.svg"
          width={1000}
          height={720}
          alt="Illustrative geometric parcels with a highlighted land boundary and overlapping spatial planes; not a real location or product screenshot."
          priority
          className={s.spatialImage}
        />
        <div className={s.studyCoordinate} aria-hidden="true">
          LAND / CONTEXT / INSIGHT
        </div>
        <div className={s.studyTag}>
          <span />
          {study.label}
        </div>
        <span className={s.north} aria-hidden="true">
          N ↑
        </span>
        <div className={s.studyCaption}>
          Illustrative spatial study · Not a product screenshot
        </div>
      </div>
      <div className={s.studyControls}>
        <div
          className={s.studyButtons}
          role="group"
          aria-label="Explore the three LandOS pillars"
        >
          {studies.map((item, i) => (
            <button
              key={item.name}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              <span className={s.studyIndex}>0{i + 1}</span>
              {item.name}
            </button>
          ))}
        </div>
        <div
          className={s.studyDescription}
          aria-live="polite"
          aria-atomic="true"
        >
          <h3>{study.title}</h3>
          <p>{study.text}</p>
        </div>
      </div>
    </div>
  );
}
