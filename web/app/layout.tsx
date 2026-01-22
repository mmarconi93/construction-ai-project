import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Construction Risk Radar",
  description: "Weekly construction risk reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: "1px solid #e5e7eb", background: "white" }}>
          <div style={{ maxWidth: 1050, margin: "0 auto", padding: "14px 16px", display: "flex", gap: 18, alignItems: "center" }}>
            <Link href="/" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              Construction Risk Radar
            </Link>

            <nav style={{ display: "flex", gap: 14, color: "#374151" }}>
              <Link href="/portfolio">Portfolio</Link>
              <Link href="/projects">Projects</Link>
            </nav>

            <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 13 }}>
              MVP
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 1050, margin: "0 auto", padding: "22px 16px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}