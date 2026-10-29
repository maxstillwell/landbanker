import { Enquiry } from "@/components/marketing/enquiry";
import { PageIntro, TextLink } from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/contact",
  "Contact & Enquiries",
  "Prepare an enquiry about LandOS product access, land research workflows, spatial layer needs and geographic coverage.",
);

export default function ContactPage() {
  // No invented inbox or new sending service. Set only an owner-approved address.
  const candidate = process.env.LANDOS_CONTACT_EMAIL?.trim();
  const email =
    candidate &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(
      candidate,
    )
      ? candidate
      : null;
  return (
    <>
      <PageIntro eyebrow="Contact LandOS" title="What are you working on?">
        Tell us about the land you research, the places you work and the context
        you need. Start with your workflow.
      </PageIntro>
      <section className={s.section}>
        <div className={`${s.container} ${s.contactGrid}`}>
          <div>
            <article className={s.contactItem}>
              <h2>Product & access</h2>
              <p>
                Explore the current workspace or use the existing signup and
                login pages. Registration is separate from any future commercial
                plan.
              </p>
              <TextLink href="/signup">Create your workspace</TextLink>
              <br />
              <TextLink href="/login">Sign in to LandOS</TextLink>
            </article>
            <article className={s.contactItem}>
              <h2>Layers & geographic coverage</h2>
              <p>
                Describe the geography, source or research question you have in
                mind. Official layer availability is source-dependent;
                professional curated layers remain a future direction.
              </p>
              <TextLink href="/layers">Explore supported sources</TextLink>
            </article>
            <article className={s.contactItem}>
              <h2>Professional workflows</h2>
              <p>
                Share how you currently organise properties, spatial files and
                investigations, and what you need to keep connected.
              </p>
              <TextLink href="/solutions">Explore research workflows</TextLink>
            </article>
            {email && (
              <article className={s.contactItem}>
                <h2>Email LandOS</h2>
                <a className={s.textLink} href={`mailto:${email}`}>
                  {email}
                </a>
              </article>
            )}
          </div>
          <Enquiry email={email} />
        </div>
      </section>
    </>
  );
}
