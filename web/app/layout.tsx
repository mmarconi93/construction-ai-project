// web/app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Construction Risk Radar",
  description: "Construction Risk Radar MVP",
};

function TopNav() {
  return (
    <nav className="nav">
      <Link href="/" className="logo">
        Construction Risk Radar
      </Link>
      <div className="navLinks">
        <Link href="/">Portfolio</Link>
        <Link href="/projects">Projects</Link>
        <div className="userBadge">MVP</div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}