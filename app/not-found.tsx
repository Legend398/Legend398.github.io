import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="notFound">
      <p className="sectionKicker">404 / No evidence found</p>
      <h1>This case file does not exist.</h1>
      <p>The route may have changed, but the selected work is still available.</p>
      <Link className="primaryButton" href="/#work">Return to selected work <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
