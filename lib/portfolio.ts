export const profile = {
  name: "Himanshu Kumar",
  role: "Software Engineer · Agentic AI Engineer · Data Science",
  email: "hk270941@gmail.com",
  github: "https://github.com/Legend398",
  linkedin: "https://www.linkedin.com/in/himanshu-kumar70",
  resume: "/Himanshu-Kumar-Resume-2026.pdf",
} as const;

export type ProjectVisualKind = "loop" | "stocklane" | "credit";

export type Project = {
  slug: string;
  number: string;
  title: string;
  strapline: string;
  summary: string;
  role: string;
  date: string;
  category: string;
  stack: readonly string[];
  highlights: readonly string[];
  repository?: string;
  live?: string;
  visual: ProjectVisualKind;
  image: string;
  imageAlt: string;
  overview: readonly {
    label: string;
    value: string;
  }[];
  problem: {
    statement: string;
    detail: string;
  };
  solution: {
    statement: string;
    detail: string;
  };
  pipeline: readonly {
    title: string;
    detail: string;
    branch?: string;
  }[];
  contributions: readonly {
    title: string;
    body: string;
  }[];
  results: readonly string[];
  evidenceImage: {
    src: string;
    alt: string;
    caption: string;
    fit?: "cover" | "contain";
  };
};

