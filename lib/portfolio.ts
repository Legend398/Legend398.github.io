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
  evidence: readonly {
    label: string;
    value: string;
  }[];
  problem: string;
  constraints: readonly string[];
  decisions: readonly {
    title: string;
    body: string;
  }[];
  verification: readonly string[];
  tradeoffs: readonly string[];
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
    evidence: [
      { label: "Problem", value: "Agents can finish without fresh proof" },
      { label: "Constraint", value: "State must stay bounded and inspectable" },
      { label: "Decision", value: "Bind evidence to the Git workspace" },
      { label: "Proof", value: "File changes block completion until tests are run again" },
    ],
    problem:
      "Long-running coding work loses context, while a green test result can become stale the moment the workspace changes. A useful agent loop needs continuity without treating saved state as truth.",
    constraints: [
      "Current files, diffs, and tests remain authoritative.",
      "Resume state must be small enough to inspect instead of becoming a second hidden memory system.",
      "Verification must represent the workspace that was actually checked.",
      "A checker should see explicit evidence before completion is recorded.",
    ],
    decisions: [
      {
        title: "Model the work as explicit states",
        body: "The added task path moves through task, plan, implementation, verification, checker review, and finish. Failed evidence returns to implementation instead of being narrated away.",
      },
      {
        title: "Make proof expire",
        body: "Successful verification is associated with the Git workspace. Tracked or untracked changes after verification make the old evidence stale and require a new check.",
      },
      {
        title: "Keep discovery outside the prompt",
        body: "Codebase Memory supplies compact architecture and targeted graph evidence; exact local files and tests still settle the decision.",
      },
    ],
    verification: [
      "The CLI records an implementation before it accepts verification evidence.",
      "Workspace changes after verification prevent a clean finish until the check is refreshed.",
      "The checker stage is kept separate from the implementation stage.",
      "The derivative provenance and the exact additions are documented in the repository.",
    ],
    tradeoffs: [
      "The task ledger is intentionally bounded; it does not try to preserve an entire conversation.",
      "Workspace signatures improve freshness but do not replace meaningful tests.",
      "This work extends an upstream project and is presented as contribution work, not sole authorship of the ecosystem.",
    ],
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
    evidence: [
      { label: "Problem", value: "Two orders can promise the same stock" },
      { label: "Constraint", value: "A partial reservation is invalid" },
      { label: "Decision", value: "One atomic SQLite transaction" },
      { label: "Proof", value: "Tests cover failed orders and competition for the final item" },
    ],
    problem:
      "Inventory looks simple until two orders race for the final units. Updating rows one by one can leave a half-reserved order or oversell what the stockroom actually has.",
    constraints: [
      "Available stock is always on-hand minus reserved stock.",
      "Every order line must be valid before any quantity changes.",
      "Fulfilment and cancellation need explicit, reversible state transitions.",
      "The browser flow and JSON mutations must call the same domain rules.",
    ],
    decisions: [
      {
        title: "Own the transaction in the domain service",
        body: "Order creation starts an immediate transaction, reads lines in deterministic order, validates every requested quantity, and commits only when the complete order can be reserved.",
      },
      {
        title: "Keep inventory math visible",
        body: "The interface presents on-hand, reserved, and available values together so users can understand why a quantity changed after each order action.",
      },
      {
        title: "Encode terminal states",
        body: "Completing an order consumes reserved units; cancelling releases them. Invalid repeat transitions are rejected instead of silently mutating data twice.",
      },
    ],
    verification: [
      "Integration tests cover rollback when one line is short.",
      "Last-unit tests protect against concurrent overselling.",
      "Transition tests cover reservation, fulfilment, cancellation, and invalid repeats.",
      "A Playwright flow verifies the visible reservation lifecycle in the browser.",
    ],
    tradeoffs: [
      "SQLite is appropriate for a focused single-process demonstration, not a claim of distributed inventory at warehouse scale.",
      "Accounts, payments, shipping, and suppliers are intentionally excluded so the reservation invariant remains easy to audit.",
      "A hosted version would require authentication, idempotency keys, and deployment-aware database choices.",
    ],
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
    image: "/work/credit-risk-dashboard-scored.png",
    imageAlt:
      "Credit Risk Explorer dashboard with clearly labelled applicant and financial inputs beside the model result workspace.",
    evidence: [
      { label: "Problem", value: "Training and inference can drift" },
      { label: "Constraint", value: "Small, imbalanced educational data" },
      { label: "Decision", value: "Save one preprocessing + model pipeline" },
      { label: "Proof", value: "9 tests · 0.756 ROC-AUC · 71.7% bad-credit recall" },
    ],
    problem:
      "A model demo is easy to make impressive and easy to make inconsistent. If the frontend encodes inputs differently from training—or hides invalid data—the score stops meaning what the evaluation measured.",
    constraints: [
      "The UCI South German Credit dataset contains 1,000 records.",
      "The target is imbalanced, so accuracy alone is not a useful evaluation story.",
      "The interface must reject invalid or incomplete inputs before inference.",
      "The application is educational and must not present a score as a lending decision.",
    ],
    decisions: [
      {
        title: "Persist the whole inference pipeline",
        body: "The same fitted preprocessing and XGBoost pipeline used during evaluation is loaded for the interface, reducing the chance that categories or numerical transformations drift.",
      },
      {
        title: "Prefer useful error states",
        body: "Missing-model and invalid-input conditions produce clear errors rather than a plausible-looking fallback score.",
      },
      {
        title: "Report more than accuracy",
        body: "The documented held-out result includes ROC-AUC and bad-credit recall alongside the split and sample size, keeping the limits of the experiment visible.",
      },
    ],
    verification: [
      "A deterministic stratified 80/20 split keeps evaluation repeatable.",
      "The held-out run records 0.756 ROC-AUC and 71.7% bad-credit recall on 200 records.",
      "Nine tests cover data mapping, split isolation, saved-model round trips, validation, missing artifacts, and frontend/backend agreement.",
      "The interface labels the result as a relative educational estimate rather than an approval decision.",
    ],
    tradeoffs: [
      "The dataset is too small and narrow for production underwriting.",
      "The metrics describe one held-out educational experiment, not external validation or business impact.",
      "A real lending system would need governance, bias testing, monitoring, calibration, privacy controls, and human review.",
    ],
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
