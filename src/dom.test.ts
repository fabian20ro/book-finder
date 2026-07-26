import { describe, it, expect, beforeEach, vi } from 'vitest';
import { $, $$, $as, $first, getContext2D, trySelector } from './dom';

describe('dom helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('$', () => {
        it('returns matching element', () => {
            document.body.innerHTML = '<div id="test">Hello</div>';
            const el = $('#test');
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el.textContent).toBe('Hello');
        });

        it('throws for missing element', () => {
            expect(() => $('#nonexistent')).toThrow('Required DOM element not found: "#nonexistent"');
        });

        it('throws descriptive error for invalid CSS selector', () => {
            expect(() => $('[')).toThrow();
        });
    });

    describe('$as', () => {
        it('returns element cast to specific type', () => {
            document.body.innerHTML = '<video id="vid"></video>';
            const el = $as('#vid', HTMLVideoElement);
            expect(el).toBeInstanceOf(HTMLVideoElement);
        });

        it('returns canvas cast to HTMLCanvasElement', () => {
            document.body.innerHTML = '<canvas id="cvs"></canvas>';
            const el = $as('#cvs', HTMLCanvasElement);
            expect(el).toBeInstanceOf(HTMLCanvasElement);
        });

        it('validates element instanceof constructor', () => {
            document.body.innerHTML = '<div id="d"></div>';
            expect(() => $as('#d', HTMLVideoElement)).toThrow(
                'Element for "#d" is not an instance of HTMLVideoElement',
            );
        });

        it('throws for missing element', () => {
            expect(() => $as('#missing', HTMLVideoElement)).toThrow('Required DOM element not found');
        });
    });

    describe('$$', () => {
        it('returns matching elements as array', () => {
            document.body.innerHTML = '<div class="item">A</div><div class="item">B</div>';
            const els = $$('.item');
            expect(els).toHaveLength(2);
            expect(els[0].textContent).toBe('A');
            expect(els[1].textContent).toBe('B');
        });

        it('returns empty array for no matches', () => {
            document.body.innerHTML = '<div id="other">X</div>';
            const els = $$('.nonexistent');
            expect(Array.isArray(els)).toBe(true);
            expect(els).toEqual([]);
        });

        it('returns real Array, not NodeList', () => {
            document.body.innerHTML = '<span class="s">1</span><span class="s">2</span>';
            const els = $$('.s');
            expect(Array.isArray(els)).toBe(true);
            // Verify array-typed behavior: .map() must exist and work, ruling out raw NodeList.
            const texts = els.map(s => s.textContent);
            expect(texts).toEqual(['1', '2']);
        });

        it('returns elements in document order', () => {
            document.body.innerHTML = '<div class="d">third</div><div class="d">first</div><div class="d">second</div>';
            const els = $$('.d');
            expect(els).toHaveLength(3);
            expect(els[0].textContent).toBe('third');
            expect(els[1].textContent).toBe('first');
            expect(els[2].textContent).toBe('second');
        });
    });

    describe('getContext2D', () => {
        it('returns 2D context from canvas', () => {
            const canvas = document.createElement('canvas');
            const mockCtx = { canvas } as unknown as CanvasRenderingContext2D;
            vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any);

            const ctx = getContext2D(canvas);
            expect(ctx).toBe(mockCtx);
        });

        it('throws when getContext returns null', () => {
            const canvas = document.createElement('canvas');
            vi.spyOn(canvas, 'getContext').mockReturnValue(null);

            expect(() => getContext2D(canvas)).toThrow('Could not get 2D rendering context');
        });
    });

    describe('$first', () => {
        it('returns the first matching element', () => {
            document.body.innerHTML = '<span class="x">A</span><span class="x">B</span>';
            const el = $first('.x');
            expect(el).not.toBeNull();
            expect(el!.textContent).toBe('A');
        });

        it('returns null when no match', () => {
            document.body.innerHTML = '<div id="only">O</div>';
            const el = $first('.nonexistent');
            expect(el).toBeNull();
        });

        it('returns first element in document order for multiple matches', () => {
            document.body.innerHTML = '<p class="m">second</p><p class="m">first</p>';
            const el = $first('.m');
            expect(el).not.toBeNull();
            // querySelectorAll returns elements in document order; first is the first in DOM.
            expect(el!.textContent).toBe('second');
        });

        it('returns HTMLElement type', () => {
            document.body.innerHTML = '<div id="target">T</div>';
            const el = $first('#target');
            expect(el).toBeInstanceOf(HTMLElement);
            expect(el!.id).toBe('target');
        });

        it('handles complex selectors', () => {
            document.body.innerHTML = '<ul><li>one</li><li class="active">two</li></ul>';
            const el = $first('li.active');
            expect(el).not.toBeNull();
            expect(el!.textContent).toBe('two');
        });
    });

    describe('trySelector', () => {
        it('returns the first matching selector', () => {
            document.body.innerHTML = '<div class="a">A</div><span id="b">B</span>';
            const el = trySelector(['.nonexistent', '#b']);
            expect(el).not.toBeNull();
            expect(el!.id).toBe('b');
        });

        it('returns the first match when multiple selectors exist', () => {
            document.body.innerHTML = '<div id="first">F</div><span class="second">S</span>';
            const el = trySelector(['#first', '.second']);
            expect(el).not.toBeNull();
            expect(el!.id).toBe('first');
        });

        it('returns null when no selector matches', () => {
            document.body.innerHTML = '<div id="only">O</div>';
            const el = trySelector(['.missing1', '.missing2']);
            expect(el).toBeNull();
        });

        it('works with empty selector array', () => {
            const el = trySelector([]);
            expect(el).toBeNull();
        });

        it('returns HTMLElement type', () => {
            document.body.innerHTML = '<p class="target">P</p>';
            const el = trySelector(['.target']);
            expect(el).toBeInstanceOf(HTMLElement);
        });

        it('skips malformed selectors and continues to next', () => {
            document.body.innerHTML = '<div id="real">R</div>';
            // Malformed selector throws DOMException; trySelector must skip it.
            const result = trySelector(['[unclosed', '#real']);
            expect(result).not.toBeNull();
            expect(result!.id).toBe('real');
        });

        it('continues iterating when a selector returns null (no match)', () => {
            document.body.innerHTML = '<div id="target">T</div>';
            let queryCount = 0;
            const origQuery = document.querySelector.bind(document);
            vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => {
                queryCount++;
                return origQuery(sel);
            });
            // All selectors non-matching — should iterate all and return null.
            const el = trySelector(['.a', '.b', '#target']);
            expect(el).not.toBeNull();
            expect(el!.id).toBe('target');
            expect(queryCount).toBe(3);
        });

        it('skips non-matching selectors and returns null when all are valid but empty', () => {
            document.body.innerHTML = '<div id="other">X</div>';
            const el = trySelector(['.a', '.b', '#nonexistent']);
            expect(el).toBeNull();
        });
    });
});
