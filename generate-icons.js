const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const inputFile = path.join(__dirname, 'icons', 'icon.svg');
const outputDir = path.join(__dirname, 'icons');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Generate icons for each size
async function generateIcons() {
    try {
        for (const size of sizes) {
            const outputFile = path.join(outputDir, `icon${size}.png`);
            
            await sharp(inputFile)
                .resize(size, size)
                .png()
                .toFile(outputFile);
            
            console.log(`Generated ${size}x${size} icon`);
        }
        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

generateIcons(); 