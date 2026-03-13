import * as fs from 'fs';
import * as path from 'path';
import type { ChatSession, ChatSessionData } from '../types';

function applyJsonlPatch(state: Record<string, unknown>, kind: number, keys: Array<string | number>, value: unknown): void {
    if (keys.length === 0) {
        return;
    }
    let current: Record<string, unknown> = state;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
            current[key] = typeof keys[i + 1] === 'number' ? [] : {};
        }
        current = current[key] as Record<string, unknown>;
    }
    const lastKey = keys[keys.length - 1];
    if (kind === 1) {
        current[lastKey] = value;
    } else if (kind === 2) {
        const existing = Array.isArray(current[lastKey]) ? (current[lastKey] as unknown[]) : [];
        current[lastKey] = [...existing, ...(Array.isArray(value) ? value : [value])];
    }
}

export function parseJsonlSession(content: string): ChatSessionData {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
        throw new Error('JSONL session file is empty');
    }
    const firstLine = JSON.parse(lines[0]) as { kind: number; v?: unknown };
    if (firstLine.kind !== 0 || typeof firstLine.v !== 'object' || firstLine.v === null) {
        throw new Error('JSONL session file does not begin with a valid initial state (kind:0)');
    }
    const state = firstLine.v as Record<string, unknown>;
    for (let i = 1; i < lines.length; i++) {
        const patch = JSON.parse(lines[i]) as { kind: number; k: Array<string | number>; v: unknown };
        if (patch.kind === 1 || patch.kind === 2) {
            applyJsonlPatch(state, patch.kind, patch.k, patch.v);
        }
    }
    return state as unknown as ChatSessionData;
}

export class SessionFileError extends Error {
    readonly context: string;
    readonly cause?: unknown;

    constructor(message: string, context: string, options?: { cause?: unknown }) {
        super(message);
        this.name = 'SessionFileError';
        this.context = context;
        if (options?.cause !== undefined) {
            this.cause = options.cause;
        }
    }
}

export async function resolveSessionFilePath(session: ChatSession): Promise<string> {
    if (!session.filePath || !session.storageRoot) {
        throw new SessionFileError('Session is missing file path metadata.', 'sessionPath:metadataMissing');
    }

    try {
        const [realFilePath, realRoot] = await Promise.all([
            fs.promises.realpath(session.filePath),
            fs.promises.realpath(session.storageRoot)
        ]);

        const relative = path.relative(realRoot, realFilePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new SessionFileError(
                `Session file path is outside of expected directory: ${session.filePath}`,
                'sessionPath:outsideRoot'
            );
        }

        return realFilePath;
    } catch (error) {
        if (error instanceof SessionFileError) {
            throw error;
        }
        throw new SessionFileError(
            'Error resolving real paths for session file or storage root.',
            'sessionPath:resolutionFailed',
            { cause: error }
        );
    }
}

export async function resolveAccessibleSessionFilePath(
    session: ChatSession,
    accessMode: number = fs.constants.R_OK
): Promise<string> {
    const sessionFilePath = await resolveSessionFilePath(session);

    try {
        await fs.promises.access(sessionFilePath, accessMode);
        return sessionFilePath;
    } catch (error) {
        throw new SessionFileError(
            `Chat session file not found: ${sessionFilePath}`,
            'sessionPath:notFound',
            { cause: error }
        );
    }
}

export async function loadSessionData(session: ChatSession): Promise<{ filePath: string; data: ChatSessionData }> {
    const sessionFilePath = await resolveAccessibleSessionFilePath(session);

    let sessionRaw: string;
    try {
        sessionRaw = await fs.promises.readFile(sessionFilePath, 'utf8');
    } catch (error) {
        throw new SessionFileError(
            `Unable to read chat session file: ${sessionFilePath}`,
            'sessionFile:readFailed',
            { cause: error }
        );
    }

    try {
        const sessionData = path.extname(sessionFilePath) === '.jsonl'
            ? parseJsonlSession(sessionRaw)
            : JSON.parse(sessionRaw) as ChatSessionData;
        return { filePath: sessionFilePath, data: sessionData };
    } catch (error) {
        throw new SessionFileError(
            `Chat session file is invalid or corrupted: ${sessionFilePath}`,
            'sessionFile:parseFailed',
            { cause: error }
        );
    }
}
