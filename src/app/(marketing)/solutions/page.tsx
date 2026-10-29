import {
  Action,
  CallToAction,
  PageIntro,
  SectionHeading,
  TextLink,
} from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/solutions",
  "Land Research Workflows",
  "Land research workflows for Australian property owners, investors, developers, acquisition managers, planners, consultants and field teams.",
);

const solutions = [
  {
    id: "owners",
    title: "Landowners & investors",
    label: "KEEP YOUR PROPERTIES IN CONTEXT",
    text: "Create a spatial record of the properties you hold or investigate. Keep the boundaries, observations and research context together, so the work remains useful beyond the next visit.",
    items: [
      "Save or import property boundaries.",
      "Keep site observations and photos linked to the relevant property.",
      "Review supported official planning references and their sources.",
    ],
  },
  {
    id: "development",
    title: "Developers & acquisitions",
    label: "INVESTIGATE AN AREA OF INTEREST",
    text: "Start with a location or precinct, then organise the properties and observations that inform your investigation. Research Areas let your work extend beyond an individual parcel.",
    items: [
      "Define a Research Area for a location-based investigation.",
      "Connect saved properties and field observations explicitly.",
      "Use drawings, measurements and layers to explore spatial relationships.",
    ],
  },
  {
    id: "advisers",
    title: "Planners & consultants",
    label: "WORK WITH SOURCES AND SPATIAL CONTEXT",
    text: "Bring supported official references into the same view as your own analysis. Keep the source and its limits visible as you develop an understanding of a place.",
    items: [
      "Review supported property-specific planning intersections.",
      "Add imported spatial context and your own analysis layers.",
      "Export supported spatial data or share a reviewed, read-only map scope.",
    ],
  },
  {
    id: "field",
    title: "Field researchers",
    label: "CONNECT WHAT YOU SEE WITH WHERE IT IS",
    text: "A field observation is more valuable when you can find it again. Record text and photos, then link the observation to a property or Research Area.",
    items: [
      "Position an observation using a map point or supported device location.",
      "Keep text and photos with the observation.",
      "Edit saved observations and preserve the context of your investigation.",
    ],
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <PageIntro
        eyebrow="LandOS in practice"
        title="Built for the questions you bring to land."
      >
        From a single property to a wider area of investigation, build a
        workspace around your work and the information you need to understand
        it.
      </PageIntro>
      <div className={s.container}>
        <nav className={s.anchorNav} aria-label="Solution sections">
          {solutions.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.title}
            </a>
          ))}
        </nav>
        {solutions.map((item) => (
          <section id={item.id} key={item.id} className={s.featureRow}>
            <div>
              <span className={s.number}>{item.label}</span>
              <h2>{item.title}</h2>
            </div>
            <div>
              <p>{item.text}</p>
              <ul className={s.checkList}>
                {item.items.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <TextLink href="/features">Explore the workspace</TextLink>
            </div>
          </section>
        ))}
      </div>
      <section className={s.section}>
        <div className={`${s.container} ${s.splitSection}`}>
          <SectionHeading
            eyebrow="Start with your own research"
            title="One workspace. Your way of seeing the land."
          >
            LandOS helps you organise spatial research. It does not provide
            valuations, development approvals, a transaction platform or
            professional advice.
          </SectionHeading>
          <div>
            <h3>Have a particular workflow in mind?</h3>
            <p className={s.lead}>
              Describe the land you work with, the geography you cover and the
              spatial information you need.
            </p>
            <div className={s.actions}>
              <Action href="/contact" secondary>
                Discuss your workflow
              </Action>
            </div>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
