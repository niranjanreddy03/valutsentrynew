"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function AuthLayout({ children, page }) {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    return () => {
      html.style.overflow = ""
      body.style.overflow = ""
    }
  }, [])

  return (
    <div className="vs-auth-root">
      {/* Navbar */}
      <nav className="vs-auth-nav">
        <Link href="/" className="vs-nav-brand">
          <span className="vs-nav-wordmark">TheVaultSentry</span>
        </Link>
      </nav>

      {/* Centered content */}
      <main className="vs-auth-main">
        <div className="vs-auth-center">
          {children}
        </div>
      </main>

      <style>{`
        .vs-auth-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(#e1e2ed 1px, transparent 1px),
            #f9f9ff;
          background-size: 24px 24px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #191c1e;
          -webkit-font-smoothing: antialiased;
          position: relative;
          overflow: hidden;
        }


        /* ── Nav ── */
        .vs-auth-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          height: 56px;
          padding: 0 24px;
          border-bottom: 1px solid #e0e3e5;
          background: rgba(250, 248, 255, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          flex-shrink: 0;
        }
        .vs-nav-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: #004ac6;
        }
        .vs-nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #004ac6;
          color: #ffffff;
        }
        .vs-nav-wordmark {
          font-family: 'Manrope', sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #191c1e;
        }

        /* ── Main ── */
        .vs-auth-main {
          position: relative;
          z-index: 5;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px 40px;
          overflow-y: auto;
        }
        .vs-auth-center {
          width: 100%;
          max-width: 420px;
        }

        /* ── Card ── */
        .vs-card {
          background: #ffffff;
          border: 1px solid #e0e3e5;
          border-radius: 12px;
          padding: 32px 28px 28px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          animation: vs-in 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes vs-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Card header ── */
        .vs-card-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .vs-shield-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #dbe1ff;
          color: #004ac6;
          margin-bottom: 16px;
        }
        .vs-card-title {
          font-size: 24px;
          font-weight: 600;
          line-height: 32px;
          letter-spacing: -0.01em;
          color: #191c1e;
          margin: 0 0 6px;
        }
        .vs-card-desc {
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          color: #505f76;
          margin: 0;
        }

        /* ── OAuth buttons ── */
        .vs-oauth-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .vs-oauth-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 42px;
          padding: 0 14px;
          border: 1px solid #e0e3e5;
          background: #ffffff;
          color: #191c1e;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .vs-oauth-btn:hover {
          border-color: #004ac6;
          background: #f2f4f6;
          box-shadow: 0 2px 8px -2px rgba(0,74,198,0.12);
        }
        .vs-oauth-btn:active { transform: scale(0.98); }
        .vs-oauth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Divider ── */
        .vs-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 0;
          color: #737686;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .vs-divider::before, .vs-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #e0e3e5;
        }

        /* ── Form fields ── */
        .vs-field {
          position: relative;
          display: grid;
          gap: 6px;
        }
        .vs-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 500;
          line-height: 16px;
          color: #434655;
        }
        .vs-input {
          width: 100%;
          height: 42px;
          padding: 0 14px;
          border: 1px solid #e0e3e5;
          border-radius: 8px;
          background: #ffffff;
          color: #191c1e;
          font-size: 14px;
          font-family: inherit;
          outline: 0;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .vs-input::placeholder { color: #c3c6d7; }
        .vs-input:hover { border-color: #c3c6d7; }
        .vs-input:focus {
          border-color: #004ac6;
          box-shadow: 0 0 0 3px rgba(0,74,198,0.1);
        }
        .vs-pwd-toggle {
          position: absolute;
          right: 12px;
          bottom: 0;
          height: 42px;
          display: flex;
          align-items: center;
          background: transparent;
          border: 0;
          color: #737686;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          padding: 0 4px;
          transition: color 0.15s;
        }
        .vs-pwd-toggle:hover { color: #004ac6; }

        /* ── Primary CTA ── */
        .vs-primary-btn {
          width: 100%;
          height: 42px;
          border: none;
          border-radius: 8px;
          background: #004ac6;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .vs-primary-btn:hover {
          background: #003ea8;
          box-shadow: 0 4px 12px -4px rgba(0,74,198,0.35);
        }
        .vs-primary-btn:active { transform: scale(0.98); }
        .vs-primary-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* ── Alert ── */
        .vs-alert {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #ffdad6;
          background: rgba(186,26,26,0.04);
          color: #ba1a1a;
          font-size: 13px;
          line-height: 1.5;
        }

        /* ── Links ── */
        .vs-link {
          color: #004ac6;
          font-weight: 600;
          text-decoration: none;
        }
        .vs-link:hover { text-decoration: underline; }

        /* ── Trust row ── */
        .vs-trust-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          animation: vs-fade 0.5s 0.2s both;
        }
        @keyframes vs-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vs-trust-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          color: #737686;
          padding: 4px 10px;
          background: #f2f4f6;
          border-radius: 999px;
          border: 1px solid #e0e3e5;
        }
        .vs-trust-chip .material-symbols-outlined {
          font-size: 14px;
          color: #004ac6;
        }

        /* ── Bottom link ── */
        .vs-bottom-text {
          text-align: center;
          margin-top: 20px;
          font-size: 14px;
          color: #737686;
          animation: vs-fade 0.5s 0.3s both;
        }

        /* ── Checkbox ── */
        .vs-checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #505f76;
          cursor: pointer;
        }
        .vs-checkbox-row input[type="checkbox"] {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          accent-color: #004ac6;
          cursor: pointer;
        }

        /* ── Strength bar ── */
        .vs-strength-bar {
          display: flex;
          gap: 4px;
          margin-top: 4px;
        }
        .vs-strength-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: #e0e3e5;
          transition: background 0.2s;
        }
        .vs-strength-label {
          font-size: 11px;
          font-weight: 600;
          margin-top: 3px;
        }

        /* ── Responsive ── */
        @media (max-width: 480px) {
          .vs-card { padding: 24px 20px 20px; }
          .vs-auth-nav { padding: 0 16px; }
          .vs-auth-main { padding: 0 16px 32px; }
        }
      `}</style>
    </div>
  )
}
