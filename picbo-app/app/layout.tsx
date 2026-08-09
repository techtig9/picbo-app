import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Picbo.ai — Backend (testing)",
  description: "Real backend API for Picbo.ai — see /docs/DEPLOY_VERCEL.md and README.md",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
