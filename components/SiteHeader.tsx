"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { profile } from "@/lib/portfolio";
import styles from "./SiteHeader.module.css";

const navItems = [
  { href: "/#work", label: "Work", section: "work" },
  { href: "/#experience", label: "Experience", section: "experience" },
  { href: "/#about", label: "About", section: "about" },
  { href: "/#contact", label: "Contact", section: "contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    const sections = navItems
      .map((item) => document.getElementById(item.section))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-24% 0px -62%", threshold: [0, 0.1, 0.3, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  const currentSection = pathname === "/" ? activeSection : null;

  const closeMobileMenu = () => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Himanshu Kumar, home">
          <span className={styles.brandMark} aria-hidden="true">
            HK
          </span>
          <span className={styles.brandName}>Himanshu Kumar</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              className={currentSection === item.section
                ? `${styles.sectionLink} ${styles.sectionLinkActive}`
                : styles.sectionLink}
              aria-current={currentSection === item.section ? "location" : undefined}
              key={item.href}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
          <a className={styles.resume} href={profile.resume} download>
            Résumé <span aria-hidden="true">↓</span>
          </a>
        </nav>

        <details className={`mobileNav ${styles.mobileNav}`} ref={mobileMenu}>
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link
                className={currentSection === item.section ? styles.sectionLinkActive : undefined}
                aria-current={currentSection === item.section ? "location" : undefined}
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
              >
                {item.label}
              </Link>
            ))}
            <a href={profile.resume} download onClick={closeMobileMenu}>
              Download résumé
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
