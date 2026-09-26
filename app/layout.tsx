import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '지니 보이스 · 말로 만드는 SNS', description: '말로 시작하고, 내 사진으로 만들고, 확인 후 공유하는 콘텐츠 스튜디오.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="ko"><body>{children}</body></html>; }
