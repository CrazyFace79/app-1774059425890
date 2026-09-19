import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "vDAMM MUSIC — Vdamm DJ Generator Pro",
  description: "Generate, edit, validate and export Eurodance remember 2000s lyrics and Suno/Udio prompts",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          {children}
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
