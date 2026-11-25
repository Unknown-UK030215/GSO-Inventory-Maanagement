import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './useAuth';

const ChatContext = createContext(null);
const MESSAGES_KEY = 'gso-chat-messages';
const READS_KEY = 'gso-chat-reads';

// Role-scoped chat: every message belongs to a role channel, so an account
// only sees and posts to the room shared with colleagues of the same role.
let idCounter = Date.now();
const nextId = () => idCounter++;

function readMessages() {
    try {
        const items = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

// Tracks which message ids each account has read, keyed by username, so the
// unread badge is per user.
function readReads() {
    try {
        const reads = JSON.parse(localStorage.getItem(READS_KEY) || '{}');
        return reads && typeof reads === 'object' && !Array.isArray(reads) ? reads : {};
    } catch {
        return {};
    }
}

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const username = user?.username || '';
    const roleId = user?.role || 'staff';

    const [messages, setMessages] = useState(readMessages);
    const [reads, setReads] = useState(readReads);

    useEffect(() => {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }, [messages]);

    useEffect(() => {
        localStorage.setItem(READS_KEY, JSON.stringify(reads));
    }, [reads]);

    // Keep open tabs in sync — another account in the same browser may post.
    useEffect(() => {
        function sync(event) {
            if (event.key === MESSAGES_KEY) setMessages(readMessages());
        }
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);

    // Post a message to the signed-in user's role channel.
    const sendMessage = text => {
        const clean = String(text || '').trim();
        if (!clean) {
            throw new Error('Type a message before sending.');
        }

        const entry = {
            id: nextId(),
            roleId,
            authorId: username,
            authorName: user?.displayName || username || 'Unknown',
            text: clean,
            at: new Date().toLocaleString()
        };

        setMessages(current => [...current, entry]);
        // Your own message never counts as unread for you.
        setReads(current => ({
            ...current,
            [username]: [...(current[username] || []), entry.id]
        }));
        return entry;
    };

    // Only the messages in this user's role channel are visible to them.
    const channel = useMemo(
        () => messages.filter(item => item.roleId === roleId),
        [messages, roleId]
    );

    const readIds = reads[username] || [];
    const unreadCount = channel.filter(item => !readIds.includes(item.id)).length;

    const markAllRead = useCallback(() => {
        if (!username) return;
        setReads(current => ({ ...current, [username]: channel.map(item => item.id) }));
    }, [username, channel]);

    return (
        <ChatContext.Provider value={{ channel, unreadCount, sendMessage, markAllRead }}>
            {children}
        </ChatContext.Provider>
    );
}

// Shared hook export is intentionally kept beside the chat provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useChat = () => useContext(ChatContext);
