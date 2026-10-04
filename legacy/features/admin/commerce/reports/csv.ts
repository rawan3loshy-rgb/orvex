/** Client-side CSV generation + download (no server round-trip needed). */
export type CsvCell = string | number | boolean | null | undefined

function escapeCell(v: CsvCell) {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: CsvCell[][]) {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, content: string) {
  // BOM so spreadsheet apps detect UTF-8 (em dashes, currency symbols…).
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** yyyy-mm-dd in local time, for file names. */
export function fileDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
