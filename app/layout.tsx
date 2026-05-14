import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Study Buddy",
  description:
    "Plan your tests, quizzes, and assignments with an AI study assistant.",
  applicationName: "Study Buddy",
  appleWebApp: {
    capable: true,
    title: "Study Buddy",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b4b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Inline script runs before paint to apply the user's theme preference,
 * preventing a flash of the wrong theme on cold loads.
 */
const themeScript = `
(function() {
  try {
    var pref = localStorage.getItem('sb_theme');
    var resolved = pref === 'light' || pref === 'dark'
      ? pref
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
