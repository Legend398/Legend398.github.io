function asUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const siteUrl = asUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? deploymentHost ?? "http://localhost:3000",
);
