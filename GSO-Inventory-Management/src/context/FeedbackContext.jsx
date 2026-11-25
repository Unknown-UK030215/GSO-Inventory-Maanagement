import { createContext, useContext, useEffect, useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import { isAdminRole } from '../data/userRoles';
import {
    deleteStoredRecord,
    fetchOrSeedRecords,
    insertStoredRecords,
    saveStoredRecords
} from '../services/supabaseService';
import { useAuth } from './useAuth';

const FeedbackContext = createContext(null);
const FEEDBACK_KEY = 'gso-feedback';

// Bug reports and feedback share one store so the super administrator sees
// every report from every user in a single queue.
let idCounter = Date.now();
const nextId = () => idCounter++;

function syncWarning(error) {
    console.warn('Supabase feedback sync skipped:', error?.message || error);
}

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

    useEffect(() => {
        if (!isSupabaseConfigured || !user?.id) return undefined;
        let cancelled = false;
        const localReports = feedback
            .filter(report => isAdminRole(user.role) || !report.submittedBy || report.submittedBy === user.username)
            .map(report => ({ ...report, submittedBy: report.submittedBy || user.username }));
        fetchOrSeedRecords('feedback_reports', localReports, {
            orderBy: 'created_at',
            insertOnly: true
        })
            .then(remote => { if (!cancelled && remote.length) setFeedback(remote); })
            .catch(syncWarning);
        return () => { cancelled = true; };
        // Local reports seed an empty table on the first authenticated load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

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
        if (isSupabaseConfigured) insertStoredRecords('feedback_reports', [entry]).catch(syncWarning);
        return entry;
    };

    const updateFeedbackStatus = (id, status) => {
        const existing = feedback.find(item => item.id === id);
        if (!existing) return;
        const updated = { ...existing, status };
        setFeedback(current => current.map(item => item.id === id ? updated : item));
        if (isSupabaseConfigured) saveStoredRecords('feedback_reports', [updated]).catch(syncWarning);
    };

    const deleteFeedback = id => {
        setFeedback(current => current.filter(item => item.id !== id));
        if (isSupabaseConfigured) deleteStoredRecord('feedback_reports', id).catch(syncWarning);
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
