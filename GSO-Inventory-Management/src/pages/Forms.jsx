import { useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useInventory } from '../context/InventoryContext';

import { FORMS, exportForm, formRecordCount } from '../services/formService';
import { ADMIN_FORM_ROLES, ASSET_FORMS, FORM_OWNER_GROUPS, formTypeOwnerGroup } from '../data/assetForms';

// Resolve the registration form(s) that feed an export template.
function sourceLabel(formType) {
    if (!formType) return 'All records';

    const ids = Array.isArray(formType) ? formType : [formType];
    const short = ids.map(id => ASSET_FORMS.find(f => f.id === id)?.short || id);
    return short.join(' / ');
}

const ownerGroupLabel = groupId =>
    FORM_OWNER_GROUPS.find(group => group.id === groupId)?.label || 'Inventory Staff';

// The records a template would actually print — the same type filter the
// export uses, so the count and the "filed by" list line up with the file.
function recordsFor(formType, records) {
    if (!formType) return records;

    const ids = Array.isArray(formType) ? formType : [formType];
    return records.filter(record => ids.includes(record.formType || 'general'));
}

// Distinct accounts that filed records for a template, by the username they
// registered — so the admin can see who input a form's data at a glance.
function filersFor(formType, records) {
    const seen = new Map();
    recordsFor(formType, records).forEach(record => {
        if (record.registeredBy) {
            seen.set(record.registeredBy, record.registeredByName || record.registeredBy);
        }
    });
    return [...seen.values()];
}

// ========================================
// GOVERNMENT FORMS / TEMPLATES
// ========================================
export default function Forms() {

    const { allAssets } = useInventory();
    const { user } = useAuth();
    const [busy, setBusy] = useState('');

    const isAdmin = ADMIN_FORM_ROLES.includes(user?.role);

    // Form locator shortcut: pick a role ("location") to see only that
    // role's forms. Admins start on "All forms"; everyone else starts on
    // the forms their own role owns.
    const [owner, setOwner] = useState(() => {
        if (isAdmin) return 'all';
        return user?.role === 'warehouse' ? 'warehouse' : 'inventory';
    });

    // Administrators can jump to any role's forms (including the High Value
    // registry); every other role only ever sees its own, so admin-only
    // forms are never exposed.
    const ownerGroups = FORM_OWNER_GROUPS.filter(group => isAdmin || group.id !== 'admin');

    const visibleForms = FORMS.filter(form => {
        const group = formTypeOwnerGroup(form.formType);
        if (!isAdmin && group === 'admin') return false;
        return owner === 'all' || group === owner;
    });

    // ------------------------------------
    // EXPORT A FORM TO .XLSX
    // ------------------------------------
    async function download(id) {
        try {
            setBusy(id);
            await exportForm(id, allAssets);
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
                    Source records: {allAssets.length} asset
                    {allAssets.length === 1 ? '' : 's'} in the register.
                    Each form below only prints the records filed under its own
                    registration type. Files use A4 paper, fit to one page wide,
                    and are ready to print.
                </p>

                {/* FORM LOCATOR — jump straight to a role's forms */}
                <h3 className="section-title">Find a form by who files it</h3>
                <div className="toolbar">
                    <button
                        type="button"
                        className={owner === 'all' ? undefined : 'secondary'}
                        onClick={() => setOwner('all')}
                    >
                        All forms
                    </button>

                    {ownerGroups.map(group => (
                        <button
                            key={group.id}
                            type="button"
                            className={owner === group.id ? undefined : 'secondary'}
                            onClick={() => setOwner(group.id)}
                        >
                            {group.label}
                        </button>
                    ))}
                </div>

                <div className="form-list">

                    {visibleForms.map(form => {

                        const count = formRecordCount(form.id, allAssets);
                        const empty = count === 0;
                        const filers = filersFor(form.formType, allAssets);

                        return (

                            <div className="form-item" key={form.id}>

                                <div className="form-meta">
                                    <b>{form.name}</b>
                                    <small>{form.note}</small>
                                    <small className="form-source">
                                        Registration form: {sourceLabel(form.formType)} ·{' '}
                                        <b>{count}</b> record{count === 1 ? '' : 's'} ·{' '}
                                        {ownerGroupLabel(formTypeOwnerGroup(form.formType))}
                                    </small>
                                    <small className="form-source">
                                        Filed by:{' '}
                                        {filers.length
                                            ? filers.join(', ')
                                            : 'no records filed yet'}
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

                    {!visibleForms.length && (
                        <p className="result-count">No forms are filed by this role.</p>
                    )}

                </div>

            </article>
        </>
    );
}
