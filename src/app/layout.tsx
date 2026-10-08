import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SeasonProvider } from '@/contexts/SeasonContext';

export const metadata: Metadata = {
  title: 'FFI ERP',
  description: 'Production-ready ERP dashboard system powered by FFI.',
  icons: {
    icon: '/FFI_main_ico.ico',
    shortcut: '/FFI_main_ico.ico',
    apple: '/FFI_main.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                function isFirestoreAssertion(s) {
                  if (!s) return false;
                  try {
                    var str = typeof s === 'string' ? s : (s.stack || s.message || JSON.stringify(s) || '');
                    return str.indexOf('INTERNAL ASSERTION FAILED') !== -1 ||
                           str.indexOf('ID: ca9') !== -1 ||
                           str.indexOf('ID: b815') !== -1 ||
                           str.indexOf('"ve":-1') !== -1 ||
                           str.indexOf('ve: -1') !== -1 ||
                           (str.indexOf('Unexpected state') !== -1 && (str.indexOf('ca9') !== -1 || str.indexOf('b815') !== -1));
                  } catch (e) {
                    return false;
                  }
                }

                var origConsoleError = console.error;
                console.error = function() {
                  for (var i = 0; i < arguments.length; i++) {
                    if (isFirestoreAssertion(arguments[i])) {
                      return;
                    }
                  }
                  return origConsoleError.apply(console, arguments);
                };

                window.addEventListener('error', function(e) {
                  if (isFirestoreAssertion(e.error) || isFirestoreAssertion(e.message)) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    return true;
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  if (isFirestoreAssertion(e.reason)) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    return true;
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthProvider>
            <SeasonProvider>
              {children}
              <Toaster />
            </SeasonProvider>
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
