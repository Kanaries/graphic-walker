import type { ReadVersion, SelectionTarget, WorksheetEvents } from '@kanaries/worksheet-renderer';
import type { IViewField } from '../../interfaces';
import type { NativeFieldReference } from './adapter';

export interface NativeSelectionValue {
    readonly fieldRef: string;
    readonly field: IViewField;
    readonly configRef: string;
    readonly value: unknown;
    readonly raw: unknown;
    readonly datumKey?: string;
}
export interface NativeSelectionTarget extends Omit<SelectionTarget, 'values'> {
    readonly values: readonly NativeSelectionValue[];
    /** Ordered endpoints preserve line selection without inventing a single record. */
    readonly endpoints: readonly { readonly datumKey: string; readonly values: readonly NativeSelectionValue[] }[];
}
export interface NativeSelectionEvent {
    readonly renderer: 'native';
    readonly inputRevision: number;
    readonly frameId: number;
    readonly version: ReadVersion;
    readonly source: WorksheetEvents['selectionChange']['source'];
    readonly operation: WorksheetEvents['selectionChange']['operation'];
    readonly targets: readonly NativeSelectionTarget[];
    /** Present only during the same actual click; never retained for brush/keyboard/clear. */
    readonly interaction?: { readonly clientX: number; readonly clientY: number };
}
export function mapNativeSelection(
    event: WorksheetEvents['selectionChange'],
    references: ReadonlyMap<string, NativeFieldReference>,
    click?: { clientX: number; clientY: number },
): NativeSelectionEvent {
    const targets = event.targets.map((target) => {
        const values = target.values.map((value) => {
            const original = references.get(value.fieldRef);
            if (!original) throw new Error(`missing-binding: selection field ${value.fieldRef} has no original Graphic Walker field`);
            return { ...value, field: original.field, configRef: original.configRef };
        });
        return {
            ...target,
            values,
            endpoints: target.datumKeys.map((datumKey) => ({ datumKey, values: values.filter((value) => value.datumKey === datumKey) })),
        };
    });
    return {
        renderer: 'native',
        inputRevision: event.inputRevision,
        frameId: event.frameId,
        version: { ...event.version },
        source: event.source,
        operation: event.operation,
        targets,
        ...(click && event.source === 'pointer' && event.operation === 'replace' && targets.length === 1
            ? { interaction: { clientX: click.clientX, clientY: click.clientY } }
            : {}),
    };
}
