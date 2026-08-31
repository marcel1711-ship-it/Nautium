import { MaintenanceTask, InventoryItem } from '../types';

export const calculateDaysUntilDue = (dueDate: string): number => {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getTaskStatusColor = (status: string): string => {
  switch (status) {
    case 'overdue':
      return 'text-red-600 bg-red-50';
    case 'due_soon':
      return 'text-orange-600 bg-orange-50';
    case 'upcoming':
      return 'text-blue-600 bg-blue-50';
    case 'completed':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const getTaskStatusBadge = (status: string): string => {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due Soon';
    case 'upcoming':
      return 'Upcoming';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
      return 'text-red-700 bg-red-100';
    case 'high':
      return 'text-orange-700 bg-orange-100';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100';
    case 'low':
      return 'text-green-700 bg-green-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const isLowStock = (item: InventoryItem): boolean => {
  return item.current_stock <= item.minimum_stock;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const downloadCSV = (rows: string[][], filename: string): void => {
  const csv = rows
    .map(row => row.map(cell => {
      const str = String(cell ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadPDF = async (html: string, filename: string): Promise<void> => {
  const html2pdf = (await import('html2pdf.js')).default;
  const pdfFilename = filename.replace(/\.html$/i, '.pdf');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1100px';
  iframe.style.height = '900px';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise(r => setTimeout(r, 300));

  await html2pdf().set({
    margin: [5, 5, 5, 5],
    filename: pdfFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }).from(doc.body).save();

  document.body.removeChild(iframe);
};

export const sortTasksByUrgency = (tasks: MaintenanceTask[]): MaintenanceTask[] => {
  return [...tasks].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (a.status !== 'overdue' && b.status === 'overdue') return 1;

    const daysA = calculateDaysUntilDue(a.next_due_date);
    const daysB = calculateDaysUntilDue(b.next_due_date);

    return daysA - daysB;
  });
};
