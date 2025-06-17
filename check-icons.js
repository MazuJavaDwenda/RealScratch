const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconDir = path.join(__dirname, 'icons');

async function checkIcons() {
    for (const size of sizes) {
        const iconPath = path.join(iconDir, `icon${size}.png`);
        
        try {
            // Check if file exists
            if (!fs.existsSync(iconPath)) {
                console.error(`❌ icon${size}.png is missing!`);
                continue;
            }

            // Get image metadata
            const metadata = await sharp(iconPath).metadata();
            
            // Verify dimensions
            if (metadata.width !== size || metadata.height !== size) {
                console.error(`❌ icon${size}.png has wrong dimensions: ${metadata.width}x${metadata.height} (should be ${size}x${size})`);
            } else {
                console.log(`✅ icon${size}.png is valid (${size}x${size})`);
            }

            // Verify format
            if (metadata.format !== 'png') {
                console.error(`❌ icon${size}.png is not a PNG file`);
            }

        } catch (error) {
            console.error(`❌ Error checking icon${size}.png:`, error.message);
        }
    }
}

checkIcons(); 