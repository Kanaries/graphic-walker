import { useCallback } from 'react';
import { useAppRootContext } from '../components/appRoot';
import type { AgentTargetKind } from '../interfaces';

export function useHoverEmitter() {
    const appRef = useAppRootContext();
    return useCallback(
        (action: 'enter' | 'leave', targetId: string, targetKind: AgentTargetKind, meta?: Record<string, unknown>) => {
            appRef.current?.emitAgentEvent({
                type: 'hover',
                action,
                targetId,
                targetKind,
                meta,
            });
        },
        [appRef]
    );
}
