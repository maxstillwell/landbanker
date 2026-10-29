import {
  Action,
  CallToAction,
  PageIntro,
  SectionHeading,
} from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";
import s from "@/components/marketing/marketing.module.css";

export const metadata = pageMetadata(
  "/pricing",
  "Plans & Pricing",
  "LandOS commercial plans are forthcoming. Learn what is still being defined, including pricing, plan entitlements and future professional layer access.",
);

const questions = [
  [
    "Are paid plans available?",
    "Public pricing and commercial plans have not been announced. There is no paid checkout on this website.",
  ],
  [
    "Does creating an account start a free trial?",
    "No free trial, duration or trial allowance is advertised. The registration link opens the existing LandOS account creation flow; it does not purchase a subscription.",
  ],
  [
    "Are professional layers included?",
    "Curated professional layers are a future direction. No premium data catalogue, price, coverage or entitlement is currently promised.",
  ],
  [
    "What will plans include?",
    "Pricing, plan names, allowances, billing arrangements and support commitments are still being defined. We will publish the details when they are confirmed.",
  ],
  [
    "Can I discuss a professional use case?",
    "Use the Contact page to prepare an enquiry about your workflow, geography and layer needs. No custom package or commercial commitment is implied.",
  ],
] as const;

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Plans & pricing"
        title="A considered platform. Clear expectations."
      >
        Commercial plans are forthcoming. We’ll publish pricing and entitlements
        when they are confirmed, so you can assess LandOS with the full picture.
      </PageIntro>
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.pricingStatement}>
            <div className={s.pricingMain}>
              <span className={`${s.badge} ${s.futureBadge}`}>
                Plans forthcoming
              </span>
              <h2>
                Built around your
                <br />
                land research.
              </h2>
              <p>
                Explore the current workspace and how Properties, Research Areas
                and Layers fit together. Published subscription plans and
                premium layer access are still to come.
              </p>
              <div className={s.actions}>
                <Action href="/features" secondary>
                  Explore current features
                </Action>
              </div>
            </div>
            <aside className={s.pricingAside}>
              <h3>Still being defined</h3>
              <ul className={s.checkList}>
                <li>Commercial plans and prices</li>
                <li>Plan entitlements and allowances</li>
                <li>Billing and subscription terms</li>
                <li>Curated professional layer access</li>
                <li>Commercial support arrangements</li>
              </ul>
              <p>
                No payment is collected here. Account registration follows the
                existing signup flow and is not a subscription purchase.
              </p>
            </aside>
          </div>
        </div>
      </section>
      <section className={`${s.section} ${s.softSection}`}>
        <div className={s.container}>
          <SectionHeading
            eyebrow="Questions, answered"
            title="What to know before you start."
          />
          <div className={s.faqList}>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <div className={s.actions}>
            <Action href="/contact" secondary>
              Discuss your requirements
            </Action>
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
