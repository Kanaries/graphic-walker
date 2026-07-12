import { createListenerRegistry } from './listeners';

describe('memory data source provider listeners', () => {
    test('a disposed listener is not called again', () => {
        const listeners = createListenerRegistry<(event: number) => void>();
        const callback = jest.fn();
        const dispose = listeners.add(callback);

        listeners.emit(1);
        dispose();
        listeners.emit(2);

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
