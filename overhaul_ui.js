const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? 
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts') && !filePath.endsWith('.css')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Remove dark: classes
    content = content.replace(/dark:[a-zA-Z0-9\-\/\[\]#\.]+\s?/g, '');

    // 2. Replace primary hex colors
    content = content.replace(/#1D9E75/g, '#8C5A35');
    content = content.replace(/#168a65/g, '#70482B'); // another hover variation
    content = content.replace(/#16805d/g, '#70482B'); // hover
    content = content.replace(/#020617/g, '#2C241B'); // dark bg -> very dark brown

    // 3. Replace color names
    content = content.replace(/slate-/g, 'stone-');
    content = content.replace(/emerald-/g, 'amber-');
    content = content.replace(/emerald/g, 'amber');
    
    // 4. Backgrounds specific to paper style
    // Replace typical white/slate-50 backgrounds with paper-like
    content = content.replace(/bg-white/g, 'bg-[#FCFAF8]');
    content = content.replace(/bg-stone-50/g, 'bg-[#FCFAF8]');
    content = content.replace(/bg-stone-100/g, 'bg-[#F2EFE9]');
    content = content.replace(/bg-stone-200/g, 'bg-[#E8E4DB]');

    // Replace text colors
    content = content.replace(/text-stone-900/g, 'text-[#2C241B]');
    content = content.replace(/text-stone-800/g, 'text-[#3E352B]');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated: ' + filePath);
    }
}

walkDir('./project/src', processFile);
console.log('UI Overhaul Complete!');
