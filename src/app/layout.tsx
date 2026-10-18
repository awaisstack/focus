import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Focus Sanctuary — Generative 3D Spatial Productivity Realm',
  description:
    'Focus Sanctuary transforms daily goals into a living, procedurally expanding 3D medieval settlement powered by AMD ROCm open models, real-time WebGL world building, and interactive animated companions.',
  openGraph: {
    title: 'Focus Sanctuary — Generative 3D Spatial Productivity Realm',
    description:
      'Transform chaotic daily intentions into a living medieval settlement powered by AMD AI.',
    images: [
      {
        url: '/cover-image.jpg',
        width: 1920,
        height: 1080,
        alt: 'Focus Sanctuary 3D Medieval Settlement'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Focus Sanctuary — Generative 3D Spatial Productivity Realm',
    description:
      'Transform chaotic daily intentions into a living medieval settlement powered by AMD AI.',
    images: ['/cover-image.jpg']
  }
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
