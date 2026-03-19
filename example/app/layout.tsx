import type { Metadata } from 'next'
import { ThemeProvider } from './ThemeProvider'
import { SidebarLayout } from '@organisms'
import { APP_TITLE, APP_DESCRIPTION } from '@constants/ui'

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  icons: [
    { rel: 'icon', url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32', media: '(prefers-color-scheme: light)' },
    {
      rel: 'icon',
      url: '/favicon-dark.ico',
      type: 'image/x-icon',
      sizes: '32x32',
      media: '(prefers-color-scheme: dark)',
    },
    { rel: 'icon', url: '/icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
    { rel: 'icon', url: '/icon.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    { rel: 'apple-touch-icon', url: '/apple-icon.png', media: '(prefers-color-scheme: light)' },
    { rel: 'apple-touch-icon', url: '/apple-icon-dark.png', media: '(prefers-color-scheme: dark)' },
  ],
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <SidebarLayout>{children}</SidebarLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
