import Image from "next/image";
import Link from "next/link";
import AppStoreButton from "@/components/AppStoreButton";
import s from "./home.module.css";

import heroPhoto from "@/public/images/hero-photo.jpg";
import ipadHome from "@/public/images/ipad-home.webp";
import iphoneHome from "@/public/images/shot-organize.webp";
import sunset from "@/public/images/sunset-band.jpg";
import ctaPhoto from "@/public/images/cta-photo.jpg";
import shotOrganize from "@/public/images/shot-organize.webp";
import shotDecks from "@/public/images/shot-decks.webp";
import shotCustom from "@/public/images/shot-custom-cards.webp";
import shotStudy from "@/public/images/shot-study-view.webp";
import shotReview from "@/public/images/shot-session-review.webp";
import shotStats from "@/public/images/shot-stats.webp";
import shotPast from "@/public/images/shot-past-sessions.webp";
import shotIcloud from "@/public/images/shot-icloud.webp";
import shotReminders from "@/public/images/shot-reminders.webp";
import shotMute from "@/public/images/shot-mute.webp";

const shots = [
  { src: shotOrganize, alt: "BoldFace home screen with My Decks, All Cards, 20 Practice Cards and Flagged Cards", title: "Organize", body: "Use decks, categories, and flagged cards to organize in whatever way works best for your specific study habits." },
  { src: shotDecks, alt: "My Decks screen with Piper Warrior, Instrument Rating and Cessna 150 decks", title: "Build and Share Decks", body: "Put cards into decks and send to other BoldFace users, perfect for a CFI to reinforce lesson plans with students." },
  { src: shotCustom, alt: "New Card screen with an ILS approach question and approach plate image", title: "Custom Cards", body: "Create custom cards to hone in on specific topics, including aircraft details." },
  { src: shotStudy, alt: "All Cards study view showing an answer, its reference and a figure", title: "Intuitive Study View", body: "Flip cards to see answer, reference, photos, and flag cards throughout the session." },
  { src: shotReview, alt: "Session Summary showing time studied, cards right, cards wrong and missed cards", title: "Session Review", body: "See each card missed and export the study review to PDF to mark up or send via normal iOS means." },
  { src: shotStats, alt: "Statistics screen with percent correct by category", title: "Study Stats", body: "See performance across different categories to focus your studying efforts." },
  { src: shotPast, alt: "Past Sessions list with right, wrong and time for each session", title: "Past Sessions", body: "See past study sessions, all cards missed, and export to PDF to save or send to your CFI or other aviation mentor." },
  { src: shotIcloud, alt: "iCloud Sync screen showing synced custom cards, decks and flagged cards", title: "iCloud Sync", body: "Sync your decks, custom cards, flagged cards, muted cards, and study history and statistics across iOS devices." },
  { src: shotReminders, alt: "Notifications settings with daily study reminders at 9:00 AM", title: "Reminders", body: "Set study reminders using your iPhone’s notification center to build healthy aviation study habits." },
  { src: shotMute, alt: "Plane and Pilot card list with a mute bell next to each card", title: "Mute Cards", body: "Mute cards to remove them from study sessions without permanently deleting them from the app." },
];

