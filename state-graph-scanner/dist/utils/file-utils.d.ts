export declare function findSourceFiles(rootDir: string): Promise<{
    jsFiles: string[];
    htmlFiles: string[];
}>;
export declare function readSourceFile(filePath: string): Promise<string>;
export declare function getRelativePath(basePath: string, fullPath: string): string;