export const projects: readonly Project[] = [
  {
    slug: "loop-engineering",
    number: "01",
    title: "Loop Engineering",
    strapline: "A workflow that helps coding agents plan, test, and finish long software tasks.",
    summary:
      "I extended an open-source coding-agent project so work can resume without losing the task plan. It also detects when code changes make earlier test results outdated.",
    role: "Open-source contributor · derivative extensions",
    date: "Apr–Jul 2026",
    category: "AI developer tool",
    stack: ["TypeScript", "Node.js", "MCP", "Git"],
    highlights: [
      "Saves and resumes progress across long coding tasks",
      "Finds relevant code before making changes",
      "Requires fresh tests and a separate review before completion",
    ],
    repository: "https://github.com/Legend398/loop-engineering",
    visual: "loop",
    image: "/work/loop-engineering-showcase.jpeg",
    imageAlt:
      "Loop Engineering system map showing scheduling, sub-agents, worktrees, skills, and persistent task state connected in one workflow.",
    overview: [
      { label: "Problem", value: "Long tasks lose context and test evidence can go stale" },
      { label: "Solution", value: "A bounded workflow tied to the current Git workspace" },
      { label: "What I built", value: "Resume state, code discovery, verification, and checker gates" },
      { label: "Result", value: "Workspace changes require fresh proof before completion" },
    ],
    problem: {
      statement: "Long coding tasks can lose context—and a passing test becomes unreliable after the workspace changes.",
      detail:
        "An agent needs enough saved state to resume useful work, while current files, diffs, and fresh checks must remain the source of truth.",
    },
    solution: {
      statement: "Carry each task through an explicit workflow and bind its verification to the Git workspace that was checked.",
      detail:
        "The task record stays small and inspectable. If files change after verification, the workflow marks that evidence stale and sends the task back for a fresh check.",
    },
    pipeline: [
      { title: "Start the task", detail: "Record the objective and the evidence needed to finish." },
      { title: "Save the plan", detail: "Keep the next steps small enough to inspect and resume." },
      { title: "Implement", detail: "Change the real workspace and record the files that were touched." },
      {
        title: "Run fresh checks",
        detail: "Attach real command output to the current Git workspace.",
        branch: "Files changed after the check? Verification expires and the task returns here.",
      },
      { title: "Independent check", detail: "A separate checker reviews the result and its evidence." },
      { title: "Finish", detail: "Completion is recorded only while the evidence is still current." },
    ],
    contributions: [
      {
        title: "Bounded task state and resume",
        body: "I added a task record that preserves the objective, plan, changed files, verification, and checker result without treating saved context as repository truth.",
      },
      {
        title: "Workspace freshness enforcement",
        body: "I tied successful verification to the Git workspace so tracked or untracked changes invalidate old proof before checking or finishing.",
      },
      {
        title: "Codebase discovery workflow",
        body: "I connected Codebase Memory-first discovery with targeted local confirmation, keeping the full graph outside the prompt while exact files settle decisions.",
      },
      {
        title: "Maker and checker separation",
        body: "I kept implementation and review as distinct stages so completion depends on explicit, independently examined evidence.",
      },
    ],
    results: [
      "The CLI records an implementation before it accepts verification evidence.",
      "Workspace changes after verification prevent a clean finish until the check is refreshed.",
      "The checker stage is kept separate from the implementation stage.",
      "The derivative provenance and the exact additions are documented in the repository.",
    ],
    evidenceImage: {
      src: "/work/loop-engineering-system.svg",
      alt: "Loop Engineering architecture showing codebase discovery, task state, implementation, verification, checker review, and the stale-evidence return path.",
      caption: "Expanded system view from the repository, including the path that returns changed work to verification.",
      fit: "contain",
    },
  },
  {
    slug: "stocklane",
    number: "02",
    title: "Stocklane",
    strapline: "An inventory app that prevents two orders from claiming the same stock.",
    summary:
      "Stocklane shows what is in stock, what is reserved, and what is still available. Every order is reserved completely or leaves all quantities unchanged.",
    role: "Software engineering · web application",
    date: "Jan 2026",
    category: "Inventory management application",
    stack: ["Next.js", "React", "TypeScript", "SQLite", "Zod"],
    highlights: [
      "Shows on-hand, reserved, and available stock",
      "Reserves every item in an order together—or changes nothing",
      "Updates stock when orders are completed or cancelled",
    ],
    repository: "https://github.com/Legend398/stocklane",
    visual: "stocklane",
    image: "/work/stocklane.png",
    imageAlt:
      "Stocklane inventory screen showing on-hand, reserved, and available quantities with clear low-stock and unavailable states.",
    overview: [
      { label: "Problem", value: "Competing orders can promise the same final units" },
      { label: "Solution", value: "Reserve the complete order inside one transaction" },
      { label: "What I built", value: "Interface, domain rules, SQLite workflow, and tests" },
      { label: "Result", value: "Every order reserves completely or changes nothing" },
    ],
    problem: {
      statement: "Two orders can race for the final units, creating an oversell or a half-reserved order.",
      detail:
        "Updating inventory row by row is unsafe: one line can succeed before another fails, leaving the system out of sync with what the order actually promised.",
    },
    solution: {
      statement: "Validate every line first, then reserve the complete order inside one immediate SQLite transaction.",
      detail:
        "The same domain service drives browser and JSON flows. Fulfilment consumes reserved stock; cancellation releases it back to available inventory.",
    },
    pipeline: [
      { title: "Receive the order", detail: "Collect every product and requested quantity before stock changes." },
      { title: "Validate every line", detail: "Check the product, quantity, and current available stock." },
      {
        title: "Reserve together",
        detail: "Use one immediate transaction to reserve every valid line.",
        branch: "If any line fails, the transaction rolls back and no quantity changes.",
      },
      { title: "Show reserved state", detail: "Display on-hand, reserved, and available quantities together." },
      { title: "Fulfil or cancel", detail: "Fulfilment consumes units; cancellation releases the reservation." },
    ],
    contributions: [
      {
        title: "Atomic reservation service",
        body: "I implemented the domain workflow that validates every line and reserves the complete order inside one SQLite transaction.",
      },
      {
        title: "Inventory and order interface",
        body: "I built the screens and forms that show on-hand, reserved, and available stock, then explain each order state before an action is taken.",
      },
      {
        title: "Lifecycle rules",
        body: "I encoded fulfilment, cancellation, restocking, and invalid repeat transitions so stock cannot be mutated twice by the same order action.",
      },
      {
        title: "Regression coverage",
        body: "I added integration and browser tests for rollback, final-unit competition, fulfilment, cancellation, and the visible reservation lifecycle.",
      },
    ],
    results: [
      "Integration tests cover rollback when one line is short.",
      "Last-unit tests protect against concurrent overselling.",
      "Transition tests cover reservation, fulfilment, cancellation, and invalid repeats.",
      "A Playwright flow verifies the visible reservation lifecycle in the browser.",
    ],
    evidenceImage: {
      src: "/work/stocklane-order.png",
      alt: "Stocklane order result showing two units reserved and the available quantity updated before fulfilment.",
      caption: "The order view makes the reserved state and its next valid actions visible before stock is consumed or released.",
    },
  },
  {
    slug: "credit-risk-explorer",
    number: "03",
    title: "Credit Risk Explorer",
    strapline: "An educational app that turns applicant details into an explained credit-risk estimate.",
    summary:
      "The app validates eight applicant and loan inputs, then shows a relative risk score, risk band, and review flag. It clearly labels the result as educational—not a lending decision.",
    role: "Data science · applied machine learning",
    date: "Nov 2025",
    category: "Data science and ML application",
    stack: ["Python", "XGBoost", "scikit-learn", "Streamlit", "pytest"],
    highlights: [
      "Validates all applicant and loan inputs before prediction",
      "Uses the same saved data-processing and model pipeline every time",
      "Explains the score, risk band, review flag, and product limits",
    ],
    repository: "https://github.com/Legend398/credit-risk-explorer",
    live: "https://creditrscoring.streamlit.app/",
    visual: "credit",
    image: "/work/credit-risk-dashboard-current.png",
    imageAlt:
      "Credit Risk Explorer dashboard with clearly labelled applicant and financial inputs beside the model result workspace.",
    overview: [
      { label: "Problem", value: "Frontend inputs can drift from model training" },
      { label: "Solution", value: "Validate 8 fields and reuse one saved pipeline" },
      { label: "What I built", value: "Streamlit UI, preprocessing, training, and tests" },
      { label: "Result", value: "Explained output backed by 9 behavior tests" },
    ],
    problem: {
      statement: "A model result becomes unreliable when the interface encodes inputs differently from the training pipeline.",
      detail:
        "The app also needs to reject invalid values before inference and explain the output without presenting an educational score as a lending decision.",
    },
    solution: {
      statement: "Validate all eight inputs, then run them through the same saved preprocessing and XGBoost pipeline used for evaluation.",
      detail:
        "One persisted pipeline owns category encoding and prediction. The interface turns that output into a relative score, risk band, and review signal with explicit educational framing.",
    },
    pipeline: [
      { title: "Collect 8 inputs", detail: "Capture the applicant and loan fields used during training." },
      { title: "Validate values", detail: "Reject missing, invalid, or out-of-range input before inference." },
      { title: "Apply preprocessing", detail: "Use the saved column mapping and one-hot encoding." },
      { title: "Run XGBoost", detail: "Load the evaluated pipeline and calculate relative risk." },
      { title: "Explain the output", detail: "Show the score, risk band, review flag, and educational notice." },
    ],
    contributions: [
      {
        title: "Validated Streamlit interface",
        body: "I built the form and result workspace for the eight model inputs, including clear invalid-input and missing-model states.",
      },
      {
        title: "Saved inference pipeline",
        body: "I implemented one scikit-learn pipeline for preprocessing and XGBoost so training and the live interface use the same transformations.",
      },
      {
        title: "Repeatable training and evaluation",
        body: "I created the deterministic stratified split, model training, saved artifact, and evaluation output for accuracy, ROC-AUC, and bad-credit recall.",
      },
      {
        title: "Behavior-focused tests",
        body: "I added tests for field mapping, split isolation, saved-model round trips, validation, missing artifacts, and frontend/backend agreement.",
      },
    ],
    results: [
      "A deterministic stratified 80/20 split keeps evaluation repeatable.",
      "The held-out run records 0.756 ROC-AUC and 71.7% bad-credit recall on 200 records.",
      "Nine tests cover data mapping, split isolation, saved-model round trips, validation, missing artifacts, and frontend/backend agreement.",
      "The interface labels the result as a relative educational estimate rather than an approval decision.",
    ],
    evidenceImage: {
      src: "/work/credit-risk-result.png",
      alt: "Credit Risk Explorer assessment showing a 72 out of 100 relative risk score, a high risk band, and an additional-review signal.",
      caption: "The working assessment keeps the score, risk band, review signal, and educational explanation together in one inspectable result.",
      fit: "contain",
    },
  },
] as const;

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export const capabilities = [
  {
    title: "Agentic AI engineering",
    copy: "Developer tools that understand a project, keep long tasks organized, and check their work before completion.",
  },
  {
    title: "Software engineering",
    copy: "Web applications with clear interfaces, validated inputs, dependable business rules, databases, and tested user flows.",
  },
  {
    title: "Data science",
    copy: "Data preparation, model evaluation, and interfaces that explain predictions and their limits in plain language.",
  },
] as const;

