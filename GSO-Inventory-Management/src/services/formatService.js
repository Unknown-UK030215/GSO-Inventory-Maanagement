// Shared money formatting used across the dashboards, registers and reports.

// Full peso amount, e.g. ₱1,234.56
export const peso = value =>
    '₱' + Number(value || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

// Compact peso amount for KPI cards, e.g. ₱1.23M
export const pesoShort = value => {
    const v = Number(value || 0);
    if (v >= 1e9) return '₱' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '₱' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '₱' + (v / 1e3).toFixed(1) + 'K';
    return '₱' + v.toFixed(2);
};
