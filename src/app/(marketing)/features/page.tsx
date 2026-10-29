import {
  CallToAction,
  PageIntro,
  SectionHeading,
  TextLink,
} from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/features",
  "Properties, Research & Workflow",
  "Explore LandOS Properties, Research Areas, official spatial layers, drawings, observations, spatial import and export, and saved views.",
);

const features = [
  {
    id: "properties",
    number: "01",
    title: "Properties",
    text: "Make a property the starting point for your research. Save supported official parcels or import your own polygon boundaries, then keep related information connected.",
    items: [
      "Search and save supported Victorian and NSW official parcels.",
      "Review property-specific intersections with supported planning sources.",
      "Link observations and Research Areas to saved properties.",
      "Distinguish explicit links from nearby or intersecting information.",
    ],
  },
  {
    id: "research",
    number: "02",
    title: "Research",
    text: "Some questions extend beyond a title boundary. Research Areas give a precinct, investigation area or location a place in your workspace.",
    items: [
      "Define or import a spatial Research Area.",
      "Connect properties and observations to the area you’re investigating.",
      "Keep your investigation in context alongside drawings and map layers.",
      "Return to your work as your understanding of a place develops.",
    ],
  },
  {
    id: "layers",
    number: "03",
    title: "Layers",
    text: "Combine your own spatial information with supported official references. Choose what to display, and use the source information to understand what you’re seeing.",
    items: [
      "Browse the official reference catalogue and add supported layers to the map.",
      "Control layer visibility, ordering and opacity where supported.",
      "Create your own layers from drawings and spatial imports.",
      "Keep official sources distinct from your own analysis.",
    ],
  },
  {
    id: "workflow",
    number: "04",
    title: "A connected workflow",
    text: "Keep the useful detail from desk research and site visits together. The map connects your work; properties, research and observations give it meaning.",
    items: [
      "Draw points, lines, polygons and rectangles, with area and distance measurements.",
      "Record observations with text and photos; edit and link them to your research.",
      "Preview supported spatial files before choosing Property, Research Area or Layer as the destination.",
      "Export supported spatial information as KML, KMZ, GeoJSON or CSV.",
      "Save map views and create scoped, read-only links with expiry and revocation.",
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <PageIntro
        eyebrow="The LandOS workspace"
        title="A place for the work behind the decision."
      >
        Manage properties, investigate areas and bring spatial information
        together. Build your own land intelligence, one piece of research at a
        time.
      </PageIntro>
      <div className={s.container}>
        <nav className={s.anchorNav} aria-label="Feature sections">
          {features.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.title}
            </a>
          ))}
        </nav>
        {features.map((item) => (
          <section id={item.id} className={s.featureRow} key={item.id}>
            <div>
              <span className={s.number}>{item.number} / WORKSPACE</span>
              <h2>{item.title}</h2>
            </div>
            <div>
              <p>{item.text}</p>
              <ul className={s.checkList}>
                {item.items.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              {item.id === "layers" && (
                <TextLink href="/layers">See sources and availability</TextLink>
              )}
            </div>
          </section>
        ))}
        <p className={s.note}>
          Availability depends on source coverage, configuration and supported
          geometry. Planning results are research references, not a planning
          certificate or approval. Complex imported shapes may be view-only;
          measurements are not survey-grade. Public share links exclude private
          observations, photos and notes.
        </p>
      </div>
      <section className={s.section}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="Clear about what’s next"
            title="A platform that is still developing."
          />
          <div className={s.cardGrid}>
            <article className={s.card}>
              <span className={`${s.badge} ${s.futureBadge}`}>
                Future direction
              </span>
              <h3>Curated professional layers</h3>
              <p>
                Specialist spatial context to support deeper research. The
                catalogue, coverage, licensing and access arrangements are yet
                to be announced.
              </p>
            </article>
            <article className={s.card}>
              <span className={`${s.badge} ${s.futureBadge}`}>
                Not included today
              </span>
              <h3>Commercial plans</h3>
              <p>
                Public pricing and subscription entitlements are still being
                defined. There is no paid checkout or published plan allowance.
              </p>
            </article>
            <article className={s.card}>
              <span className={s.badge}>Research with context</span>
              <h3>Your judgement comes first</h3>
              <p>
                LandOS supports research workflows. Automated valuations, an AI
                assistant, CRM and document management are outside the current
                scope.
              </p>
            </article>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
