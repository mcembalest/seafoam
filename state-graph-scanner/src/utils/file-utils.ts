import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { glob } from 'glob';

export async function findSourceFiles(rootDir: string): Promise<{
  jsFiles: string[];
  htmlFiles: string[];
}> {
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

export async function readSourceFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export function getRelativePath(basePath: string, fullPath: string): string {
  return fullPath.replace(basePath + '/', '');
}