const steps = [
  { n: "01", title: "Build or pick a deck", body: "Write cards in the Card Builder or grab one from the Card Library." },
  { n: "02", title: "Download the .boldface file", body: "One file holds every card, reference and image in the deck." },
  { n: "03", title: "Open it in BoldFace", body: "Tap the file on your iPhone or iPad and the deck lands in My Decks, ready to study." },
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <header className={s.hero}>
        <Image src={heroPhoto} alt="" fill priority sizes="100vw" className={s.cover} style={{ objectPosition: "center 40%" }} placeholder="blur" />
        <div aria-hidden="true" className={s.heroShade} />
        <div aria-hidden="true" className={s.heroFade} />
        <div className={`container ${s.heroInner}`}>
          <div className={s.heroCopy}>
            <div className="eyebrow">Flashcards for pilots · iPhone &amp; iPad</div>
            <h1 className={`display ${s.heroTitle}`}>Aviation flashcards for checkrides and currency.</h1>
            <p className={s.heroLede}>
              BoldFace turns general aviation knowledge into simple, cited flashcards for student, private and commercial pilots.
              Study the built-in base cards, build your own cards or decks, and share decks as .boldface files.
            </p>
            <div className={s.ctaRow}>
              <AppStoreButton />
              <Link href="/library" className="btn btn-ghost btn-lg">Browse decks</Link>
            </div>
          </div>
          <div className={s.devices}>
            <Image src={ipadHome} alt="BoldFace home screen on iPad" className={s.ipad} sizes="(max-width: 760px) 70vw, 460px" priority />
            <Image src={iphoneHome} alt="BoldFace home screen on iPhone: My Decks, All Cards, 20 Practice Cards, Flagged Cards, User Made and Custom Practice" className={s.iphone} sizes="(max-width: 760px) 50vw, 330px" priority />
          </div>
        </div>
      </header>

      {/* INSIDE THE APP */}
      <section className={`container ${s.section}`}>
        <div className={s.sectionHead}>
          <div className="eyebrow">Inside the app</div>
          <h2 className="h2">Built by a pilot to be better than old aviation study apps.</h2>
        </div>
        <div className={s.shots}>
          {shots.map((shot) => (
            <figure key={shot.title} className={s.shot}>
              <Image src={shot.src} alt={shot.alt} sizes="(max-width: 600px) 90vw, (max-width: 1200px) 30vw, 220px" className={s.shotImg} />
              <figcaption className={s.shotCaption}>
                <span className={s.shotTitle}>{shot.title}</span>
                <span className={s.shotBody}>{shot.body}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PHOTO BAND + DECK LIBRARY */}
      <section className={s.band}>
        <Image src={sunset} alt="Sunset over a coastal inlet, seen past the wing strut of a high-wing trainer" fill sizes="100vw" className={s.cover} style={{ objectPosition: "center 55%" }} placeholder="blur" />
        <div aria-hidden="true" className={s.bandShade} />
        <div className={`container ${s.bandInner}`}>
          <div className={s.sectionHead}>
            <h2 className="h2" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>Decks from pilots.</h2>
            <p className="soft" style={{ margin: 0, maxWidth: 640 }}>Built by pilots and CFIs and shared with the community. Download a deck and it opens straight in BoldFace.</p>
          </div>
          <div className={s.glass}>
            <div className="eyebrow">Deck Library</div>
            <div className={s.glassTitle}>View and download user made decks.</div>
            <p className="soft" style={{ margin: 0 }}>Built a deck your students or study group would use? Submit it from the Deck Editor and it’ll be reviewed for the Library.</p>
            <div className={s.ctaRow}>
              <Link href="/library" className="btn btn-light">Visit the Deck Library</Link>
              <Link href="/editor" className="btn btn-ghost">Submit a deck</Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW SHARING WORKS */}
      <section className={`container ${s.section}`}>
        <h2 className="h2">Browser to app in 3 steps</h2>
        <div className={s.steps}>
          {steps.map((st) => (
            <div key={st.n} className={s.step}>
              <span className={s.stepNum}>{st.n}</span>
              <h3 className={s.stepTitle}>{st.title}</h3>
              <p className="muted" style={{ margin: 0 }}>{st.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={s.cta}>
        <Image src={ctaPhoto} alt="" fill sizes="100vw" className={s.cover} style={{ objectPosition: "center 45%" }} placeholder="blur" />
        <div aria-hidden="true" className={s.ctaShade} />
        <div className={`container ${s.ctaInner}`}>
          <h2 className={`display ${s.ctaTitle}`}>Study with BoldFace</h2>
          <AppStoreButton />
        </div>
      </section>
    </>
  );
}
