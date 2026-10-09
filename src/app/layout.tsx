import type { Metadata } from 'next'
import './globals.css'
import { CatalogProvider } from '@/platform/CatalogProvider'

import AppSidebar from '@/components/AppSidebar'

export const metadata: Metadata = {
  title: 'D&D 2024 Character Builder',
  description: 'A guided character builder for Dungeons & Dragons 2024',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <CatalogProvider>
          <AppSidebar />
          <div className="appShellMain">
            {children}
          </div>
        </CatalogProvider>
      </body>
    </html>
  )
}
