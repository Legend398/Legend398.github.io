import Link from "next/link";
import { profile } from "@/lib/portfolio";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header} data-site-header>
      <Link className={styles.brand} href="/" aria-label="Himanshu Kumar, home">
        HIMANSHU.KUMAR
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/#work">Work</Link>
        <Link href="/#about">About</Link>
        <a href={profile.resume} download>Résumé</a>
        <Link href="/#contact">Contact</Link>
      </nav>
    </header>
  );
}
