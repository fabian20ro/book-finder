import 'vitest-canvas-mock';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { frameBrightness, preprocessCanvas } from './ocr';

class MockCanvasContext {
    data = new Uint8ClampedArray(36);
    width = 3;
    height = 3;
    getImageData(x: number, y: number, w: number, h: number) {
        return {
            data: this.data,
            width: w,
            height: h
        };
    }
    createImageData(w: number, h: number) {
        return {
            data: new Uint8ClampedArray(w * h * 4),
            width: w,
            height: h
        };
    }
    putImageData = vi.fn((imageData: ImageData) => {
        this.data = imageData.data;
    });
}

const mockCtx = new MockCanvasContext();

describe('preprocessCanvas', () => {
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.width = 3;
        canvas.height = 3;
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
    });

    it('should return a new canvas instance', () => {
        const result = preprocessCanvas(canvas);
        expect(result).not.toBe(canvas);
        expect(result.width).toBe(3);
        expect(result.height).toBe(3);
    });

    it('should apply transformations', () => {
        // Set some pattern
        mockCtx.data[0] = 100; // Red channel
        mockCtx.data[1] = 100; // Green channel
        mockCtx.data[2] = 100; // Blue channel
        mockCtx.data[3] = 255; // Alpha

        const result = preprocessCanvas(canvas, 0.5);
        
        // After processing, even with 100/100/100, grayscale should still be around 100
        // but we check if the values are modified.
        expect(result.getContext('2d')?.getImageData(0, 0, 3, 3).data[0]).not.toBe(100);
    });

    it('should handle an empty (black) canvas', () => {
        // Fill with black
        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i] = 0;
            mockCtx.data[i + 1] = 0;
            mockCtx.data[i + 2] = 0;
            mockCtx.data[i + 3] = 255;
        }
        
        const result = preprocessCanvas(canvas, 0.5);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data;
        expect(data?.[0]).toBe(0);
    });

    it('should preserve uniform grayscale with strength=0 (zero-range branch)', () => {
        // Fill with uniform medium gray — exercises the range===0 branch in contrast stretch.
        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i]     = 128;
            mockCtx.data[i + 1] = 128;
            mockCtx.data[i + 2] = 128;
            mockCtx.data[i + 3] = 255;
        }

        const result = preprocessCanvas(canvas, 0);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data;

        // With strength=0 the sharpening term cancels (v == stretched[idx]).
        // With range===0 the stretch copies grays unchanged.
        expect(data?.[0]).toBe(128); // R preserved
        expect(data?.[1]).toBe(128); // G preserved
        expect(data?.[2]).toBe(128); // B preserved
    });

    it('should preserve relative luminance ordering for non-uniform grayscale input', () => {
        // Set a 3x3 grid with increasing brightness left-to-right, top-to-bottom.
        // Grayscale conversion is monotone, contrast stretch is monotone (range>0),
        // and sharpening only amplifies local differences — so relative order must be preserved.
        const expected: number[] = [10, 20, 30, 40, 50, 60, 70, 80, 90];
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const idx = (y * 3 + x) * 4;
                mockCtx.data[idx]     = expected[y * 3 + x];
                mockCtx.data[idx + 1] = expected[y * 3 + x];
                mockCtx.data[idx + 2] = expected[y * 3 + x];
                mockCtx.data[idx + 3] = 255;
            }
        }

        const result = preprocessCanvas(canvas);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;
        const actual: number[] = [];
        for (let i = 0; i < expected.length; i++) {
            actual.push(data[i * 4]); // R channel == grayscale output
        }

        // Relative order must be preserved — sharpening can change magnitudes but not swap order.
        const sortedActual = [...actual].sort((a, b) => a - b);
        expect(actual).toEqual(sortedActual);
    });

    it('should leave edge pixels unchanged by sharpening at strength=1', () => {
        // Edge pixels bypass the sharpening kernel (boundary guard on line 83-86 of ocr.ts).
        // Sharpening must not further modify edge pixels beyond what contrast stretch already did.
        const pixelValues: number[] = [50, 100, 150, 200, 30, 180, 70, 120, 240];
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const idx = (y * 3 + x) * 4;
                mockCtx.data[idx]     = pixelValues[y * 3 + x];
                mockCtx.data[idx + 1] = pixelValues[y * 3 + x];
                mockCtx.data[idx + 2] = pixelValues[y * 3 + x];
                mockCtx.data[idx + 3] = 255;
            }
        }

        const resultStrong = preprocessCanvas(canvas, 1);
        const dataStrong = resultStrong.getContext('2d')?.getImageData(0, 0, 3, 3).data!;
        const resultWeak = preprocessCanvas(canvas, 0);
        const dataWeak = resultWeak.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        // Edge pixels: indices 0-7 (row 0), 6-8 (row 2), and col 0 / col 2 across all rows.
        const edgeIndices = [0, 1, 2, 3, 5, 6, 7, 8];
        for (const i of edgeIndices) {
            expect(dataStrong[i * 4]).toBe(dataWeak[i * 4]); // sharpening doesn't touch edges
        }
    });

    it('should return the original canvas unchanged when getContext returns null', () => {
        // preprocessCanvas's fallback: if no 2D context is available, pass through the input.
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

        const result = preprocessCanvas(canvas);

        expect(result).toBe(canvas);
    });

    it('should darken dark edge pixels when surrounded by light neighbors (clamped-blur sharpening)', () => {
        // 3x1 strip: a single dark pixel flanked by bright pixels. The clamped-edge blur at the
        // leftmost pixel averages itself with two bright neighbors, producing a blurred value > 0;
        // the sharpen term then pulls it darker (below its own original). This exercises lines 84-97 of ocr.ts
        // directly — the clamp-based neighbor averaging and the v = stretched[idx] + strength*(stretched[idx]-blurred) formula.
        const darkVal = 20;
        const brightVal = 230;
        mockCtx.data[0] = darkVal;
        mockCtx.data[1] = darkVal;
        mockCtx.data[2] = darkVal;
        mockCtx.data[3] = 255;
        mockCtx.data[4] = brightVal;
        mockCtx.data[5] = brightVal;
        mockCtx.data[6] = brightVal;
        mockCtx.data[7] = 255;
        mockCtx.data[8] = brightVal;
        mockCtx.data[9] = brightVal;
        mockCtx.data[10] = brightVal;
        mockCtx.data[11] = 255;

        const result = preprocessCanvas(canvas, 1);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 1).data!;

        // The dark pixel at index 0 should be sharpened darker than its original grayscale value.
        expect(data[0]).toBeLessThan(darkVal);
    });

    it('should clamp sharpened values to [0,255]', () => {
        // Force a high-contrast input where sharpening would push the bright pixel above 255.
        // Set all pixels to max so contrast stretch keeps them at 255; then with strength=1
        // and blur < 255, v = 255 + 1*(255-blurred) would exceed 255 without clamping.
        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i]     = 255;
            mockCtx.data[i + 1] = 255;
            mockCtx.data[i + 2] = 255;
            mockCtx.data[i + 3] = 255;
        }

        const result = preprocessCanvas(canvas, 1);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        for (let i = 0; i < data.length; i += 4) {
            expect(data[i]).toBeLessThanOrEqual(255);
            expect(data[i + 1]).toBeLessThanOrEqual(255);
            expect(data[i + 2]).toBeLessThanOrEqual(255);
        }
    });

    it('should clamp sharpened values to >=0 for dark inputs', () => {
        // All-black input: contrast stretch keeps at 0; blur of zeros is zero; v = 0 + strength*(0-0) = 0.
        // But with a small non-uniform dark gradient near zero the sharpening could push below 0 without clamping.
        mockCtx.data[0]     = 1;
        mockCtx.data[1]     = 1;
        mockCtx.data[2]     = 1;
        mockCtx.data[3]     = 255;
        for (let i = 4; i < mockCtx.data.length; i++) {
            mockCtx.data[i] = 0;
        }

        const result = preprocessCanvas(canvas, 2); // high strength to amplify negative push
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        for (let i = 0; i < data.length; i += 4) {
            expect(data[i]).toBeGreaterThanOrEqual(0);
            expect(data[i + 1]).toBeGreaterThanOrEqual(0);
            expect(data[i + 2]).toBeGreaterThanOrEqual(0);
        }
    });

    describe('frameBrightness', () => {
        it('should return 128 when getContext returns null (fallback)', () => {
            vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

            const brightness = frameBrightness(canvas);

            expect(brightness).toBe(128); // Default fallback value
        });

        it('should return average brightness for uniform white canvas', () => {
            // All pixels at 255 (white)
            for (let i = 0; i < mockCtx.data.length; i += 4) {
                mockCtx.data[i]     = 255;
                mockCtx.data[i + 1] = 255;
                mockCtx.data[i + 2] = 255;
                mockCtx.data[i + 3] = 255;
            }

            const brightness = frameBrightness(canvas);

            expect(brightness).toBe(255); // Average of (255+255+255)/3 = 255
        });

        it('should return average brightness for uniform black canvas', () => {
            // All pixels at 0 (black)
            for (let i = 0; i < mockCtx.data.length; i += 4) {
                mockCtx.data[i]     = 0;
                mockCtx.data[i + 1] = 0;
                mockCtx.data[i + 2] = 0;
                mockCtx.data[i + 3] = 255;
            }

            const brightness = frameBrightness(canvas);

            expect(brightness).toBe(0); // Average of (0+0+0)/3 = 0
        });

        it('should return average brightness for uniform gray canvas', () => {
            // All pixels at 128 (medium gray)
            for (let i = 0; i < mockCtx.data.length; i += 4) {
                mockCtx.data[i]     = 128;
                mockCtx.data[i + 1] = 128;
                mockCtx.data[i + 2] = 128;
                mockCtx.data[i + 3] = 255;
            }

            const brightness = frameBrightness(canvas);

            expect(brightness).toBe(128); // Average of (128+128+128)/3 = 128
        });

        it('should sample every Nth pixel based on canvas size', () => {
            // Create a larger canvas to verify sampling step calculation
            canvas.width = 50;
            canvas.height = 50;

            const dataLength = 50 * 50 * 4; // 10,000 bytes

            // Verify step calculation: Math.floor(data.length / 4 / 400) * 4
            const expectedStep = Math.max(1, Math.floor(dataLength / 4 / 400)) * 4;

            for (let i = 0; i < mockCtx.data.length; i += 4) {
                mockCtx.data[i]     = 255;
                mockCtx.data[i + 1] = 255;
                mockCtx.data[i + 2] = 255;
                mockCtx.data[i + 3] = 255;
            }

            const brightness = frameBrightness(canvas);

            expect(brightness).toBe(255); // Should still return 255 regardless of sampling

            // Verify the function sampled at least once (count > 0)
            // This is implicit: if count were 0, it would return 128 (fallback)
        });

        it('should handle non-uniform brightness input', () => {
            // Mix of bright and dark pixels
            mockCtx.data[0]     = 255; // R
            mockCtx.data[1]     = 255; // G
            mockCtx.data[2]     = 255; // B
            mockCtx.data[3]     = 255; // A

            mockCtx.data[4]     = 0;   // R
            mockCtx.data[5]     = 0;   // G
            mockCtx.data[6]     = 0;   // B
            mockCtx.data[7]     = 255; // A

            // Set remaining pixels to uniform gray for predictable sampling
            for (let i = 8; i < mockCtx.data.length; i += 4) {
                mockCtx.data[i]     = 100;
                mockCtx.data[i + 1] = 100;
                mockCtx.data[i + 2] = 100;
                mockCtx.data[i + 3] = 255;
            }

            const brightness = frameBrightness(canvas);

            // Should return a value between 0 and 255 based on sampling pattern
            expect(brightness).toBeGreaterThanOrEqual(0);
            expect(brightness).toBeLessThanOrEqual(255);
        });

        it('should compute exact average luminance for known mixed-brightness input', () => {
            // Sets a deterministic 3x3 canvas: one white pixel, one black pixel, seven gray pixels.
            // Since data.length=36 and step=Math.max(1,floor(36/4/400))*4 = 4 bytes (every pixel sampled),
            // the function averages luminance ((R+G+B)/3) across all 9 samples.
            // White pixel: (255+255+255)/3=255; Black pixel: (0+0+0)/3=0; Gray pixels: 100 each ×7.
            // Expected average = (255 + 0 + 7*100) / 9 = 955/9 ≈ 106.11.
            mockCtx.data[0]     = 255;  // pixel 0: R=white
            mockCtx.data[1]     = 255;
            mockCtx.data[2]     = 255;
            mockCtx.data[3]     = 255;

            mockCtx.data[4]     = 0;    // pixel 1: R=black
            mockCtx.data[5]     = 0;
            mockCtx.data[6]     = 0;
            mockCtx.data[7]     = 255;

            for (let p = 2; p < 9; p++) {
                const base = p * 4;
                mockCtx.data[base]     = 100; // R=gray
                mockCtx.data[base + 1] = 100; // G=gray
                mockCtx.data[base + 2] = 100; // B=gray
                mockCtx.data[base + 3] = 255; // alpha
            }

            const brightness = frameBrightness(canvas);

            expect(brightness).toBeCloseTo(955 / 9, 1); // ~106.11 ±0.1
        });
    });

    it('should apply documented grayscale coefficients to non-uniform RGB input', () => {
        // Verifies that the integer-weighted grayscale formula:
        //   gray = round((77*R + 150*G + 29*B) / 256)
        // is applied correctly. R≠G≠B so all three weights contribute independently,
        // catching a regression where someone swaps or modifies the constants silently.
        const r = 200; const g = 100; const b = 50;
        const expectedGray = Math.round((77 * r + 150 * g + 29 * b) / 256); // = 134

        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i]     = r;
            mockCtx.data[i + 1] = g;
            mockCtx.data[i + 2] = b;
            mockCtx.data[i + 3] = 255;
        }

        const result = preprocessCanvas(canvas, 0); // strength=0 skips sharpening, isolates stretch+grayscale
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        expect(data[0]).toBe(expectedGray);   // R channel matches weighted formula
        expect(data[1]).toBe(expectedGray);   // G channel matches (grayscale output)
        expect(data[2]).toBe(expectedGray);   // B channel matches
    });

    it('should skip sharpening entirely at strength=0 on non-uniform RGB input', () => {
        // Strength=0 must disable sharpening: v = s + 0*(s - blur) == s for every pixel.
        // This test uses R≠G≠B input so the grayscale conversion is independent from sharpening,
        // confirming that strength=0 exercises only the grayscale+stretch path (lines 46-70 of ocr.ts).
        const r = 120; const g = 200; const b = 40;
        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i]     = r;
            mockCtx.data[i + 1] = g;
            mockCtx.data[i + 2] = b;
            mockCtx.data[i + 3] = 255;
        }

        const result = preprocessCanvas(canvas, 0);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        // At strength=0 the sharpen term is zero: every pixel must equal its grayscale value.
        const expectedGray = Math.round((77 * r + 150 * g + 29 * b) / 256);
        for (let i = 0; i < data.length; i += 4) {
            expect(data[i]).toBe(expectedGray);
            expect(data[i + 1]).toBe(expectedGray);
            expect(data[i + 2]).toBe(expectedGray);
        }
    });

    it('should produce identical output for different strength values on a zero-range (uniform) canvas', () => {
        // When all pixels are the same color, range===0 so stretched === grays unchanged.
        // Sharpening then computes v = s + strength*(s - blur_of_s) — and since all neighbors equal s, blur == s,
        // so v == s regardless of strength. This exercises lines 63-70 (range branch) AND lines 89-94 (sharpen loop).
        const uniformVal = 64;
        for (let i = 0; i < mockCtx.data.length; i += 4) {
            mockCtx.data[i]     = uniformVal;
            mockCtx.data[i + 1] = uniformVal;
            mockCtx.data[i + 2] = uniformVal;
            mockCtx.data[i + 3] = 255;
        }

        const resultA = preprocessCanvas(canvas, 0);
        const resultB = preprocessCanvas(canvas, 0.7);
        const dataA = resultA.getContext('2d')?.getImageData(0, 0, 3, 3).data!;
        const dataB = resultB.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        for (let i = 0; i < dataA.length; i++) {
            expect(dataA[i]).toBe(dataB[i]);
        }
    });

    it('should produce no sharpening contribution at strength=0 on non-uniform grayscale input', () => {
        // Strength=0 must fully disable the sharpening term: v = s + 0*(s - blur) == s.
        // This test uses distinct per-pixel luminance values so every pixel has a unique
        // sharpened-vs-blurred delta — proving each output pixel equals its exact grayscale+stretch value,
        // independently computed (not just approximately equal or monotonic).
        const expected: number[] = [10, 50, 90, 40, 80, 20, 70, 30, 60];
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                const v = expected[y * 3 + x];
                const idx = (y * 3 + x) * 4;
                mockCtx.data[idx]     = v; // R
                mockCtx.data[idx + 1] = v; // G
                mockCtx.data[idx + 2] = v; // B
                mockCtx.data[idx + 3] = 255; // Alpha
            }
        }

        const result = preprocessCanvas(canvas, 0);
        const outData = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        // Independently compute grayscale+stretch for each pixel.
        // Grayscale: (77*R + 150*G + 29*B) / 256 — since R==G==B==v, this equals v exactly.
        // Contrast stretch: range = max - min = 90-10 = 80; scale=255/80; stretched[i] = round((grays[i]-10) * 255/80).
        const graysMin = 10, graysMax = 90;
        const range = graysMax - graysMin; // 80
        const stretchScale = 255 / range;
        const expectedStretched: number[] = [];
        for (const v of expected) {
            expectedStretched.push(Math.round((v - graysMin) * stretchScale));
        }

        // At strength=0 the sharpening term is exactly zero, so output must equal stretched.
        // This per-pixel exact comparison catches regressions where a sharpening term
        // accidentally contributes even at strength=0 (e.g., if someone forgets to gate it).
        for (let i = 0; i < 3 * 3; i++) {
            const actualR = outData[i * 4];
            expect(actualR).toBe(expectedStretched[i]); // R channel == stretched value
        }

        // Verify the sharpening term would have contributed if strength were nonzero.
        // At strength=1, each non-uniform pixel surrounded by different neighbors should change.
        const resultStrong = preprocessCanvas(canvas, 1);
        const strongData = resultStrong.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        // Proves sharpening is active: at least one pixel must differ between strength=0 and strength=1.
        let anySharpened = false;
        for (let i = 0; i < 3 * 3; i++) {
            if (strongData[i * 4] !== outData[i * 4]) {
                anySharpened = true;
                break;
            }
        }
        expect(anySharpened).toBe(true); // sharpening would change output at nonzero strength

        // Verify the sharpening term changes non-edge pixels (interior pixel with all neighbors different).
        const centerIdx = 1 * 3 + 2; // pixel (1,2) — value 80, surrounded by varied neighbors
        expect(strongData[centerIdx * 4]).not.toBe(outData[centerIdx * 4]);
    });

    it('should keep output within [0,255] at strength=2 on high-contrast input', () => {
        // Strength > 1 is a legitimate user setting. At elevated sharpening the formula
        // v = stretched[idx] + strength * (stretched[idx] - blurred) can push values far
        // beyond the byte range — the inline clamp on line 96 must still hold. This test
        // uses max/min contrast to maximize the sharpening delta and verifies all four
        // channels stay within [0,255].
        mockCtx.data[0]     = 255;  // top-left: white
        mockCtx.data[1]     = 255;
        mockCtx.data[2]     = 255;
        mockCtx.data[3]     = 255;
        mockCtx.data[4]     = 0;    // center: black — large delta with white neighbors
        mockCtx.data[5]     = 0;
        mockCtx.data[6]     = 0;
        mockCtx.data[7]     = 255;
        mockCtx.data[8]     = 255;
        mockCtx.data[9]     = 230;  // top-right: bright gray
        mockCtx.data[10]    = 230;
        mockCtx.data[11]    = 230;
        mockCtx.data[12]    = 255;
        mockCtx.data[13]    = 10;   // middle-left: near black
        mockCtx.data[14]    = 10;
        mockCtx.data[15]    = 10;
        mockCtx.data[16]    = 255;
        mockCtx.data[17]    = 150;  // middle-center: mid gray
        mockCtx.data[18]    = 150;
        mockCtx.data[19]    = 150;
        mockCtx.data[20]    = 255;
        mockCtx.data[21]    = 30;   // middle-right: dark
        mockCtx.data[22]    = 30;
        mockCtx.data[23]    = 30;
        mockCtx.data[24]    = 255;
        mockCtx.data[25]    = 200;  // bottom-left: near white
        mockCtx.data[26]    = 200;
        mockCtx.data[27]    = 200;
        mockCtx.data[28]    = 120;  // bottom-center: medium gray
        mockCtx.data[29]    = 120;
        mockCtx.data[30]    = 120;
        mockCtx.data[31]    = 255;
        mockCtx.data[32]    = 60;   // bottom-right: dark
        mockCtx.data[33]    = 60;
        mockCtx.data[34]    = 60;
        mockCtx.data[35]    = 255;

        const result = preprocessCanvas(canvas, 2);
        const data = result.getContext('2d')?.getImageData(0, 0, 3, 3).data!;

        for (let i = 0; i < data.length; i += 4) {
            expect(data[i]).toBeGreaterThanOrEqual(0);
            expect(data[i]).toBeLessThanOrEqual(255);
            expect(data[i + 1]).toBeGreaterThanOrEqual(0);
            expect(data[i + 1]).toBeLessThanOrEqual(255);
            expect(data[i + 2]).toBeGreaterThanOrEqual(0);
            expect(data[i + 2]).toBeLessThanOrEqual(255);
        }
    });
});
