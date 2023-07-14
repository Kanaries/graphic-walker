import { useEffect } from "react";
import { useAppRootContext } from "../components/appRoot";


interface IUseChartIndexControlOptions {
    count: number;
    index: number;
    onChange: (index: number) => void;
}

export const useChartIndexControl = (options: IUseChartIndexControlOptions): void => {
    const appRef = useAppRootContext();
    
    useEffect(() => {
        if (appRef.current) {
            appRef.current.chartCount = options.count;
            appRef.current.chartIndex = options.index;
            appRef.current.openChart = function (index: number) {
                if (index === this.chartIndex) {
                    return;
                } else if (Number.isInteger(index) && index >= 0 && index < this.chartCount) {
                    options.onChange(index);
                } else {
                    console.warn(`Invalid chart index: ${index}`);
                }
            };
        }
    });

    useEffect(() => {
        return () => {
            if (appRef.current) {
                appRef.current.chartCount = 1;
                appRef.current.chartIndex = 0;
                appRef.current.openChart = () => {};
            }
        };
    }, []);
};
