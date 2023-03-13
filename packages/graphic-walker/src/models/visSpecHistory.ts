import { toJS } from "mobx";
import { MAX_HISTORY_SIZE } from "../config";
import { DeepReadonly, DraggableFieldState, IVisSpec, IVisualConfig } from "../interfaces";

export class VisSpecWithHistory {

    readonly visId: IVisSpec['visId'];
    private snapshots: Pick<IVisSpec, 'name' | 'encodings' | 'config'>[];
    private cursor: number;

    constructor(data: IVisSpec) {
        this.visId = data.visId;
        this.snapshots = [{
            name: data.name,
            encodings: data.encodings,
            config: data.config,
        }];
        this.cursor = 0;
    }

    private get frame(): Readonly<IVisSpec> {
        return {
            visId: this.visId,
            ...this.snapshots[this.cursor]!,
        };
    }

    private batchFlag = false;

    public updateLatest(snapshot: Partial<Readonly<VisSpecWithHistory['snapshots'][0]>>) {
        this.snapshots[this.cursor] = {
            ...this.snapshots[this.cursor],
            ...snapshot,
        }
    }


    private commit(snapshot: Partial<Readonly<VisSpecWithHistory['snapshots'][0]>>): void {
        if (this.batchFlag) {
            // batch this commit
            this.snapshots[this.cursor] = toJS({
                ...this.frame,
                ...snapshot,
            });

            return;
        }

        this.batchFlag = true;

        this.snapshots = [
            ...this.snapshots.slice(0, this.cursor + 1),
            toJS({
                ...this.frame,
                ...snapshot,
            }),
        ];

        if (this.snapshots.length > MAX_HISTORY_SIZE) {
            this.snapshots.splice(0, 1);
        }

        this.cursor = this.snapshots.length - 1;

        requestAnimationFrame(() => this.batchFlag = false);
    }

    public get canUndo() {
        return this.cursor > 0;
    }

    public undo(): boolean {
        if (this.cursor === 0) {
            return false;
        }

        this.cursor -= 1;

        return true;
    }

    public get canRedo() {
        return this.cursor < this.snapshots.length - 1;
    }

    public redo(): boolean {
        if (this.cursor === this.snapshots.length - 1) {
            return false;
        }

        this.cursor += 1;

        return true;
    }

    public rebase() {
        this.snapshots = [this.snapshots[this.cursor]];
        this.cursor = 0;
    }

    get name() {
        return this.frame.name;
    }

    set name(name: IVisSpec['name']) {
        this.commit({
            name,
        });
    }

    get encodings(): DeepReadonly<DraggableFieldState> {
        return this.frame.encodings;
    }

    set encodings(encodings: IVisSpec['encodings']) {
        this.commit({
            encodings,
        });
    }

    get config(): DeepReadonly<IVisualConfig> {
        return this.frame.config;
    }

    set config(config: IVisSpec['config']) {
        this.commit({
            config,
        });
    }

    public clone () {
        console.log(this.snapshots)
        const nextVSWH = new VisSpecWithHistory(this.frame);
        nextVSWH.cursor = this.cursor;
        return nextVSWH;
    }

    public exportGW (): IVisSpec {
        return {
            ...this.frame
        }
    }

}