export function createInitializer(setup: () => Promise<void>): () => Promise<void> {
    let initialization: Promise<void> | undefined;

    return () => {
        if (!initialization) {
            initialization = setup().catch((error) => {
                initialization = undefined;
                throw error;
            });
        }
        return initialization;
    };
}

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

interface ConnectionLike {
    query(sql: string): Promise<unknown>;
    close(): Promise<void>;
}

interface DatabaseLike {
    dropFile(fileName: string): Promise<unknown>;
}

interface JSONTableConnection extends ConnectionLike {
    insertJSONFromPath(fileName: string, options: { name: string }): Promise<unknown>;
}

interface JSONTableDatabase extends DatabaseLike {
    registerFileText(fileName: string, content: string): Promise<unknown>;
}

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export async function cleanupComputation(connection: ConnectionLike, database: DatabaseLike, fileName: string, tableName: string): Promise<void> {
    let firstError: unknown;
    for (const cleanup of [
        () => connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`),
        () => connection.close(),
        () => database.dropFile(fileName),
    ]) {
        try {
            await cleanup();
        } catch (error) {
            firstError ??= error;
        }
    }
    if (firstError) throw firstError;
}

export async function loadJSONTable(
    connection: JSONTableConnection,
    database: JSONTableDatabase,
    fileName: string,
    tableName: string,
    data: unknown,
    closeConnectionOnFailure: boolean,
): Promise<void> {
    try {
        await database.registerFileText(fileName, JSON.stringify(data));
        await connection.insertJSONFromPath(fileName, { name: tableName });
    } catch (error) {
        const cleanupSteps: Array<() => Promise<unknown>> = [() => connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`)];
        if (closeConnectionOnFailure) cleanupSteps.push(() => connection.close());
        cleanupSteps.push(() => database.dropFile(fileName));
        for (const cleanup of cleanupSteps) {
            await cleanup().catch(() => undefined);
        }
        throw error;
    }
}
