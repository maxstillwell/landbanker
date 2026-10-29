import {
  CallToAction,
  PageIntro,
  SectionHeading,
  TextLink,
} from "@/components/marketing/site";
import { LayerStack } from "@/components/marketing/home";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/layers",
  "Official Spatial Layers & Your Own Data",
  "Explore supported VIC and NSW official spatial sources, your own imported layers and drawings, and LandOS’s future curated professional layer direction.",
);

const sources = [
  {
    name: "Victorian cadastral parcels",
    provider: "Victorian Government / VicPlan",
    purpose: "Parcel identification and boundary context.",
    href: "https://www.land.vic.gov.au/maps-and-spatial/spatial-data",
  },
  {
    name: "Victorian planning zones",
    provider: "Victorian Government",
    purpose:
      "Planning Scheme Zone codes and descriptions from supported sources.",
    href: "https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes",
  },
  {
    name: "NSW cadastral parcels",
    provider: "NSW Spatial Services",
    purpose: "Lot and plan identification with spatial parcel context.",
    href: "https://www.spatial.nsw.gov.au/products_and_services/web_services",
  },
  {
    name: "NSW land zoning",
    provider: "NSW Government / Planning Portal",
    purpose: "Supported EPI land zoning references and source attributes.",
    href: "https://www.planningportal.nsw.gov.au/spatialviewer",
  },
];

export default function LayersPage() {
  return (
    <>
      <PageIntro
        eyebrow="Layers of understanding"
        title="Your knowledge. In a wider context."
      >
        Bring supported official spatial information together with your own
        drawings and imports. Choose the context that matters to your research.
      </PageIntro>
      <section className={s.darkSection}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.splitCopy}>
            <SectionHeading
              eyebrow="A considered layer approach"
              title="Different sources. A clearer picture."
            >
              Your workspace holds your own analysis. Supported government
              references add official context. Curated professional layers are a
              future direction, separately identified from what is available
              now.
            </SectionHeading>
          </div>
          <LayerStack />
        </div>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="Supported official references"
            title="Know where the information comes from."
          >
            Examples of sources supported in the current implementation.
            Coverage and availability depend on the provider and location; this
            is not a claim of complete Australian coverage.
          </SectionHeading>
          <div
            className={s.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Supported official source examples; scroll horizontally on smaller screens"
          >
            <table className={s.dataTable}>
              <caption
                className={s.visualLabel}
                style={{ textAlign: "left", paddingBottom: 16 }}
              >
                Selected supported sources · VIC & NSW
              </caption>
              <thead>
                <tr>
                  <th scope="col">Spatial reference</th>
                  <th scope="col">Research context</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.name}>
                    <td>
                      {source.name}
                      <p>Supported source</p>
                    </td>
                    <td>{source.purpose}</td>
                    <td>
                      <a href={source.href} rel="noreferrer">
                        {source.provider}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.note}>
            Official data remains subject to its source terms, update schedule,
            coverage and service availability. A missing or unavailable result
            does not mean no restriction applies. NSW floor space ratio and
            building height layers remain disabled pending interpretation and
            release review.
          </p>
        </div>
      </section>
      <section className={`${s.section} ${s.softSection}`}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.splitCopy}>
            <SectionHeading
              eyebrow="Your own spatial information"
              title="Bring your perspective to the map."
            >
              Import supported spatial files, review the contents and save them
              as a Property, Research Area or custom Layer. Add your own
              drawings and keep the work in your workspace.
            </SectionHeading>
            <TextLink href="/features#workflow">
              Explore import, export and drawing
            </TextLink>
          </div>
          <div className={s.workflowVisual}>
            <p className={s.visualLabel}>From a file to useful context</p>
            <div className={s.workflowStep}>
              <span>01</span>
              <div>
                <strong>Preview</strong>
                <p>Review supported geometry before saving.</p>
              </div>
            </div>
            <div className={s.workflowStep}>
              <span>02</span>
              <div>
                <strong>Organise</strong>
                <p>Choose a Property, Research Area or Layer.</p>
              </div>
            </div>
            <div className={s.workflowStep}>
              <span>03</span>
              <div>
                <strong>Work with it</strong>
                <p>Display, investigate and export supported data.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className={s.section}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.splitCopy}>
            <span className={`${s.badge} ${s.futureBadge}`}>
              Future direction · Not available today
            </span>
            <h2 style={{ marginTop: 24 }}>
              More specialised context, over time.
            </h2>
            <p>
              We intend to develop curated professional layers that help land
              researchers investigate more deeply. Sources, geographic coverage,
              licensing, pricing and release timing have not been announced.
            </p>
            <TextLink href="/contact">
              Tell us what you need to research
            </TextLink>
          </div>
          <div>
            <h3>Source clarity stays essential.</h3>
            <ul className={s.checkList}>
              <li>
                Official references and custom analysis stay distinguishable.
              </li>
              <li>Coverage and interpretation need to be understood.</li>
              <li>
                Technical availability alone does not establish a layer’s
                suitability.
              </li>
              <li>Professional advice remains part of a land decision.</li>
            </ul>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
