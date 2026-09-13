import type { Metadata } from 'next'
import React from 'react'

import '../globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AyraAgent CMS',
    template: '%s | AyraAgent CMS',
  },
  description: 'Content service for ayraagent.ai and heyayra.ai.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
