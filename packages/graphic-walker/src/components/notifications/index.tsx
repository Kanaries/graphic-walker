import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type NotificationType = 'info' | 'warning' | 'error';

interface NotificationItem {
    id: string;
    type: NotificationType;
    message: string;
}

interface NotificationsContextValue {
    notify: (type: NotificationType, message: string, durationMs?: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const typeClassName: Record<NotificationType, string> = {
    info: 'bg-green-600 text-white',
    warning: 'bg-yellow-500 text-black',
    error: 'bg-red-600 text-white',
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const counterRef = useRef(0);

    const remove = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const notify = useCallback(
        (type: NotificationType, message: string, durationMs = 4000) => {
            const id = `${Date.now()}_${counterRef.current++}`;
            setItems((prev) => [...prev, { id, type, message }]);
            if (durationMs > 0) {
                window.setTimeout(() => remove(id), durationMs);
            }
        },
        [remove]
    );

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <NotificationsContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`rounded px-3 py-2 text-xs shadow-md ${typeClassName[item.type]}`}
                        role="status"
                    >
                        {item.message}
                    </div>
                ))}
            </div>
        </NotificationsContext.Provider>
    );
};

export const useNotifications = (): NotificationsContextValue => {
    const ctx = useContext(NotificationsContext);
    if (!ctx) {
        throw new Error('useNotifications must be used within NotificationsProvider');
    }
    return ctx;
};