export const certificates = [
  {
    title: "AI Agents and Agentic AI Architecture in Python",
    issuer: "Vanderbilt University · Coursera",
    date: "Aug 2025",
    url: "https://coursera.org/share/c0c916d553fe7e6a7fcb97218fba584d",
  },
  {
    title: "Supervised Machine Learning: Regression and Classification",
    issuer: "DeepLearning.AI & Stanford Online · Coursera",
    date: "Nov 2024",
    url: "https://coursera.org/share/431044c97afc4385f04a9fdd0218d64a",
  },
  {
    title: "Excel Skills for Business Specialization",
    issuer: "Macquarie University · Coursera",
    date: "May 2024",
    url: "https://coursera.org/share/1009d3c01cdd68aef1addeee59c77509",
  },
  {
    title: "R Programming",
    issuer: "Johns Hopkins University · Coursera",
    date: "May 2024",
    url: "https://coursera.org/share/3e9cede70711b7fdbb69a8c01783267e",
  },
  {
    title: "Approximation Algorithms and Linear Programming",
    issuer: "University of Colorado Boulder · Coursera",
    date: "May 2024",
    url: "https://coursera.org/share/a784802d0811982b65dcb1bf90edccbb",
  },
  {
    title: "Dynamic Programming, Greedy Algorithms",
    issuer: "University of Colorado Boulder · Coursera",
    date: "Apr 2024",
    url: "https://coursera.org/share/d276b8738e8d9822625ae1b15a98f0f9",
  },
  {
    title: "Algorithms on Strings",
    issuer: "University of California San Diego · Coursera",
    date: "Feb 2024",
    url: "https://coursera.org/share/6547c68a44057688f3f313f827ca8432",
  },
] as const;
