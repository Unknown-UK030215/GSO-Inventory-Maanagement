import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured } from '../lib/supabase';
import {
    fetchReadState,
    fetchStoredRecords,
    insertStoredRecords,
    saveReadState
} from '../services/supabaseService';
import { useAuth } from './useAuth';

const ChatContext = createContext(null);
const MESSAGES_KEY = 'gso-chat-messages';
const READS_KEY = 'gso-chat-reads';

// Role-scoped chat: every message belongs to a role channel, so an account
// only sees and posts to the room shared with colleagues of the same role.
let idCounter = Date.now();
const nextId = () => idCounter++;

function syncWarning(error) {
    console.warn('Supabase chat sync skipped:', error?.message || error);
}

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

    useEffect(() => {
        if (!isSupabaseConfigured || !user?.id || !username) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [remoteMessages, remoteReadIds] = await Promise.all([
                    fetchStoredRecords('chat_messages', { orderBy: 'created_at' }),
                    fetchReadState('chat_reads', username)
                ]);
                if (cancelled) return;
                if (remoteMessages.length) {
                    setMessages(remoteMessages);
                } else {
                    const ownChannelMessages = messages.filter(
                        item => item.roleId === roleId && item.authorId === username
                    );
                    if (ownChannelMessages.length) await insertStoredRecords('chat_messages', ownChannelMessages);
                }
                setReads(current => ({ ...current, [username]: remoteReadIds }));
                if (!remoteReadIds.length && reads[username]?.length) {
                    await saveReadState('chat_reads', username, reads[username]);
                }
            } catch (error) {
                syncWarning(error);
            }
        })();
        return () => { cancelled = true; };
        // Local messages/read state seed only this authenticated user's channel.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

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
        if (isSupabaseConfigured) insertStoredRecords('chat_messages', [entry]).catch(syncWarning);
        // Your own message never counts as unread for you.
        const nextReadIds = [...(reads[username] || []), entry.id];
        setReads(current => ({ ...current, [username]: nextReadIds }));
        if (isSupabaseConfigured) saveReadState('chat_reads', username, nextReadIds).catch(syncWarning);
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
        const ids = channel.map(item => item.id);
        setReads(current => ({ ...current, [username]: ids }));
        if (isSupabaseConfigured) saveReadState('chat_reads', username, ids).catch(syncWarning);
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
