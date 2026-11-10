import fs from 'fs';
import { FORMS, buildForm } from './src/services/formService.js';

const assets = [
    { id: 1, propertyNo: 'GSO-PPE-2026-001', description: 'Desktop Computer', classification: 'PPE', category: 'IT Equipment', quantity: 1, unit: 'Unit', cost: 42000, department: 'General Services Office', accountable: 'Juan Dela Cruz', location: 'Poblacion', condition: 'Serviceable', status: 'Assigned', remarks: '' },
    { id: 2, propertyNo: 'GSO-PPE-2026-002', description: 'Office Printer', classification: 'PPE', category: 'Office Equipment', quantity: 1, unit: 'Unit', cost: 14500, department: 'Municipal Accounting Office', accountable: 'Maria Santos', location: 'Corong-corong', condition: 'Unserviceable', status: 'Assigned', remarks: 'missing' },
    { id: 3, propertyNo: 'GSO-SE-2026-001', description: 'Office Chair', classification: 'Semi-Expendable', category: 'Furniture', quantity: 4, unit: 'Piece', cost: 3200, department: 'General Services Office', accountable: 'Pedro Reyes', location: 'Poblacion', condition: 'For Inspection', status: 'Assigned', remarks: '' }
];

const dir = 'C:/Users/ASUS VIVOBOOK/AppData/Local/Temp/formtest';
fs.mkdirSync(dir, { recursive: true });

for (const f of FORMS) {
    const wb = buildForm(f.id, assets);
    const file = dir + '/' + f.id + '.xlsx';
    await wb.xlsx.writeFile(file);
    console.log('OK  ' + f.id.padEnd(22) + ' sheets=' + wb.worksheets.length + '  -> ' + f.file);
}
console.log('TOTAL FORMS: ' + FORMS.length);
