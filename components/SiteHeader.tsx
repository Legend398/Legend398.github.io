import Link from "next/link";
import { profile } from "@/lib/portfolio";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header} data-site-header>
      <Link className={styles.brand} href="/" aria-label="Himanshu Kumar, home">
        HIMANSHU.KUMAR
      </Link>
      <nav aria-label="Primary navigation" className={styles.desktopNav}>
        <Link href="/#work">Work</Link>
        <Link href="/#about">About</Link>
        <a aria-label="Download résumé" className={styles.resumeLink} href={profile.resume} download>
          Résumé <span aria-hidden="true">↓</span>
        </a>
        <Link href="/#contact">Contact</Link>
      </nav>
      <details className={styles.mobileMenu}>
        <summary aria-label="Open navigation menu">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </summary>
        <nav aria-label="Primary navigation">
          <Link href="/#work">Work</Link>
          <Link href="/#about">About</Link>
          <a aria-label="Download résumé" href={profile.resume} download>Résumé ↓</a>
          <Link href="/#contact">Contact</Link>
        </nav>
      </details>
    </header>
  );
}
