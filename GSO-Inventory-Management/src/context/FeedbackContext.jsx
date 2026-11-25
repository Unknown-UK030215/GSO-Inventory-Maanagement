import { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from './useAuth';

const FeedbackContext = createContext(null);
const FEEDBACK_KEY = 'gso-feedback';

// Bug reports and feedback share one store so the super administrator sees
// every report from every user in a single queue.
let idCounter = Date.now();
const nextId = () => idCounter++;

function readFeedback() {
    try {
        const items = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

export function FeedbackProvider({ children }) {
    // Every submission is stamped with the signed-in user so the super
    // administrator can trace a report back to the account that filed it.
    const { user } = useAuth();
    const [feedback, setFeedback] = useState(readFeedback);

    useEffect(() => {
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
    }, [feedback]);

    // Any signed-in user may report a system bug or send feedback.
    const submitFeedback = ({ kind, subject, message, page }) => {
        const cleanSubject = String(subject || '').trim();
        const cleanMessage = String(message || '').trim();
        if (!cleanSubject || !cleanMessage) {
            throw new Error('Add a short subject and a description of the issue.');
        }

        const entry = {
            id: nextId(),
            date: new Date().toLocaleString(),
            kind: kind === 'bug' ? 'bug' : 'feedback',
            subject: cleanSubject,
            message: cleanMessage,
            page: page || '',
            submittedBy: user?.username || 'unknown',
            submittedByName: user?.displayName || 'Unknown user',
            role: user?.role || 'staff',
            status: 'Open',
            response: ''
        };

        setFeedback(current => [entry, ...current]);
        return entry;
    };

    const updateFeedbackStatus = (id, status) => {
        setFeedback(current => current.map(item =>
            item.id === id ? { ...item, status } : item
        ));
    };

    const deleteFeedback = id => {
        setFeedback(current => current.filter(item => item.id !== id));
    };

    // Reports still needing attention — drives the super administrator's
    // notification badge.
    const openCount = feedback.filter(item => item.status !== 'Resolved').length;

    return (
        <FeedbackContext.Provider value={{
            feedback,
            submitFeedback,
            updateFeedbackStatus,
            deleteFeedback,
            openCount
        }}>
            {children}
        </FeedbackContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the feedback provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => useContext(FeedbackContext);
