'use client';

import { useEffect, useRef } from 'react';
import { publicTrackingPath } from '@/lib/privacy';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';

export default function SessionTracker() {
    const hasNotified = useRef(false);

    useEffect(() => {
        const notifySession = async () => {
            const path = publicTrackingPath(window.location.pathname);
            if (!path) return;
            // Simple check to prevent duplicate notifications in the same session (SPA navigation)
            // Ideally use cookies/localStorage for stricter once-per-visit
            const sessionKey = 'session_notified_' + new Date().toDateString();
            if (getStorageItem('session', sessionKey)) return;

            if (hasNotified.current) return;
            hasNotified.current = true;

            try {
                await fetch('/api/notify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userAgent: navigator.userAgent,
                        timestamp: Date.now(),
                        path
                    })
                });
                setStorageItem('session', sessionKey, 'true');
            } catch (err) {
                console.error('Session tracking failed', err);
            }
        };

        notifySession();
    }, []);

    return null;
}
