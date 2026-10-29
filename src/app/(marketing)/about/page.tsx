import {
  CallToAction,
  Eyebrow,
  PageIntro,
  SectionHeading,
  TextLink,
} from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/about",
  "About the LandOS Platform",
  "LandOS is an independent Australian land intelligence platform built around your properties, research and spatial context. Learn about its purpose and principles.",
);

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About LandOS"
        title="Land is the starting point. Understanding is the work."
      >
        LandOS is an independent Australian land intelligence platform for
        people who own, investigate, develop and advise on land.
      </PageIntro>
      <section className={s.section}>
        <div className={s.container}>
          <Eyebrow>Our perspective</Eyebrow>
          <p className={s.aboutStatement} style={{ marginTop: 30 }}>
            A property boundary tells you where a piece of land is. The research
            around it helps you understand what it means.
          </p>
          <div className={s.featureRow}>
            <h2>Give that research a home.</h2>
            <div>
              <p>
                Land information often arrives one piece at a time: an official
                spatial reference, a boundary file, a drawing or an observation
                from a site visit. LandOS brings those pieces into a workspace
                organised around Properties, Research and Layers.
              </p>
              <p style={{ marginTop: 24 }}>
                The map is the spatial foundation. The purpose is to help you
                keep your own knowledge connected, revisit your investigations
                and build a more informed view of the places that matter to you.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className={`${s.section} ${s.softSection}`}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="What guides the platform"
            title="Useful context. Clear boundaries."
          />
          <div className={s.principleGrid}>
            <div>
              <span className={s.number}>01</span>
              <h3>Your work has a place.</h3>
              <p>
                Properties, Research Areas, drawings and observations belong in
                a connected workspace where you can return to them.
              </p>
            </div>
            <div>
              <span className={s.number}>02</span>
              <h3>Sources matter.</h3>
              <p>
                Official information and your own analysis serve different
                purposes. Provenance, coverage and interpretation stay part of
                the picture.
              </p>
            </div>
            <div>
              <span className={s.number}>03</span>
              <h3>Judgement stays human.</h3>
              <p>
                A richer spatial view supports research. It does not replace due
                diligence, a survey, a planning certificate or qualified
                professional advice.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className={s.section}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.splitCopy}>
            <Eyebrow>Built to develop</Eyebrow>
            <h2>
              A long-term direction.
              <br />
              An honest starting point.
            </h2>
            <p>
              The current platform centres on saved properties, Research Areas,
              supported official references and your own spatial work. Curated
              professional layers and commercial plans are future directions.
            </p>
            <TextLink href="/features">
              See what the platform does today
            </TextLink>
          </div>
          <div className={s.card}>
            <span className={`${s.badge} ${s.futureBadge}`}>
              Future direction
            </span>
            <h3>Deeper land intelligence.</h3>
            <p>
              We intend to add more specialised spatial context over time. Each
              addition needs clear sources, understood coverage and suitable
              access arrangements before it becomes part of a professional
              research workflow.
            </p>
            <TextLink href="/layers">Read the layer approach</TextLink>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
