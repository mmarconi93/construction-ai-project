// web/app/layout.tsx
import "./global.css";

export const metadata = {
  title: "Construction Risk Radar",
  description: "Construction Risk Radar MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}