// web/app/layout.tsx
"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Determine active nav item based on current path
  const isPortfolio = pathname === "/" || pathname?.startsWith("/portfolio");
  const isProjects = pathname?.startsWith("/projects");
  const isAnalytics = pathname?.startsWith("/analytics");

  return (
    <html lang="en">
      <head>
        <title>Construction Risk Radar</title>
        <meta name="description" content="Construction Risk Radar MVP" />
      </head>
      <body>
        <div className="app-shell">
          {/* Navigation */}
          <nav className="nav">
            <Link href="/" className="logo">
              Construction Risk Radar
            </Link>
            <div className="navLinks">
              <Link href="/" className={isPortfolio ? "active" : ""}>
                Portfolio
              </Link>
              <Link href="/projects" className={isProjects ? "active" : ""}>
                Projects
              </Link>
              <Link href="/analytics" className={isAnalytics ? "active" : ""}>
                Analytics
              </Link>
              <div className="userBadge">MVP</div>
            </div>
          </nav>
          
          {/* Page Content */}
          {children}
        </div>
      </body>
    </html>
  );
}