import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '보이스그램 · 말로 만드는 나의 이야기', description: '말이나 글로 이야기를 만들고, 피드에서 서로의 일상을 나누는 보이스그램.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="ko"><body>{children}</body></html>; }
