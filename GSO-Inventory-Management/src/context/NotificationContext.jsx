import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from './useAuth';

const NotificationContext = createContext(null);
const NOTIFICATIONS_KEY = 'gso-notifications';
const READS_KEY = 'gso-notification-reads';

// System-wide announcements broadcast by the super administrator to every
// user (for example, when something on the system changes).
let idCounter = Date.now();
const nextId = () => idCounter++;

function readNotifications() {
    try {
        const items = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

// Tracks which announcement ids each account has already read, keyed by
// username, so the unread badge is per user.
function readReads() {
    try {
        const reads = JSON.parse(localStorage.getItem(READS_KEY) || '{}');
        return reads && typeof reads === 'object' && !Array.isArray(reads) ? reads : {};
    } catch {
        return {};
    }
}

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const username = user?.username || '';

    const [notifications, setNotifications] = useState(readNotifications);
    const [reads, setReads] = useState(readReads);

    useEffect(() => {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    }, [notifications]);

    useEffect(() => {
        localStorage.setItem(READS_KEY, JSON.stringify(reads));
    }, [reads]);

    // The super administrator broadcasts a message to all users.
    const publishNotification = ({ title, message, type }) => {
        const cleanTitle = String(title || '').trim();
        const cleanMessage = String(message || '').trim();
        if (!cleanTitle || !cleanMessage) {
            throw new Error('Add a title and a message to send.');
        }

        const entry = {
            id: nextId(),
            date: new Date().toLocaleString(),
            title: cleanTitle,
            message: cleanMessage,
            type: type === 'alert' ? 'alert' : 'info',
            publishedBy: username,
            publishedByName: user?.displayName || 'System'
        };

        setNotifications(current => [entry, ...current]);
        return entry;
    };

    const deleteNotification = id => {
        setNotifications(current => current.filter(item => item.id !== id));
    };

    const readIds = reads[username] || [];
    const unreadCount = notifications.filter(item => !readIds.includes(item.id)).length;
    const isRead = id => readIds.includes(id);

    const markAllRead = useCallback(() => {
        if (!username) return;
        setReads(current => ({ ...current, [username]: notifications.map(item => item.id) }));
    }, [username, notifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            publishNotification,
            deleteNotification,
            unreadCount,
            isRead,
            markAllRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the notification provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);
