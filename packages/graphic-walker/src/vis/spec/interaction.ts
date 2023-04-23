export const setupZeroBaseline = (view: Record<string, any>, zeroBaseline: Record<'x' | 'y', boolean>) => {
    if (!zeroBaseline.x && 'x' in view) {
        view.x.scale = {
            ...view.x.scale,
            zero: false,
        };
    }
    if (!zeroBaseline.y && 'y' in view) {
        view.y.scale = {
            ...view.y.scale,
            zero: false,
        };
    }
};
