const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Convert standard soft borders to thick black borders & neo shadows
    // Usually cards have: border border-stone-200 (since we replaced slate to stone)
    content = content.replace(/border border-stone-200/g, 'border-3 border-[#2C241B] shadow-neo');
    content = content.replace(/border border-stone-100/g, 'border-3 border-[#2C241B] shadow-neo');
    content = content.replace(/border-2 border-stone-200/g, 'border-3 border-[#2C241B] shadow-neo');
    content = content.replace(/border border-amber-200/g, 'border-3 border-[#2C241B] shadow-neo');
    content = content.replace(/border border-rose-200/g, 'border-3 border-[#2C241B] shadow-neo');
    content = content.replace(/border border-blue-200/g, 'border-3 border-[#2C241B] shadow-neo');

    // Make rounded corners consistent (e.g. rounded-xl -> rounded-2xl)
    // Actually, rounded-2xl or rounded-3xl looks best. The screenshot has big rounded corners.
    
    // Remove existing soft shadows
    content = content.replace(/\bshadow-sm\b/g, '');
    content = content.replace(/\bshadow-md\b/g, '');
    content = content.replace(/\bshadow-lg\b/g, '');
    content = content.replace(/shadow-\[[^\]]+\]/g, ''); // removes arbitrary shadows

    // Update Buttons (usually bg-[#8C5A35] etc) to have neo-shadow and active state
    // Let's add hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none
    content = content.replace(/hover:bg-\[\#70482B\]/g, 'hover:bg-[#70482B] border-3 border-[#2C241B] shadow-neo hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-neo-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Neo-brutalism applied: ' + filePath);
    }
}

walkDir('./project/src', processFile);
console.log('Neo-Brutalism Overhaul Complete!');
