import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/core/auth/authContext";
import { canGlobal, Permission } from "@/core/rbac";
import "./About.css";

const BAIN_RED = "#C41230";

const BANNER_SOURCES = [
  "/public/images/banners/banner1.png",
  "/images/banners/banner2.png",
  "/images/banners/banner3.png",
] as const;

function BannerLayer({
  src,
  active,
  alt,
}: {
  src: string;
  active: boolean;
  alt: string;
}) {
  return (
    <img
      className={`bpp-about-hero__img ${active ? "is-active" : ""}`}
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="bpp-pill">{children}</span>;
}

function FeatureCard({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="bpp-card bpp-card--hover">
      <div className="bpp-card__top">
        <div className="bpp-card__accent" aria-hidden="true" />
        <h3 className="bpp-card__title">{title}</h3>
      </div>
      <p className="bpp-card__desc">{description}</p>
      <ul className="bpp-card__list">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

function TimelineStep({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <div className="bpp-step">
      <div className="bpp-step__rail" aria-hidden="true">
        <div className="bpp-step__dot">{index}</div>
        <div className="bpp-step__line" />
      </div>
      <div className="bpp-step__content">
        <div className="bpp-step__title">{title}</div>
        <div className="bpp-step__body">{body}</div>
      </div>
    </div>
  );
}

export default function About() {
  const { user } = useAuth();
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const canViewSettings = canGlobal(user, Permission.ViewSettings);

  React.useEffect(() => {
    // Respect reduced motion
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const apply = () => setReduceMotion(!!mq.matches);
    apply();

    const onChange = () => apply();
    // Older Safari fallback
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  React.useEffect(() => {
    if (paused || reduceMotion) return;

    const id = window.setInterval(() => {
      setActive((v) => (v + 1) % BANNER_SOURCES.length);
    }, 6000);

    return () => window.clearInterval(id);
  }, [paused, reduceMotion]);

  const year = new Date().getFullYear();

  return (
    <div className="bpp-about">
      {/* HERO */}
      <section
        className="bpp-about-hero"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="bpp-about-hero__bg" aria-hidden="true">
          {BANNER_SOURCES.map((src, i) => (
            <BannerLayer
              key={src}
              src={src}
              active={i === active}
              alt="PartitionPro banner"
            />
          ))}
          <div className="bpp-about-hero__overlay" />
        </div>

        <div className="bpp-about-hero__inner">
          <div className="bpp-about-hero__content">
            <div className="bpp-about-hero__left">
              <div className="bpp-about-hero__eyebrow">
                <Pill>Shopper Partition</Pill>
                <span className="bpp-dot" aria-hidden="true">
                  •
                </span>
                <Pill>PartitionPro</Pill>
                <span className="bpp-dot" aria-hidden="true">
                  •
                </span>
                <Pill>Consumer Products</Pill>
              </div>

              <h1 className="bpp-about-hero__title">About PartitionPro</h1>

              <p className="bpp-about-hero__subtitle">
                PartitionPro is a streamlined workspace for creating, managing,
                and reusing shopper partition cases—built to keep assumptions
                clear, workflows consistent, and decisions easier to defend.
              </p>

              <div className="bpp-about-hero__actions">
                <Link to="/cases" className="bpp-btn bpp-btn--primary">
                  Go to Cases <span aria-hidden="true">→</span>
                </Link>

                <Link to="/dashboard" className="bpp-btn bpp-btn--ghost">
                  Back to Home
                </Link>
              </div>

              <div className="bpp-about-hero__note">
                Tip: Hover your header navigation to explore key sections
                quickly.
              </div>
            </div>

            <aside className="bpp-about-hero__right">
              <div className="bpp-glance">
                <div className="bpp-glance__header">
                  <div className="bpp-glance__kicker">At a glance</div>
                  <div
                    className="bpp-glance__badge"
                    style={{ color: BAIN_RED }}
                  >
                    Internal Tool
                  </div>
                </div>

                <dl className="bpp-glance__dl">
                  <div className="bpp-glance__row">
                    <dt>Purpose</dt>
                    <dd>Shopper partition case management across markets</dd>
                  </div>
                  <div className="bpp-glance__row">
                    <dt>Primary areas</dt>
                    <dd>Partition case repository</dd>
                  </div>
                  <div className="bpp-glance__row">
                    <dt>Design goals</dt>
                    <dd>Speed, consistency, reuse, clarity</dd>
                  </div>
                </dl>

                <div className="bpp-glance__divider" />

                <div className="bpp-glance__cta">
                  <div className="bpp-glance__ctaTitle">
                    Looking for something?
                  </div>
                  <div className="bpp-glance__ctaBody">
                    Start with <strong>Cases</strong> for active work or{" "}
                    <strong>Archive</strong> for historical context.
                  </div>

                  <div className="bpp-glance__ctaActions">
                    <Link to="/cases" className="bpp-link">
                      Browse cases <span aria-hidden="true">→</span>
                    </Link>
                    <Link to="/archive" className="bpp-link">
                      View archive <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Dots */}
          <div className="bpp-about-hero__dots" aria-label="Banner selection">
            {BANNER_SOURCES.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`bpp-dotbtn ${i === active ? "is-active" : ""}`}
                onClick={() => setActive(i)}
                aria-label={`Show banner ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="bpp-about-hero__redbar" aria-hidden="true" />
      </section>

      {/* WHY */}
      <section className="bpp-about__section">
        <div className="bpp-about__grid2">
          <div>
            <h2 className="bpp-h2">Why PartitionPro exists</h2>
            <p className="bpp-p">
              Shopper household penetration data analyzed with PartitionPro to
              identify key attributes that guide shopper behavior and real
              overlaps between SKUs in a category. PartitionPro is designed to
              keep teams aligned on inputs and provide a clean, reusable record
              of the work—so you can move fast without losing rigor.
            </p>

            <div className="bpp-kpis">
              <div className="bpp-kpi">
                <div className="bpp-kpi__label">Consistency</div>
                <div className="bpp-kpi__value">Standard case structure</div>
              </div>
              <div className="bpp-kpi">
                <div className="bpp-kpi__label">Clarity</div>
                <div className="bpp-kpi__value">Assumptions made visible</div>
              </div>
              <div className="bpp-kpi">
                <div className="bpp-kpi__label">Reuse</div>
                <div className="bpp-kpi__value">Archive-ready outputs</div>
              </div>
            </div>
          </div>

          <div className="bpp-callout">
            <div className="bpp-callout__title">What you can do here</div>
            <ul className="bpp-callout__list">
              <li>
                Create and manage partitions across markets in a workspace
              </li>
              <li>
                Identify key market drivers and consumer purchase behavior
              </li>
              <li>Organize work across markets, scenarios, and timelines</li>
              <li>Use Archive to learn from prior cases and reduce rework</li>
            </ul>
            <div className="bpp-callout__footer">
              <Link to="/cases/new" className="bpp-btn bpp-btn--secondary">
                Start a case <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="bpp-about__section bpp-about__section--muted">
        <div className="bpp-about__sectionInner">
          <div className="bpp-about__sectionHead">
            <h2 className="bpp-h2">Core capabilities</h2>
          </div>

          <div className="bpp-cards">
            <FeatureCard
              title="Case workspace"
              description="Keep each partition case organized with clear structure and fast navigation."
              bullets={[
                "Create, browse, and manage cases across markets",
                "Reduce ambiguity with consistent naming and sections",
                "Quick access to active vs archived work",
              ]}
            />

            <FeatureCard
              title="Traceable assumptions"
              description="Make inputs and logic easier to understand and easier to challenge."
              bullets={[
                "Encourage clarity around drivers and inputs",
                "Support clean handoffs across teams",
                "Improve readability for reviewers and stakeholders",
              ]}
            />

            <FeatureCard
              title="Reusable archive"
              description="Treat every completed case as a reusable asset—not a dead document."
              bullets={[
                "Archive outcomes and context for future teams",
                "Learn faster from comparable past work",
                "Minimize rework for recurring analyses",
              ]}
            />

            <FeatureCard
              title="Configurable defaults"
              description="Align settings with the way your team prefers to work."
              bullets={[
                "Manage preferences and defaults in Settings",
                "Keep configuration centralized and predictable",
                "Maintain a consistent experience across users",
              ]}
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bpp-about__section">
        <div className="bpp-about__grid2 bpp-about__grid2--top">
          <div>
            <h2 className="bpp-h2">How teams typically use PartitionPro</h2>
            <p className="bpp-p">
              The tool is designed to support a simple, repeatable flow. It acts
              as a starting point for developing shopper partition and
              customizing basis the market context
            </p>

            <div className="bpp-steps">
              <TimelineStep
                index={1}
                title="Start with a new case"
                body="Create a case and align on scope, market, timeframe, and objective."
              />
              <TimelineStep
                index={2}
                title="Capture inputs consistently"
                body="Record assumptions and drivers in a way that’s easy to review and reuse."
              />
              <TimelineStep
                index={3}
                title="Collaborate and refine"
                body="Iterate quickly while keeping structure stable and decisions explainable."
              />
              <TimelineStep
                index={4}
                title="Archive for reuse"
                body="Close the loop by archiving outcomes and context for future work."
              />
            </div>
          </div>

          <div className="bpp-principles">
            <div className="bpp-principles__head">
              <h3 className="bpp-h3">Design principles</h3>
              <p className="bpp-p bpp-p--muted">
                What “good” looks like in this product.
              </p>
            </div>

            <div className="bpp-principles__grid">
              <div className="bpp-principle">
                <div className="bpp-principle__title">Premium clarity</div>
                <div className="bpp-principle__body">
                  Strong hierarchy, minimal noise, and predictable structure.
                </div>
              </div>

              <div className="bpp-principle">
                <div className="bpp-principle__title">Fast navigation</div>
                <div className="bpp-principle__body">
                  Get to cases and context in one or two clicks.
                </div>
              </div>

              <div className="bpp-principle">
                <div className="bpp-principle__title">Consistency</div>
                <div className="bpp-principle__body">
                  Standard terminologies that work across markets and teams.
                </div>
              </div>

              <div className="bpp-principle">
                <div className="bpp-principle__title">
                  Reuse over reinvention
                </div>
                <div className="bpp-principle__body">
                  Make past work discoverable and useful—by default.
                </div>
              </div>
            </div>

            <div className="bpp-principles__footer">
              {canViewSettings ? (
                <Link to="/settings" className="bpp-link">
                  Explore Settings <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* LEADERSHIP */}
      <section className="bpp-about__section bpp-about__section--muted">
        <div className="bpp-about__sectionInner">
          <div className="bpp-about__sectionHead">
            <h2 className="bpp-h2">Leadership</h2>
            <p className="bpp-p bpp-p--muted">
              The Consumer Products product leadership team behind PartitionPro.
            </p>
          </div>

          <div className="bpp-about__people">
            <div className="bpp-about-person">
              <img
                src="/images/People/Aparna_Sharma.jpg"
                alt="Aparna Sharma"
                className="bpp-about-person__avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="bpp-about-person__meta">
                <div className="bpp-about-person__name">Aparna Sharma</div>
                <div className="bpp-about-person__role">
                  Director, Consumer Products
                </div>
              </div>
            </div>
            <div className="bpp-about-person">
              <img
                src="/images/People/Rahul_Agarwal.jpg"
                alt="Rahul Agarwal"
                className="bpp-about-person__avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="bpp-about-person__meta">
                <div className="bpp-about-person__name">Rahul Agarwal</div>
                <div className="bpp-about-person__role">
                  Director, Consumer Products
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bpp-about__section">
        <div className="bpp-final">
          <div className="bpp-final__left">
            <h2 className="bpp-h2">Feedback & improvements</h2>
            <p className="bpp-p">
              If something feels unclear, slow, or inconsistent—call it out. The
              fastest way to make partition work better is to tighten the workflow and
              reduce friction.
            </p>

            <div className="bpp-final__actions">
              {/* Put your real contact channel here when ready */}
              <a
                className="bpp-btn bpp-btn--primary"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Share feedback <span aria-hidden="true">→</span>
              </a>

              <Link className="bpp-btn bpp-btn--ghost" to="/cases">
                Continue to Cases
              </Link>
            </div>
          </div>

          <div className="bpp-final__right">
            <div className="bpp-mini">
              <div className="bpp-mini__title">Quick links</div>
              <div className="bpp-mini__links">
                <Link to="/dashboard" className="bpp-link">
                  Home <span aria-hidden="true">→</span>
                </Link>
                <Link to="/cases" className="bpp-link">
                  Cases <span aria-hidden="true">→</span>
                </Link>
                <Link to="/archive" className="bpp-link">
                  Archive <span aria-hidden="true">→</span>
                </Link>
                {canViewSettings ? (
                  <Link to="/settings" className="bpp-link">
                    Settings <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>

              <div className="bpp-mini__fineprint">
                © {year} Bain &amp; Company · PartitionPro
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
