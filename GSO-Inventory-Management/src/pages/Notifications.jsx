import { useEffect } from 'react';

import PageHeader from '../components/common/PageHeader';
import { useNotifications } from '../context/NotificationContext';

export default function Notifications() {
    const { notifications, isRead, markAllRead } = useNotifications();

    // Opening the page clears the unread badge for this account.
    useEffect(() => {
        markAllRead();
    }, [markAllRead]);

    return (
        <>
            <PageHeader
                title="System Notifications"
                description="Announcements from the super administrator about changes on the system."
            />

            <article className="panel">
                <h3>Announcements</h3>
                <p className="result-count">
                    {notifications.length} notice{notifications.length === 1 ? '' : 's'} from the General Services Office.
                </p>

                {notifications.map(item => (
                    <div className="notice" key={item.id}>
                        <div className="notice-head">
                            <span className={`activity-tag ${item.type === 'alert' ? 'tone-delete' : 'tone-assignment'}`}>
                                {item.type === 'alert' ? 'Important' : 'Update'}
                            </span>
                            <b>{item.title}</b>
                            {!isRead(item.id) && <span className="nav-badge">New</span>}
                        </div>
                        <p>{item.message}</p>
                        <small>{item.date} · posted by {item.publishedByName}</small>
                    </div>
                ))}

                {!notifications.length && (
                    <p>No system notifications have been posted yet.</p>
                )}
            </article>
        </>
    );
}
