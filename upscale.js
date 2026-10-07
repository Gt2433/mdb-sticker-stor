const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

function upscalePNG(inputPath, outputPath, scale = 2.5) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(inputPath)
            .pipe(new PNG())
            .on('parsed', function() {
                const src = this;
                const dstW = Math.round(src.width * scale);
                const dstH = Math.round(src.height * scale);
                const dst = new PNG({ width: dstW, height: dstH });

                // Bilinear interpolation
                for (let y = 0; y < dstH; y++) {
                    const srcY = y / scale;
                    const y1 = Math.floor(srcY);
                    const y2 = Math.min(y1 + 1, src.height - 1);
                    const dy = srcY - y1;

                    for (let x = 0; x < dstW; x++) {
                        const srcX = x / scale;
                        const x1 = Math.floor(srcX);
                        const x2 = Math.min(x1 + 1, src.width - 1);
                        const dx = srcX - x1;

                        const dstIdx = (dstW * y + x) << 2;

                        for (let c = 0; c < 4; c++) {
                            const p11 = src.data[(src.width * y1 + x1) << 2 | c];
                            const p21 = src.data[(src.width * y1 + x2) << 2 | c];
                            const p12 = src.data[(src.width * y2 + x1) << 2 | c];
                            const p22 = src.data[(src.width * y2 + x2) << 2 | c];

                            const top = p11 + dx * (p21 - p11);
                            const bottom = p12 + dx * (p22 - p12);
                            const val = top + dy * (bottom - top);

                            dst.data[dstIdx + c] = Math.round(val);
                        }
                    }
                }

                // Sharpening pass (Unsharp Mask)
                const sharpened = new PNG({ width: dstW, height: dstH });
                const kernel = [
                    [ 0, -0.25,  0],
                    [-0.25, 2.0, -0.25],
                    [ 0, -0.25,  0]
                ];

                for (let y = 0; y < dstH; y++) {
                    for (let x = 0; x < dstW; x++) {
                        const idx = (dstW * y + x) << 2;
                        if (x === 0 || x === dstW - 1 || y === 0 || y === dstH - 1) {
                            for (let c = 0; c < 4; c++) sharpened.data[idx + c] = dst.data[idx + c];
                            continue;
                        }

                        for (let c = 0; c < 4; c++) {
                            let sum = 0;
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    const pIdx = (dstW * (y + ky) + (x + kx)) << 2;
                                    sum += dst.data[pIdx + c] * kernel[ky + 1][kx + 1];
                                }
                            }
                            sharpened.data[idx + c] = Math.min(255, Math.max(0, Math.round(sum)));
                        }
                    }
                }

                sharpened.pack().pipe(fs.createWriteStream(outputPath)).on('finish', resolve).on('error', reject);
            })
            .on('error', reject);
    });
}

const dir = path.join(__dirname, 'images', 'stickers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

console.log(`Upscaling ${files.length} images...`);

async function processAll() {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(dir, file);
        await upscalePNG(filePath, filePath, 2.5);
        console.log(`[${i + 1}/${files.length}] Upscaled ${file}`);
    }
    console.log("All 46 images upscaled successfully!");
}

processAll().catch(console.error);
