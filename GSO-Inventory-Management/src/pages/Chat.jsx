import { useEffect, useRef, useState } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/useAuth';
import { useChat } from '../context/ChatContext';
import { getRole } from '../data/userRoles';

export default function Chat() {
    const { user } = useAuth();
    const { channel, sendMessage, markAllRead } = useChat();
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const listRef = useRef(null);

    const role = getRole(user?.role);

    // Opening the room clears the unread badge for this account.
    useEffect(() => {
        markAllRead();
    }, [markAllRead]);

    // Keep the newest message in view.
    useEffect(() => {
        const node = listRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, [channel]);

    function submit(event) {
        event.preventDefault();
        try {
            sendMessage(draft);
            setDraft('');
            setError('');
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <>
            <PageHeader
                title="Role Chat"
                description={`Shared room for every ${role.name} account in the General Services Office.`}
            />

            <article className="panel chat-panel">
                <div className="chat-head">
                    <h3>{role.name} Room</h3>
                    <small>{channel.length} message{channel.length === 1 ? '' : 's'}</small>
                </div>

                <div className="chat-list" ref={listRef}>
                    {!channel.length && (
                        <p className="chat-empty">No messages yet. Start the conversation with your team.</p>
                    )}

                    {channel.map(message => {
                        const mine = message.authorId === user?.username;
                        return (
                            <div className={`chat-bubble ${mine ? 'mine' : ''}`} key={message.id}>
                                {!mine && <b>{message.authorName}</b>}
                                <p>{message.text}</p>
                                <small>{message.at}</small>
                            </div>
                        );
                    })}
                </div>

                <form className="chat-form" onSubmit={submit}>
                    <input
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                        placeholder={`Message the ${role.name} room…`}
                        aria-label="Chat message"
                    />
                    <button type="submit">Send</button>
                </form>

                {error && <p className="form-status error">{error}</p>}
            </article>
        </>
    );
}
