export function plansToCSV(plans: any[]) {
  if (!plans || plans.length === 0) return '';
  const keys = Object.keys(plans[0]);
  const rows = [keys.join(',')];
  for (const p of plans) {
    const row = keys.map(k => {
      const v = p[k];
      if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
      return s;
    }).join(',');
    rows.push(row);
  }
  return rows.join('\n');
}

export function downloadCSV(content: string, filename = 'export.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function budgetLogsToCSV(logs: any[]) {
  if (!logs || logs.length === 0) return '';
  const keys = Object.keys(logs[0]);
  const rows = [keys.join(',')];
  for (const p of logs) {
    const row = keys.map(k => {
      const v = p[k];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
      return s;
    }).join(',');
    rows.push(row);
  }
  return rows.join('\n');
}

export function spendingToCSV(entries: any[]) {
  if (!entries || entries.length === 0) return '';
  const keys = Object.keys(entries[0]);
  const rows = [keys.join(',')];
  for (const e of entries) {
    const row = keys.map(k => {
      const v = e[k];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
      return s;
    }).join(',');
    rows.push(row);
  }
  return rows.join('\n');
}

export function timeUseToCSV(entries: any[]) {
  if (!entries || entries.length === 0) return '';
  const keys = Object.keys(entries[0]);
  const rows = [keys.join(',')];
  for (const e of entries) {
    const row = keys.map(k => {
      const v = e[k];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
      return s;
    }).join(',');
    rows.push(row);
  }
  return rows.join('\n');
}

export function combinedSpendingTimeCSV(spending: any[], timeUse: any[]) {
  const parts: string[] = [];
  if (spending && spending.length) {
    parts.push('--- Spending ---');
    parts.push(spendingToCSV(spending));
  } else {
    parts.push('--- Spending ---\n(no entries)');
  }
  parts.push('');
  if (timeUse && timeUse.length) {
    parts.push('--- Time Use ---');
    parts.push(timeUseToCSV(timeUse));
  } else {
    parts.push('--- Time Use ---\n(no entries)');
  }
  return parts.join('\n\n');
}

// Create a ZIP with two CSV files: spending.csv and timeuse.csv
export async function combinedSpendingTimeZIP(spending: any[], timeUse: any[]) {
  // lazy-import JSZip to keep bundle small
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('spending.csv', spendingToCSV(spending));
  zip.file('timeuse.csv', timeUseToCSV(timeUse));
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spending-time-${new Date().toISOString()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
