import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useInventory } from '../../context/InventoryContext';

// Fields a search term is matched against, in the order they are shown.
function matches(asset, term) {
    const haystack = [
        asset.propertyNo,
        asset.description,
        asset.serialNo,
        asset.accountable,
        asset.department,
        asset.location,
        asset.category
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return haystack.includes(term);
}

// Quick jump box (Ctrl + K). Searches the two registers and opens a record
// in the Asset Management page, so staff never have to scroll a long list.
export default function GlobalSearch() {
    const { assets, warehouseAssets } = useInventory();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const inputRef = useRef(null);

    // Open with Ctrl/Cmd + K from anywhere in the app.
    useEffect(() => {
        function handleKey(event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setTerm('');
                setOpen(value => !value);
            }
            if (event.key === 'Escape') setOpen(false);
        }

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    // Move focus into the box as soon as it opens.
    useEffect(() => {
        if (!open) return undefined;
        const id = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(id);
    }, [open]);

    const results = useMemo(() => {
        const query = term.trim().toLowerCase();
        if (!query) return [];
        return [...assets, ...warehouseAssets]
            .filter(asset => matches(asset, query))
            .slice(0, 8);
    }, [assets, warehouseAssets, term]);

    function openRecord(asset) {
        const q = asset.propertyNo || asset.description || '';
        setOpen(false);
        navigate(`/assets?q=${encodeURIComponent(q)}`);
    }

    if (!open) {
        return (
            <button
                type="button"
                className="search-trigger"
                onClick={() => setOpen(true)}
                title="Search records (Ctrl + K)"
            >
                <span aria-hidden="true">⌕</span>
                Search
                <kbd>Ctrl K</kbd>
            </button>
        );
    }

    return (
        <div className="overlay search-overlay" onMouseDown={() => setOpen(false)}>
            <div className="search-box" onMouseDown={event => event.stopPropagation()}>

                <input
                    ref={inputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search property number, description, person, office..."
                    value={term}
                    onChange={event => setTerm(event.target.value)}
                />

                {term.trim() && (
                    <div className="search-results">
                        {results.length === 0 ? (
                            <p className="search-empty">No matching record.</p>
                        ) : (
                            results.map(asset => (
                                <button
                                    key={asset.id}
                                    type="button"
                                    className="search-result"
                                    onClick={() => openRecord(asset)}
                                >
                                    <strong>{asset.propertyNo || '—'}</strong>
                                    <span>{asset.description}</span>
                                    <small>{asset.department}</small>
                                </button>
                            ))
                        )}
                    </div>
                )}

                <p className="search-hint">Press Esc to close · Enter a term to search every register</p>

            </div>
        </div>
    );
}
