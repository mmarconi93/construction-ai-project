// web/app/ui/TopNav.tsx
import Link from "next/link";

export default function TopNav({ active }: { active: "portfolio" | "projects" | "analytics" }) {
  return (
    <nav className="nav">
      <div className="logo">Construction Risk Radar</div>

      <div className="navLinks">
        <Link className={active === "portfolio" ? "active" : ""} href="/portfolio">
          Portfolio
        </Link>
        <Link className={active === "projects" ? "active" : ""} href="/projects">
          Projects
        </Link>
        <Link className={active === "analytics" ? "active" : ""} href="/analytics">
          Analytics
        </Link>

        <div className="userBadge">MVP</div>
      </div>
    </nav>
  );
}
