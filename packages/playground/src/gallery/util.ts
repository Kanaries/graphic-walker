export type { IDataSource } from "../examples/util"
export { useFetch } from "../examples/util"

export function toRouterPath(name: string): string {
    return name.replace(/[\s,]/g, '_');
}
