/**
 * PDF Report Generator for Vault Sentry
 * Generates comprehensive security reports in PDF format
 */

import { Repository, Scan, Secret } from '@/services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportData {
  type: 'weekly' | 'monthly' | 'custom'
  dateRange?: { start: Date; end: Date }
  repositories?: Repository[]
  secrets?: Secret[]
  scans?: Scan[]
  summary?: {
    totalSecrets: number
    criticalCount: number
    highCount: number
    mediumCount: number
    lowCount: number
    totalScans: number
    repositoriesScanned: number
    avgRiskScore: number
  }
}

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number
  }
}

// Brand colors
const COLORS = {
  primary: [59, 130, 246] as [number, number, number], // Blue
  danger: [239, 68, 68] as [number, number, number], // Red
  warning: [245, 158, 11] as [number, number, number], // Orange
  success: [34, 197, 94] as [number, number, number], // Green
  dark: [30, 41, 59] as [number, number, number], // Slate
  light: [248, 250, 252] as [number, number, number], // Light gray
  muted: [100, 116, 139] as [number, number, number], // Muted
}

export function generateSecurityReport(data: ReportData): void {
  const doc = new jsPDF() as jsPDFWithAutoTable
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let yPosition = margin

  // Helper to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // Helper for consistent header styling
  const addSectionHeader = (title: string) => {
    checkPageBreak(20)
    doc.setFillColor(...COLORS.primary)
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 5, yPosition + 7)
    yPosition += 15
    doc.setTextColor(0, 0, 0)
  }

  // ==================== HEADER ====================
  doc.setFillColor(...COLORS.dark)
  doc.rect(0, 0, pageWidth, 45, 'F')
  
  // Logo/Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('Vault Sentry', margin, 20)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Security Analysis Report', margin, 30)
  
  // Report Type Badge
  const reportTypeText = data.type.charAt(0).toUpperCase() + data.type.slice(1) + ' Report'
  doc.setFontSize(10)
  doc.setFillColor(...COLORS.primary)
  const badgeWidth = doc.getTextWidth(reportTypeText) + 10
  doc.roundedRect(pageWidth - margin - badgeWidth, 15, badgeWidth, 8, 2, 2, 'F')
  doc.text(reportTypeText, pageWidth - margin - badgeWidth + 5, 21)

  // Date info
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  const now = new Date()
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, pageWidth - margin - 80, 35)

  yPosition = 55

  // ==================== EXECUTIVE SUMMARY ====================
  addSectionHeader('Executive Summary')
  
  if (data.summary) {
    const summaryBoxWidth = (pageWidth - 2 * margin - 15) / 4
    const summaryBoxHeight = 30
    const summaryItems = [
      { label: 'Total Secrets', value: data.summary.totalSecrets.toString(), color: COLORS.primary },
      { label: 'Critical', value: data.summary.criticalCount.toString(), color: COLORS.danger },
      { label: 'High Risk', value: data.summary.highCount.toString(), color: COLORS.warning },
      { label: 'Risk Score', value: data.summary.avgRiskScore.toString() + '%', color: COLORS.muted },
    ]

    summaryItems.forEach((item, index) => {
      const x = margin + index * (summaryBoxWidth + 5)
      doc.setFillColor(...COLORS.light)
      doc.roundedRect(x, yPosition, summaryBoxWidth, summaryBoxHeight, 3, 3, 'F')
      
      doc.setTextColor(...item.color)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(item.value, x + summaryBoxWidth / 2, yPosition + 15, { align: 'center' })
      
      doc.setTextColor(...COLORS.muted)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(item.label, x + summaryBoxWidth / 2, yPosition + 24, { align: 'center' })
    })

    yPosition += summaryBoxHeight + 15
  }

  // Additional Summary Stats
  if (data.summary) {
    doc.setTextColor(...COLORS.dark)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    const stats = [
      `Total Scans Completed: ${data.summary.totalScans}`,
      `Repositories Monitored: ${data.summary.repositoriesScanned}`,
      `Medium Risk Findings: ${data.summary.mediumCount}`,
      `Low Risk Findings: ${data.summary.lowCount}`,
    ]
    
    stats.forEach((stat, i) => {
      if (i % 2 === 0) {
        doc.text(stat, margin, yPosition)
      } else {
        doc.text(stat, pageWidth / 2, yPosition)
        yPosition += 7
      }
    })
    yPosition += 10
  }

  // ==================== SECRETS BREAKDOWN ====================
  checkPageBreak(80)
  addSectionHeader('Secrets by Severity')

  if (data.secrets && data.secrets.length > 0) {
    // Severity distribution table
    const severityCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    
    data.secrets.forEach(secret => {
      const level = secret.risk_level || 'low'
      if (severityCounts[level] !== undefined) {
        severityCounts[level]++
      }
    })

    autoTable(doc, {
      startY: yPosition,
      head: [['Severity', 'Count', 'Percentage', 'Status']],
      body: [
        ['Critical', severityCounts.critical.toString(), ((severityCounts.critical / data.secrets.length) * 100).toFixed(1) + '%', '⚠️ Immediate Action Required'],
        ['High', severityCounts.high.toString(), ((severityCounts.high / data.secrets.length) * 100).toFixed(1) + '%', '⚡ Action Required'],
        ['Medium', severityCounts.medium.toString(), ((severityCounts.medium / data.secrets.length) * 100).toFixed(1) + '%', '📋 Review Recommended'],
        ['Low', severityCounts.low.toString(), ((severityCounts.low / data.secrets.length) * 100).toFixed(1) + '%', 'ℹ️ Informational'],
      ],
      theme: 'striped',
      headStyles: { fillColor: COLORS.dark, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
    })

    yPosition = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPosition + 50
  }

  // ==================== DETAILED FINDINGS ====================
  checkPageBreak(100)
  addSectionHeader('Detailed Findings')

  if (data.secrets && data.secrets.length > 0) {
    // Take top 20 secrets for the report
    const topSecrets = data.secrets.slice(0, 20)
    
    const secretsTableData = topSecrets.map(secret => [
      secret.type || 'Unknown',
      (secret.risk_level || 'low').toUpperCase(),
      secret.file_path || 'N/A',
      (secret.line_number || 0).toString(),
      secret.repository_name || 'N/A',
      (secret.status || 'open').replace('_', ' ').toUpperCase(),
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Secret Type', 'Severity', 'File Path', 'Line', 'Repository', 'Status']],
      body: secretsTableData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 50 },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 30 },
        5: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 1 && hookData.section === 'body') {
          const value = hookData.cell.raw?.toString().toLowerCase()
          if (value === 'critical') hookData.cell.styles.textColor = COLORS.danger
          else if (value === 'high') hookData.cell.styles.textColor = COLORS.warning
          else if (value === 'medium') hookData.cell.styles.textColor = [245, 158, 11]
          else hookData.cell.styles.textColor = COLORS.success
        }
      },
    })

    yPosition = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPosition + 100

    if (data.secrets.length > 20) {
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.muted)
      doc.text(`Showing 20 of ${data.secrets.length} findings. See full report in dashboard.`, margin, yPosition)
      yPosition += 10
    }
  } else {
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.success)
    doc.text('✓ No secrets detected in the current scan period.', margin, yPosition)
    yPosition += 15
  }

  // ==================== REPOSITORY HEALTH ====================
  checkPageBreak(80)
  addSectionHeader('Repository Health')

  if (data.repositories && data.repositories.length > 0) {
    const repoTableData = data.repositories.slice(0, 15).map(repo => [
      repo.name || 'Unknown',
      repo.branch || 'main',
      (repo.secrets_count || 0).toString(),
      (repo.risk_score || 0).toString() + '%',
      (repo.status || 'active').toUpperCase(),
      repo.last_scan ? new Date(repo.last_scan).toLocaleDateString() : 'Never',
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Repository', 'Branch', 'Secrets', 'Risk Score', 'Status', 'Last Scan']],
      body: repoTableData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.dark, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 3 && hookData.section === 'body') {
          const value = parseInt(hookData.cell.raw?.toString() || '0')
          if (value >= 80) hookData.cell.styles.textColor = COLORS.danger
          else if (value >= 60) hookData.cell.styles.textColor = COLORS.warning
          else hookData.cell.styles.textColor = COLORS.success
        }
      },
    })

    yPosition = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPosition + 80
  }

  // ==================== SCAN HISTORY ====================
  checkPageBreak(80)
  addSectionHeader('Recent Scan History')

  if (data.scans && data.scans.length > 0) {
    const scanTableData = data.scans.slice(0, 10).map(scan => [
      scan.repository_name || 'Unknown',
      (scan.status || 'pending').toUpperCase(),
      (scan.secrets_found || 0).toString(),
      (scan.files_scanned || 0).toString(),
      scan.duration || 'N/A',
      scan.started_at ? new Date(scan.started_at).toLocaleDateString() : 'N/A',
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Repository', 'Status', 'Secrets Found', 'Files Scanned', 'Duration', 'Date']],
      body: scanTableData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    })

    yPosition = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPosition + 60
  }

  // ==================== RECOMMENDATIONS ====================
  checkPageBreak(60)
  addSectionHeader('Recommendations')

  const recommendations = [
    '1. Rotate all critical and high-severity secrets immediately',
    '2. Enable automatic secret rotation for supported providers (AWS, Stripe, GitHub)',
    '3. Review and update .gitignore files to prevent future leaks',
    '4. Implement pre-commit hooks to block secrets before they reach the repository',
    '5. Enable Slack/email notifications for immediate alerts on new findings',
    '6. Schedule regular security audits and scanning cycles',
  ]

  doc.setFontSize(9)
  doc.setTextColor(...COLORS.dark)
  recommendations.forEach((rec, i) => {
    checkPageBreak(10)
    doc.text(rec, margin, yPosition)
    yPosition += 8
  })

  // ==================== FOOTER ====================
  const pageCount = (doc as any).getNumberOfPages() as number
  for (let i = 1; i <= pageCount; i++) {
    (doc as any).setPage(i)
    doc.setFillColor(...COLORS.light)
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F')
    
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Vault Sentry - Confidential Security Report', margin, pageHeight - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 6)
  }

  // Save the PDF
  const filename = `secret-sentry-${data.type}-report-${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// Quick report generation from dashboard data
export function generateQuickReport(
  secrets: Secret[],
  repositories: Repository[],
  scans: Scan[],
  reportType: 'weekly' | 'monthly' | 'custom' = 'weekly'
): void {
  // Ensure we have arrays to work with
  const safeSecrets = secrets || []
  const safeRepos = repositories || []
  const safeScans = scans || []
  
  const criticalCount = safeSecrets.filter(s => s.risk_level === 'critical').length
  const highCount = safeSecrets.filter(s => s.risk_level === 'high').length
  const mediumCount = safeSecrets.filter(s => s.risk_level === 'medium').length
  const lowCount = safeSecrets.filter(s => s.risk_level === 'low' || s.risk_level === 'info').length
  
  const avgRiskScore = safeRepos.length > 0
    ? Math.round(safeRepos.reduce((sum, r) => sum + (r.risk_score || 0), 0) / safeRepos.length)
    : 0

  const reportData: ReportData = {
    type: reportType,
    repositories: safeRepos,
    secrets: safeSecrets,
    scans: safeScans,
    summary: {
      totalSecrets: safeSecrets.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      totalScans: safeScans.length,
      repositoriesScanned: safeRepos.length,
      avgRiskScore,
    },
  }

  generateSecurityReport(reportData)
}
