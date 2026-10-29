import {
  Action,
  CallToAction,
  Eyebrow,
  SectionHeading,
  TextLink,
} from "./site";
import { SpatialStudy } from "./spatial-study";
import s from "./marketing.module.css";

export function LayerStack() {
  return (
    <div className={s.layerStack} aria-label="Three sources of spatial context">
      <div className={s.layerRow}>
        <span className={s.layerSwatch} aria-hidden="true" />
        <div>
          <h3>Professional context</h3>
          <p>Curated specialist layers</p>
        </div>
        <span className={`${s.badge} ${s.futureBadge}`}>Future direction</span>
      </div>
      <div className={s.layerRow}>
        <span className={s.layerSwatch} aria-hidden="true" />
        <div>
          <h3>Official references</h3>
          <p>Supported government spatial sources</p>
        </div>
      </div>
      <div className={s.layerRow}>
        <span className={s.layerSwatch} aria-hidden="true" />
        <div>
          <h3>Your own intelligence</h3>
          <p>Properties, drawings and imported layers</p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <>
      <section className={s.hero}>
        <div className={`${s.container} ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <Eyebrow>Australian land intelligence platform</Eyebrow>
            <h1>
              Your land.
              <br />
              Your research.
              <br />
              <span>Your intelligence.</span>
            </h1>
            <p className={s.heroDescription}>
              A workspace for the land you own, the places you’re researching
              and the spatial information that connects them.
            </p>
            <div className={s.actions}>
              <Action href="/signup">Create your workspace</Action>
              <Action href="/features" secondary>
                Explore LandOS
              </Action>
            </div>
            <p className={s.heroFootnote}>
              Properties. Research. Layers. One place to build your picture.
            </p>
          </div>
          <SpatialStudy />
        </div>
      </section>
      <div className={s.contextStrip}>
        <div className={s.container}>
          <p>Built around the way land research works.</p>
          <ul>
            <li>Landowners & investors</li>
            <li>Developers & acquisitions</li>
            <li>Planners & consultants</li>
          </ul>
        </div>
      </div>
      <section className={s.section}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="A connected way to work"
            title="More context for every piece of land."
          >
            A map gives you a location. Your workspace brings together what you
            know about it, what you’re investigating and the information behind
            your decisions.
          </SectionHeading>
          <div className={s.pillarGrid}>
            <article className={s.pillar}>
              <span className={s.number}>01 / PROPERTIES</span>
              <h3>Know your land.</h3>
              <p>
                Save the parcels that matter. Keep boundaries, supported
                planning information and linked observations with the property
                they relate to.
              </p>
              <TextLink href="/features#properties">
                Explore Properties
              </TextLink>
            </article>
            <article className={s.pillar}>
              <span className={s.number}>02 / RESEARCH</span>
              <h3>Follow the question.</h3>
              <p>
                Define a Research Area beyond a single title. Connect properties
                and observations as you investigate a precinct, a location or an
                opportunity.
              </p>
              <TextLink href="/features#research">Explore Research</TextLink>
            </article>
            <article className={s.pillar}>
              <span className={s.number}>03 / LAYERS</span>
              <h3>See the bigger picture.</h3>
              <p>
                Add supported official spatial references and your own imported
                data. Keep your drawings and analysis in the same geographic
                context.
              </p>
              <TextLink href="/layers">Explore Layers</TextLink>
            </article>
          </div>
        </div>
      </section>
      <section className={`${s.section} ${s.softSection}`}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.workflowVisual}>
            <p className={s.visualLabel}>A connected research workflow</p>
            <div className={s.workflowStep}>
              <span>01</span>
              <div>
                <strong>Find your focus</strong>
                <p>Save a property or define a Research Area.</p>
              </div>
            </div>
            <div className={s.workflowStep}>
              <span>02</span>
              <div>
                <strong>Bring in the context</strong>
                <p>Add supported layers, boundaries and drawings.</p>
              </div>
            </div>
            <div className={s.workflowStep}>
              <span>03</span>
              <div>
                <strong>Keep building your knowledge</strong>
                <p>Link observations and return to saved views.</p>
              </div>
            </div>
          </div>
          <div className={s.splitCopy}>
            <Eyebrow>Your work, connected</Eyebrow>
            <h2>
              Keep the research.
              <br />
              Build on it.
            </h2>
            <p>
              A site visit, a boundary file, a planning reference. Each piece
              becomes more useful when you can return to it in context.
            </p>
            <p>
              LandOS brings your saved properties, Research Areas, spatial
              drawings and field observations into a workspace you can continue
              to develop.
            </p>
            <TextLink href="/features#workflow">
              See how the workflow connects
            </TextLink>
          </div>
        </div>
      </section>
      <section className={s.darkSection}>
        <div className={`${s.container} ${s.splitSection}`}>
          <div className={s.splitCopy}>
            <Eyebrow>Information in layers</Eyebrow>
            <h2>
              Your perspective.
              <br />
              With more depth.
            </h2>
            <p>
              Bring your own knowledge together with supported official spatial
              sources. See where information comes from and understand the
              limits of what it tells you.
            </p>
            <p>
              Our direction is to add curated professional layers over time.
              These are planned, with no premium catalogue or availability
              promised today.
            </p>
            <TextLink href="/layers">Discover the layer approach</TextLink>
          </div>
          <LayerStack />
        </div>
      </section>
      <section className={s.section}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="Built for land decisions"
            title="Different roles. Shared context."
          />
          <div className={s.solutionList}>
            <article className={s.solutionItem}>
              <span className={s.number}>OWN & INVEST</span>
              <h3>Keep a clearer view of your properties.</h3>
              <p>
                Bring saved boundaries and site observations together, and
                return to the research behind each property.
              </p>
            </article>
            <article className={s.solutionItem}>
              <span className={s.number}>RESEARCH & DEVELOP</span>
              <h3>Investigate beyond a single parcel.</h3>
              <p>
                Use Research Areas to organise location-based investigations,
                connect properties and add spatial context.
              </p>
            </article>
            <article className={s.solutionItem}>
              <span className={s.number}>PLAN & ADVISE</span>
              <h3>Build a traceable picture of a place.</h3>
              <p>
                Review supported official references alongside your own
                drawings, with source information and limitations visible.
              </p>
            </article>
            <article className={s.solutionItem}>
              <span className={s.number}>OBSERVE & RECORD</span>
              <h3>Keep field knowledge connected.</h3>
              <p>
                Record observations and photos, and link them to the property or
                Research Area they inform.
              </p>
            </article>
          </div>
          <div className={s.sectionFooter}>
            <TextLink href="/solutions">Find your workflow</TextLink>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
