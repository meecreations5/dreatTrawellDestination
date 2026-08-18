// app/layout.js
import "./globals.css";
import PageTitleManager from "@/components/layout/PageTitleManager";

export const metadata = {
  title: {
    default: "Dream Trawell CRM",
    template: "%s | Dream Trawell"
  },
  description: "Dream Trawell Destinations CRM for travel-agent engagement, leads, meetings and quotations.",
  applicationName: "Dream Trawell CRM",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dream Trawell CRM"
  }
};

export const viewport = {
  themeColor: "#2563EB"
};

function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              const register = () => navigator.serviceWorker.register('/sw.js');
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(register, { timeout: 3000 });
              } else {
                setTimeout(register, 750);
              }
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
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="//firestore.googleapis.com" />
        <link rel="dns-prefetch" href="//identitytoolkit.googleapis.com" />
      </head>

      <body className="bg-gray-900 min-h-screen">
        <PageTitleManager />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
