import "./styles.css"
import { Toaster } from "react-hot-toast"
import { Providers } from "./providers"

export const metadata = {
  title: "TheVaultSentry — DevSecOps Secret Detection Platform",
  description: "Detect exposed secrets, scan repositories, triage findings, and manage your security posture with TheVaultSentry.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: "text-sm",
            style: {
              background: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  )
}
