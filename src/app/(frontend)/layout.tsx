import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { cookies } from 'next/headers'
import React from 'react'

import './styles.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'Ayra CMS',
    template: '%s · Ayra CMS',
  },
  description: 'The control room for every site’s content: what each site holds, where it came from, and what needs attention.',
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/brand/favicon-32x32.png', type: 'image/png' }], apple: '/brand/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
    { media: '(prefers-color-scheme: light)', color: '#f4f4f6' },
  ],
}

/** Dark by default (the AyraAgent look); the choice is kept in a cookie so pages never flash. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('cr-theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <html lang="en" data-theme={theme} className={`${jakarta.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-accent-fill focus:px-3 focus:py-2 focus:text-accent-fg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
