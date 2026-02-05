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
        // Explicitly specify UTF-8 encoding to ensure proper handling of Korean and other non-ASCII characters
        reader.readAsText(file, 'utf-8');
    });
}
