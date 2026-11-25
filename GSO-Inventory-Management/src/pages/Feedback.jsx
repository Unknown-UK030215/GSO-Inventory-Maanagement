import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useFeedback } from '../context/FeedbackContext';

const KINDS = [
    { id: 'bug', name: 'Bug / System Issue' },
    { id: 'feedback', name: 'Feedback / Suggestion' }
];

export default function Feedback() {
    const { user } = useAuth();
    const { feedback, submitFeedback } = useFeedback();
    const location = useLocation();

    const [kind, setKind] = useState('bug');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const mine = feedback.filter(item => item.submittedBy === user?.username);

    function handleSubmit(event) {
        event.preventDefault();
        try {
            submitFeedback({ kind, subject, message, page: location.pathname });
            setSubject('');
            setMessage('');
            setError('');
            setNotice('Thank you. Your report was sent to the super administrator.');
        } catch (err) {
            setNotice('');
            setError(err.message);
        }
    }

    return (
        <>
            <PageHeader
                title="Feedback & Bug Report"
                description="Report a system bug or send feedback. Every report is forwarded to the super administrator."
            />

            <div className="split">
                <article className="panel">
                    <h3>Send a Report</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                            <label>
                                Report Type
                                <select value={kind} onChange={event => setKind(event.target.value)}>
                                    {KINDS.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Subject
                                <input
                                    value={subject}
                                    onChange={event => setSubject(event.target.value)}
                                    placeholder="Short summary of the issue"
                                    required
                                />
                            </label>
                            <label className="span-2">
                                Details
                                <textarea
                                    value={message}
                                    onChange={event => setMessage(event.target.value)}
                                    placeholder="Describe the bug you encountered or the feedback you want to share"
                                    required
                                />
                            </label>
                        </div>
                        <div className="actions">
                            <button type="submit">Send Report</button>
                        </div>
                        {error && <p className="form-status error" role="alert">{error}</p>}
                        {notice && <p className="form-status success" role="status">{notice}</p>}
                    </form>
                </article>

                <article className="panel">
                    <h3>My Reports</h3>
                    <p className="result-count">{mine.length} report{mine.length === 1 ? '' : 's'} sent</p>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr><th>Date</th><th>Type</th><th>Subject</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {mine.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.date}</td>
                                        <td>{item.kind === 'bug' ? 'Bug' : 'Feedback'}</td>
                                        <td>{item.subject}</td>
                                        <td>{item.status}</td>
                                    </tr>
                                ))}
                                {!mine.length && (
                                    <tr><td colSpan="4">You have not sent any reports yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>
        </>
    );
}
