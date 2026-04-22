import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandantenbuchhaltung',
  description: 'Modulare mandantenfähige Buchhaltungssoftware',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
