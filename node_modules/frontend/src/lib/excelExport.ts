// Helper utility to convert array of objects to CSV/Excel downloadable file
export const exportToExcel = (data: Record<string, any>[], filename: string) => {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Extract keys for header
  const headers = Object.keys(data[0]);
  
  // Format CSV rows
  const csvRows: string[] = [];
  csvRows.push(headers.map(h => `"${h.replace(/_/g, ' ').toUpperCase()}"`).join(','));

  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
