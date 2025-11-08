import { findSourceFiles, readSourceFile, getRelativePath } from '../utils/file-utils.js';
import { extractFromJavaScript } from './ast-extractor.js';
import { extractFromHTML } from './html-extractor.js';
export async function extractStructure(rootDir) {
    console.log('Scanning source files...');
    const { jsFiles, htmlFiles } = await findSourceFiles(rootDir);
    console.log(`Found ${jsFiles.length} JavaScript files and ${htmlFiles.length} HTML files`);
    const structure = {
        eventHandlers: [],
        stateVariables: [],
        uiElements: [],
        apiEndpoints: [],
        routes: []
    };
    // Process JavaScript files
    for (const filePath of jsFiles) {
        try {
            const code = await readSourceFile(filePath);
            const relativePath = getRelativePath(rootDir, filePath);
            const { eventHandlers, stateVariables, apiEndpoints } = extractFromJavaScript(code, relativePath);
            structure.eventHandlers.push(...eventHandlers);
            structure.stateVariables.push(...stateVariables);
            structure.apiEndpoints.push(...apiEndpoints);
        }
        catch (error) {
            console.warn(`Failed to process ${filePath}:`, error);
        }
    }
    // Process HTML files
    for (const filePath of htmlFiles) {
        try {
            const html = await readSourceFile(filePath);
            const relativePath = getRelativePath(rootDir, filePath);
            const { uiElements } = extractFromHTML(html, relativePath);
            structure.uiElements.push(...uiElements);
        }
        catch (error) {
            console.warn(`Failed to process ${filePath}:`, error);
        }
    }
    console.log(`Extracted:`);
    console.log(`  - ${structure.eventHandlers.length} event handlers`);
    console.log(`  - ${structure.stateVariables.length} state variables`);
    console.log(`  - ${structure.uiElements.length} UI elements`);
    console.log(`  - ${structure.apiEndpoints.length} API endpoints`);
    return structure;
}
