import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_LOGO_SRC, APP_NAME, APP_TAGLINE } from "@/lib/config/brand";
import "./globals.css";
import { AuthProvider } from "./_components/auth/AuthProvider";
import { ThemeProvider } from "./_components/layout/ThemeProvider";
import { Toaster } from "sonner";
import { UndoProvider } from "./_components/ui/UndoProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  icons: {
    icon: APP_LOGO_SRC,
    apple: APP_LOGO_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
            <UndoProvider />
            <Toaster position="bottom-right" richColors closeButton />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

