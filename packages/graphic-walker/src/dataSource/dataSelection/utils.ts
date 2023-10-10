import { IRow } from "../../interfaces";

export function jsonReader (file: File): Promise<IRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string);
                if (!Array.isArray(data)) {
                    throw new Error('Invalid JSON file');
                }
                resolve(data);
            } catch (e) {
                reject(e);
            }
        };
        reader.readAsText(file);
    });
}
