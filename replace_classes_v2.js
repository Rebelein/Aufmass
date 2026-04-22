const fs = require('fs');

const files = [
  '/home/goe/Aufmass/src/pages/AufmassPage.tsx',
  '/home/goe/Aufmass/src/pages/AdminPage.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Specific text replacements from grep output
  
  // Text
  content = content.replace(/text-white\/(15|20|25|30|40|50|60|70)\b/g, 'text-muted-foreground');
  content = content.replace(/text-white\/(80|85|90|95)\b/g, 'text-accent-foreground');
  content = content.replace(/hover:text-white\b(?!\/)/g, 'hover:text-foreground');
  content = content.replace(/\btext-white\b(?!\/)/g, 'text-foreground');

  // Backgrounds
  content = content.replace(/bg-white\/\[0\.0[1-9]\]/g, 'bg-card');
  content = content.replace(/bg-white\/5\b/g, 'bg-card');
  content = content.replace(/bg-white\/10\b/g, 'bg-muted');
  content = content.replace(/bg-white\/(15|20|30)\b/g, 'bg-accent');
  content = content.replace(/bg-black\/(10|20|40|60)\b/g, 'bg-background');
  
  content = content.replace(/hover:bg-white\/(5|10)\b/g, 'hover:bg-muted');
  content = content.replace(/hover:bg-white\/(15|20|90)\b/g, 'hover:bg-accent');
  content = content.replace(/focus:bg-white\/10\b/g, 'focus:bg-accent');
  
  content = content.replace(/\bbg-white\b(?!\/)/g, 'bg-primary');
  content = content.replace(/\btext-black\b(?!\/)/g, 'text-primary-foreground');
  
  content = content.replace(/\bbg-gray-900\b/g, 'bg-popover');

  // Borders
  content = content.replace(/border-white\/(5|10)\b/g, 'border-border');
  content = content.replace(/border-white\/(15|20)\b/g, 'border-input');
  content = content.replace(/hover:border-white\/20\b/g, 'hover:border-input');

  fs.writeFileSync(file, content, 'utf8');
});
