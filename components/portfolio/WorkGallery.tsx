"use client";

import { useState, type ReactNode } from "react";
import styles from "./WorkGallery.module.css";

const categories = ["All", "Products", "Projects"] as const;
type Category = (typeof categories)[number];

export function WorkGallery({
  products,
  projects,
  productCount,
  projectCount,
}: {
  products: ReactNode;
  projects: ReactNode;
  productCount: number;
  projectCount: number;
}) {
  const [category, setCategory] = useState<Category>("All");
  const count = category === "Products" ? productCount
    : category === "Projects" ? projectCount
      : productCount + projectCount;
  const itemLabel = category === "All" ? "item" : category === "Products" ? "product" : "project";

  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Filter selected work">
        {categories.map((item) => (
          <button
            aria-controls="selected-work-gallery"
            aria-pressed={category === item}
            className={styles.filter}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <p className="srOnly" role="status">
        Showing {count} {itemLabel}{count === 1 ? "" : "s"}
      </p>
      <div className={styles.gallery} id="selected-work-gallery">
        {category !== "Projects" ? products : null}
        {category !== "Products" ? projects : null}
      </div>
    </div>
  );
}
