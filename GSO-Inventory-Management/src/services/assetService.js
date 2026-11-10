export function validateAsset(a) {
    if (a.formType === 'road-inventory') {
        if (!a.location?.trim()) throw Error('Barangay is required');
        if (!a.roadClass) throw Error('Road classification is required');
        if (!a.roadName?.trim()) throw Error('Road network name is required');
        if (!Number.isFinite(Number(a.roadLength)) || Number(a.roadLength) <= 0) {
            throw Error('Road length must be greater than zero');
        }
        if (!a.surfaceType) throw Error('Road surface type is required');

        for (const [field, label] of [
            ['surfaceLength', 'Surface segment length'],
            ['surfaceWidth', 'Surface width'],
            ['surfaceThickness', 'Surface thickness/height']
        ]) {
            if (a[field] !== '' && a[field] != null && (!Number.isFinite(Number(a[field])) || Number(a[field]) < 0)) {
                throw Error(`${label} must be zero or greater`);
            }
        }

        if (a.surfacePercent !== '' && a.surfacePercent != null) {
            const share = Number(a.surfacePercent);
            if (!Number.isFinite(share) || share < 0 || share > 100) {
                throw Error('Surface share must be between 0 and 100 percent');
            }
        }

        return true;
    }

    if (!a.propertyNo?.trim()) throw Error('Property number is required');
    if (!a.description?.trim()) throw Error('Description is required');
    if (Number(a.quantity) < 1) throw Error('Quantity must be at least one');
    return true;
}

// Unit value rule: ₱50,000 and above → Expendable, below → Semi-Expendable.
export const UNIT_VALUE_THRESHOLD=50000;

export function classifyByCost(cost){return Number(cost)>=UNIT_VALUE_THRESHOLD?'Expendable':'Semi-Expendable'}

// Property numbers are issued automatically as YYYY-MM-#### — the
// sequence restarts every month and continues from the highest number
// already on record for that month.
export function nextPropertyNo(assets, date = new Date()) {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-`;

    const used = (assets || [])
        .map(a => String(a.propertyNo || ''))
        .filter(no => no.startsWith(prefix))
        .map(no => Number(no.slice(prefix.length)))
        .filter(Number.isFinite);

    const next = (used.length ? Math.max(...used) : 0) + 1;

    return prefix + String(next).padStart(4, '0');
}

export function filterAssets(rows,q,classification){return rows.filter(a=>(!classification||classification==='All'||a.classification===classification)&&[a.propertyNo,a.description,a.department,a.category].join(' ').toLowerCase().includes(q.toLowerCase()))}

export function sortAssets(rows,key='propertyNo',dir='asc'){return[...rows].sort((a,b)=>{const x=a[key]??'',y=b[key]??'';const r=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'});return dir==='desc'?-r:r})}

export function groupAssets(rows,key){const m=new Map();for(const r of rows){const g=r[key]||'Unspecified';if(!m.has(g))m.set(g,[]);m.get(g).push(r)}return[...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))}
