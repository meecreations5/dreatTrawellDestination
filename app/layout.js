// app/layout.js
import "./globals.css";

/* =========================
   METADATA
========================== */

export const metadata = {
  title: "DreamTrawell Destinations",
  description: "DreamTrawell Destinations App",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico"
  }
};

/* =========================
   VIEWPORT (THEME COLOR)
========================== */
export const viewport = {
  themeColor: "#2563EB"
};

/* =========================
   SERVICE WORKER REGISTER
========================== */
function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `
      }}
    />
  );
}



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* iOS PWA SUPPORT */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="Dashboard"
        />
        <link
          rel="apple-touch-icon"
          href="/icons/icon-192.png"
        />
      </head>

      <body className="bg-gray-900 min-h-screen">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
