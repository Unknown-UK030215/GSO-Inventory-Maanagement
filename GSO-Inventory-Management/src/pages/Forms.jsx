import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useInventory } from '../context/InventoryContext';

import { FORMS, exportForm, formRecordCount } from '../services/formService';
import { ASSET_FORMS } from '../data/assetForms';

// Resolve the registration form(s) that feed an export template.
function sourceLabel(formType) {
    if (!formType) return 'All records';

    const ids = Array.isArray(formType) ? formType : [formType];
    const short = ids.map(id => ASSET_FORMS.find(f => f.id === id)?.short || id);
    return short.join(' / ');
}

// ========================================
// GOVERNMENT FORMS / TEMPLATES
// ========================================
export default function Forms() {

    const { assets } = useInventory();
    const [busy, setBusy] = useState('');

    // ------------------------------------
    // EXPORT A FORM TO .XLSX
    // ------------------------------------
    async function download(id) {
        try {
            setBusy(id);
            await exportForm(id, assets);
        } catch (err) {
            alert(err.message);
        } finally {
            setBusy('');
        }
    }

    return (
        <>
            <PageHeader
                title="Government Forms"
                description="Export the official GSO/COA property forms as print-ready Excel (.xlsx) files."
            />

            <article className="panel">

                <p className="result-count">
                    Source records: {assets.length} asset
                    {assets.length === 1 ? '' : 's'} in the register.
                    Each form below only prints the records filed under its own
                    registration type. Files use A4 paper, fit to one page wide,
                    and are ready to print.
                </p>

                <div className="form-list">

                    {FORMS.map(form => {

                        const count = formRecordCount(form.id, assets);
                        const empty = count === 0;

                        return (

                            <div className="form-item" key={form.id}>

                                <div className="form-meta">
                                    <b>{form.name}</b>
                                    <small>{form.note}</small>
                                    <small className="form-source">
                                        Registration form: {sourceLabel(form.formType)} ·{' '}
                                        <b>{count}</b> record{count === 1 ? '' : 's'}
                                    </small>
                                </div>

                                <button
                                    onClick={() => download(form.id)}
                                    disabled={busy === form.id || empty}
                                >
                                    {busy === form.id
                                        ? 'Generating…'
                                        : empty
                                            ? 'No records'
                                            : 'Download .xlsx'}
                                </button>

                            </div>
                        );
                    })}

                </div>

            </article>
        </>
    );
}
