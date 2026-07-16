import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans } from 'next/font/google'
import './globals.css'

const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Equipar - Controle de Transferências',
  description: 'Sistema de controle de transferências de mercadorias entre lojas - Equipar Acessórios e Latas',
  manifest: '/manifest.json',
  themeColor: '#4c1d95',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Equipar',
  },
  icons: {
    icon: '/icon-512x512.png',
    apple: '/icon-192x192.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

import { Toaster } from 'react-hot-toast'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning className={`${bebas.variable} ${dmSans.variable} font-[DM_Sans] antialiased bg-gray-50 text-slate-900 min-h-screen`}>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#18181b', // zinc-900
            color: '#fff',
            border: '1px solid #27272a', // zinc-800
          }
        }} />
        {children}
      </body>
    </html>
  )
}
