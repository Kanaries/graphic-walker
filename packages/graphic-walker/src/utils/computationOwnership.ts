import type { IComputationFunction, IDataQueryPayload } from '../interfaces';

// Internal request lifetime metadata. The host still receives the original,
// unmodified payload and the public computation signature stays unchanged.
const owners = new WeakMap<IDataQueryPayload, { isCurrent: () => boolean }>();

export function isCurrentComputation(payload: IDataQueryPayload): boolean {
    return owners.get(payload)?.isCurrent() ?? true;
}

export function runOwnedComputation(computation: IComputationFunction, payload: IDataQueryPayload, isCurrent: () => boolean) {
    const owner = { isCurrent };
    owners.set(payload, owner);
    const release = () => {
        if (owners.get(payload) === owner) owners.delete(payload);
    };
    try {
        return Promise.resolve(computation(payload)).finally(release);
    } catch (error) {
        release();
        throw error;
    }
}
