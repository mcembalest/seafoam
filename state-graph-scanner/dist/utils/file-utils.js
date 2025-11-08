import { readFile } from 'fs/promises';
import { glob } from 'glob';
export async function findSourceFiles(rootDir) {
    const jsFiles = await glob('**/*.{js,mjs,ts,tsx,jsx}', {
        cwd: rootDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    });
    const htmlFiles = await glob('**/*.html', {
        cwd: rootDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
    return { jsFiles, htmlFiles };
}
export async function readSourceFile(filePath) {
    return readFile(filePath, 'utf-8');
}
export function getRelativePath(basePath, fullPath) {
    return fullPath.replace(basePath + '/', '');
}
