import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Focus — A Living 2.5D Productivity Sanctuary',
  description:
    'Focus transforms everyday goals into a persistent, procedurally generated 2.5D nature world—and helps you find your next step when plans change.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
