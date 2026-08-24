import Link from "next/link";
import { profile } from "@/lib/portfolio";
import styles from "./SiteHeader.module.css";

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className={styles.header} data-site-header>
      <Link className={styles.brand} href="/" aria-label="Himanshu Kumar, home">
        HIMANSHU.KUMAR
      </Link>
      <nav aria-label="Primary navigation" className={styles.desktopNav}>
        <Link href="/#work">Work</Link>
        <Link href="/#about">About</Link>
        <a aria-label="Download resume" className={styles.resumeLink} href={profile.resume} download>
          Resume <DownloadIcon className={styles.downloadIcon} />
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
          <a aria-label="Download resume" href={profile.resume} download>
            Resume <DownloadIcon className={styles.downloadIcon} />
          </a>
          <Link href="/#contact">Contact</Link>
        </nav>
      </details>
    </header>
  );
}
