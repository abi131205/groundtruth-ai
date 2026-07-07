import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroundTruth AI - Preventive Healthcare Intelligence Command Centre",
  description: "National-level AI-First healthcare intelligence platform predicting medicine stockouts, patient surges, and clinic constraints.",
  icons: {
    icon: "/logo_mark.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
