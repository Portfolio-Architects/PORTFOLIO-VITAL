import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProviders } from "@/components/QueryProviders";

const basePath = '';

export const metadata: Metadata = {
  title: "VITAL Work Manager",
  description: "개인용 업무관리 시스템 — 업무, 예산, 재고, 미팅, 프로젝트 통합 관리",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Work Manager",
  },
};

export const viewport: Viewport = {
  themeColor: "#4A6CF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isolateExtensionElements() {
                  if (typeof document === 'undefined' || !document.body) return;
                  var extensionSelectors = [
                    '#crx-mouse-redesign-content-root',
                    '[id^="crx-mouse"]',
                    '[id^="crx_"]'
                  ];
                  for (var i = 0; i < extensionSelectors.length; i++) {
                    var els = document.querySelectorAll(extensionSelectors[i]);
                    for (var j = 0; j < els.length; j++) {
                      var el = els[j];
                      if (el.parentNode === document.body) {
                        document.documentElement.appendChild(el);
                      }
                    }
                  }
                }
                isolateExtensionElements();
                if (typeof MutationObserver !== 'undefined') {
                  var obs = new MutationObserver(function() {
                    isolateExtensionElements();
                  });
                  var target = document.body || document.documentElement;
                  obs.observe(target, { childList: true });
                  window.addEventListener('load', function() {
                    setTimeout(function() { obs.disconnect(); }, 5000);
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className="font-sans antialiased min-h-screen w-full bg-[var(--surface-canvas)] text-[var(--text-ink)]"
        suppressHydrationWarning
      >
        <QueryProviders>
          {children}
        </QueryProviders>
      </body>
    </html>
  );
}
