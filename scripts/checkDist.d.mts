export function referencesIn(fileName: string, text: string): [url: string, kind: 'html' | 'css' | 'js'][];
export function findProblems(files: Record<string, string>): string[];
export function findMissingFiles(files: Record<string, string>, exists: (path: string) => boolean): string[];
