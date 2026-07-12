export function createListenerRegistry<T extends (...args: any[]) => void>() {
    const listeners = new Set<T>();

    return {
        add(listener: T) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        emit(...args: Parameters<T>) {
            listeners.forEach((listener) => listener(...args));
        },
    };
}
