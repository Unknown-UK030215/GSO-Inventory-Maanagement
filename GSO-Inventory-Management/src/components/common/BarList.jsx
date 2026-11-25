// Horizontal bar list shared by the dashboard analytics panels.
// Renders a bare list by default, or wraps it in a titled panel when a title is given.
export default function BarList({ title, rows, total, tone }) {
    const body = (
        <>
            {!rows.length && <p>No records yet.</p>}
            {rows.map(([label, value]) => (
                <div className="bar-row" key={label}>
                    <span className="bar-label" title={label}>{label}</span>
                    <div className="bar-track">
                        <div
                            className="bar-fill"
                            style={{
                                width: total ? `${(value / total) * 100}%` : 0,
                                background: tone
                            }}
                        />
                    </div>
                    <b className="bar-value">{value}</b>
                </div>
            ))}
        </>
    );

    if (!title) return body;

    return (
        <article className="panel">
            <h3>{title}</h3>
            {body}
        </article>
    );
}
