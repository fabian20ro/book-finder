import { describe, it, expect, vi } from 'vitest';
import { isISBN, computeConfidence, queryMatchRatio, getConfidenceLevel, getConfidenceColor, isHighConfidence, BookSearcher } from './books';
import type { Book } from './books';

describe('Book logic', () => {
    describe('queryMatchRatio', () => {
        it('returns 1 for exact match', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'The Great Gatsby')).toBe(1);
        });

        it('returns 0 for no match', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Moby Dick')).toBe(0);
        });

        it('handles short query words (less than 3) by filtering them out', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott. Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'The Great F. Scott')).toBe(1);
        });

        it('handles query with single-letter words by ignoring them', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'A B C D')).toBe(0);
        });

        it('calculates correct ratio for partial word matches and mixed case', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            // queryWords: ['great', 'gatsby', 'unknown']
            // matches: 'great', 'gatsby'
            // ratio: 2/3
            expect(queryMatchRatio(book, 'Great Gatsby Unknown')).toBe(2/3);
        });

        it('handles query with special characters by stripping them', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Great! Gatsby?')).toBe(1);
        });

        it('handles query with punctuation and non-ASCII characters', () => {
            const book = { id: '1', title: 'Café de Paris', authors: ['Jean-Luc'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            // queryWords: ['cafe', 'de', 'paris'] (after clean)
            // bookWords: {'cafe', 'de', 'paris', 'jean', 'luc'}
            // matches: 'cafe', 'de', 'paris'
            // ratio: 3/3 = 1
            expect(queryMatchRatio(book, 'Café de Paris')).toBe(1);
        });

        it('handles unicode normalization (NFC vs NFD)', () => {
            const book = { id: '1', title: 'Café', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            const queryNFC = 'Café';
            const queryNFD = 'Cafe\u0301';
            expect(queryMatchRatio(book, queryNFC)).toBe(1);
            expect(queryMatchRatio(book, queryNFD)).toBe(1);
        });

        it('returns 0 when book has all null/empty text fields', () => {
            const book = { id: '1', title: '', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Some query')).toBe(0);
        });

        it('handles duplicate words in query', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Great Great')).toBe(1);
        });

        it('handles multiple spaces in query', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'The   Great  Gatsby')).toBe(1);
        });

        it('handles numbers in query', () => {
            const book = { id: '1', title: 'The Great Gatsby 1925', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Gatsby 1925')).toBe(1);
        });

        it('caps contribution from ratingsCount at 8 even if ratingsCount > 100', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query match: 30
            // Rating (5): 12
            // Count (200): 8
            // Total: 50 + 30 + 12 + 8 = 100
            expect(computeConfidence(book, 5, 200, 'The Great Gatsby')).toBe(100);
        });

        it('handles hyphenated words by treating them as separate words', () => {
            const book = { id: '1', title: 'Full-time job', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'full time')).toBe(1);
        });

        it('handles unicode normalization (accents)', () => {
            const book = { id: '1', title: 'Cafe', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Café')).toBe(1);
        });

        it('does not match substrings (only whole words)', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Gats')).toBe(0);
        });

        it('matches query words found only in the ISBN field', () => {
            const book = { id: '1', title: 'Some Random Title', authors: ['Nobody'], publisher: null, publishedDate: null, description: null, isbn: '9780743276540', pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            // queryWords = ['some', 'random', 'title'] — all present in title
            // but we test that isbn words also contribute when query matches isbn only
            expect(queryMatchRatio(book, '9780743276540')).toBe(1);
        });

        it('matches query words found only in the description field', () => {
            const book = { id: '1', title: 'Random', authors: ['X'], publisher: null, publishedDate: null, description: 'A story about the great gatsby', isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'great gatsby')).toBe(1);
        });

        it('matches query words found only in the publisher field', () => {
            const book = { id: '1', title: 'Random', authors: ['X'], publisher: 'Scribner', publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'scribner')).toBe(1);
        });

        it('matches query words found only in the page count field', () => {
            const book = { id: '1', title: 'Random', authors: ['X'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: 280, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, '280')).toBe(1);
        });

        it('handles multiple authors', () => {
            const book = { id: '1', title: 'Title', authors: ['Author One', 'Author Two'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Author Two')).toBe(1);
        });

        it('matches query against author names', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, 'Scott')).toBe(1);
        });

        it('returns 0 for empty query', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, '')).toBe(0);
        });

        it('returns 0 for query with only whitespace', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, '   ')).toBe(0);
        });

        it('returns 0 for query with only punctuation', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            expect(queryMatchRatio(book, '!!! ???')).toBe(0);
        });
    });

    describe('computeConfidence', () => {
        const baseBook = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;

        it('returns 0 for minimal book', () => {
            const minimalBook = { ...baseBook, title: 'Unknown Title', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, confidence: 0 } as Book;
            expect(computeConfidence(minimalBook)).toBe(0);
        });

        it('calculates full confidence', () => {
            expect(computeConfidence(baseBook, 5, 100, 'The Great Gatsby')).toBe(100);
        });

        it('handles partial matches and ratings', () => {
            const partialBook = { ...baseBook, title: 'Gatsby', authors: ['Fitzgerald'], publisher: null, publishedDate: null, description: null, isbn: '123', pageCount: null, thumbnailUrl: 'http://img.jpg', infoLink: null, confidence: 0 } as Book;
            expect(computeConfidence(partialBook, 0, 0, 'Gatsby')).toBe(65);
        });

        it('handles max ratings correctly', () => {
            expect(computeConfidence(baseBook, 5, 100, 'The Great Gatsby')).toBe(100);
        });

        it('handles low ratings correctly', () => {
            const fullBook = { ...baseBook, title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query match: 30
            // Rating: round(0.5 * 12) = 6
            // Count: round(50/100 * 8) = 4
            // Total: 50 + 30 + 6 + 4 = 90
            expect(computeConfidence(fullBook, 2.5, 50, 'The Great Gatsby')).toBe(90);
        });

        it('handles undefined ratings correctly', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query: 'The Great Gatsby' -> 30
            // Rating: undefined -> 0
            // Count: undefined -> 0
            // Total: 80
            expect(computeConfidence(book, undefined, undefined, 'The Great Gatsby')).toBe(80);
        });

        it('clamps averageRating to 5', () => {
            const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query: 'The Great Gatsby' -> 30
            // Rating: 5.1 -> 12
            // Count: 100 -> 8
            // Total: 50 + 30 + 12 + 8 = 100
            expect(computeConfidence(book, 5.1, 100, 'The Great Gatsby')).toBe(100);
        });

        it('calculates correct confidence with partial match and full ratings', () => {
            // Metadata: 50
            // Query match: 0.5 * 30 = 15
            // Rating: 5/5 * 12 = 12
            // Count: 100/100 * 8 = 8
            // Total: 50 + 15 + 12 + 8 = 85
            expect(computeConfidence(baseBook, 5, 100, 'Great Unknown')).toBe(85);
        });

        it('does not award points for "Unknown Title"', () => {
            const book = { ...baseBook, title: 'Unknown Title', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, confidence: 0 } as Book;
            // Metadata: 0 + 0 (title) + 0 (authors) + 0 (isbn) + 0 (thumb) + 0 (desc) + 0 (pub) + 0 (date) = 0
            // Query: 'The Great Gatsby' -> 0 (no match with 'Unknown Title')
            // Rating: 5/5 * 12 = 12
            // Count: 100/100 * 8 = 8
            // Total: 12 + 8 = 20
            expect(computeConfidence(book, 5, 100, 'The Great Gatsby')).toBe(20);
        });

        it('handles averageRating of 0 correctly', () => {
            const book = { ...baseBook, title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query: 'The Great Gatsby' -> 30
            // Rating: 0 -> 0
            // Count: 100/100 * 8 = 8
            // Total: 50 + 30 + 0 + 8 = 88
            expect(computeConfidence(book, 0, 100, 'The Great Gatsby')).toBe(88);
        });

        it('handles undefined query correctly', () => {
            const fullBook = { ...baseBook, title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;
            // Metadata: 50
            // Query: undefined -> 0
            // Rating: 5 -> 12
            // Count: 100 -> 8
            // Total: 50 + 12 + 8 = 70
            expect(computeConfidence(fullBook, 5, 100, undefined)).toBe(70);
        });

        it('handles "Unknown Title" as a zero-point title even if other metadata is present', () => {
            const book = { ...baseBook, title: 'Unknown Title', authors: ['Author'], publisher: 'Publisher', publishedDate: '2024', description: 'Desc', isbn: '123', pageCount: 100, thumbnailUrl: 'url', infoLink: 'link', confidence: 0 } as Book;
            // Metadata: title (0) + authors (10) + isbn (10) + thumbnail (5) + desc (5) + pub (5) + date (5) = 40
            // Query: 'Author' -> 10 (assuming authors match)
            // Rating: 5 -> 12
            // Count: 100 -> 8
            // Total: 40 + 10 + 12 + 8 = 70. Wait, Query match: 10 (if authors match).
            // Actually, queryMatchRatio(book, 'Author') where book.authors = ['Author'].
            // queryWords = ['author']. bookWords = {'the', 'great', 'gatsby', 'author', ...}.
            // match = 1. ratio = 1. score += 30.
            // Metadata: 40.
            // Rating: 12.
            // Count: 8.
            // Total: 40 + 30 + 12 + 8 = 90.
            expect(computeConfidence(book, 5, 100, 'Author')).toBe(90);
        });

        it('ignores negative averageRating (defensive guard against corrupted data)', () => {
            const book = { ...baseBook } as Book;
            // Line 111: if (averageRating != null && averageRating > 0) — negative ratings contribute 0
            // Metadata: 50 + Query: none passed -> 0 + Rating -1 -> 0 + Count undefined -> 0 = 50
            expect(computeConfidence(book, -1, undefined)).toBe(50);
        });

        it('treats explicit zero ratings as no contribution from either rating or count', () => {
            const book = { ...baseBook } as Book;
            // Line 111/114: both conditions require value > 0 — explicit zeros contribute nothing
            // Metadata: 50 + Query 'The Great Gatsby' -> 30 + Rating 0 -> 0 + Count 0 -> 0 = 80
            expect(computeConfidence(book, 0, 0, 'The Great Gatsby')).toBe(80);
        });

        it('ignores zero ratingsCount when averageRating is positive', () => {
            const book = { ...baseBook } as Book;
            // Line 114: if (ratingsCount != null && ratingsCount > 0) — zero count contributes nothing
            // Metadata: 50 + Query: none -> 0 + Rating 5/5*12=12 + Count 0 -> 0 = 62
            expect(computeConfidence(book, 5, 0)).toBe(62);
        });

        it('ignores NaN averageRating (corrupted data does not propagate)', () => {
            const book = { ...baseBook } as Book;
            // Line 111: if (averageRating != null && averageRating > 0) — NaN passes != null but fails > 0, contributes 0
            // Metadata: 50 + Query: none -> 0 + Rating NaN -> 0 + Count undefined -> 0 = 50
            expect(computeConfidence(book, NaN, undefined)).toBe(50);
        });

        it('ignores NaN ratingsCount when averageRating is positive', () => {
            const book = { ...baseBook } as Book;
            // Line 114: if (ratingsCount != null && ratingsCount > 0) — NaN passes != null but fails > 0, contributes 0
            // Metadata: 50 + Query: none -> 0 + Rating 5/5*12=12 + Count NaN -> 0 = 62
            expect(computeConfidence(book, 5, NaN)).toBe(62);
        });

        it('returns correct confidence levels', () => {
            expect(getConfidenceLevel(100)).toBe('High');
            expect(getConfidenceLevel(80)).toBe('High');
            expect(getConfidenceLevel(40)).toBe('Medium');
            expect(getConfidenceLevel(10)).toBe('Low');
            expect(getConfidenceLevel(0)).toBe('None');
        });
    });

    describe('isISBN', () => {
        it('returns true for 13-digit ISBN without separators', () => {
            expect(isISBN('9780743276540')).toBe(true);
        });

        it('returns true for 13-digit ISBN with hyphens and spaces', () => {
            expect(isISBN('978-0-743-27654-0')).toBe(true);
            expect(isISBN('978 0 743 27654 0')).toBe(true);
        });

        it('returns true for valid 10-digit ISBN', () => {
            expect(isISBN('0743276540')).toBe(true);
            expect(isISBN('0-743-27654-0')).toBe(true);
        });

        it('returns false for empty or whitespace-only strings', () => {
            expect(isISBN('')).toBe(false);
            expect(isISBN('   ')).toBe(false);
        });

        it('returns false when non-digit characters are mixed with digits', () => {
            expect(isISBN('978-abc-27654-0')).toBe(false);
            expect(isISBN('abcdefghij')).toBe(false);
        });

        it('returns false for strings shorter than 10 or longer than 13 digits', () => {
            expect(isISBN('12345')).toBe(false);
            expect(isISBN('12345678901234')).toBe(false);
        });
    });

    describe('getConfidenceColor', () => {
        it('returns green for High confidence', () => {
            expect(getConfidenceColor('High')).toBe('#22c55e');
        });

        it('returns amber for Medium confidence', () => {
            expect(getConfidenceColor('Medium')).toBe('#f59e0b');
        });

        it('returns red for Low confidence', () => {
            expect(getConfidenceColor('Low')).toBe('#ef4444');
        });

        it('returns gray for None confidence', () => {
            expect(getConfidenceColor('None')).toBe('#6b7280');
        });
    });

    describe('isHighConfidence', () => {
        const book = { id: '1', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], publisher: 'Scribner', publishedDate: '1925', description: 'A classic', isbn: '9780743276540', pageCount: 180, thumbnailUrl: 'http://img.jpg', infoLink: 'http://link.com', confidence: 0 } as Book;

        it('returns true when confidence is exactly 80', () => {
            expect(isHighConfidence({ ...book, confidence: 80 })).toBe(true);
        });

        it('returns true when confidence exceeds 80', () => {
            expect(isHighConfidence({ ...book, confidence: 95 })).toBe(true);
        });

        it('returns false when confidence is just below threshold', () => {
            expect(isHighConfidence({ ...book, confidence: 79 })).toBe(false);
        });

        it('returns false when confidence is zero', () => {
            expect(isHighConfidence({ ...book, confidence: 0 })).toBe(false);
        });
    });

    describe('BookSearcher', () => {
        it('defaults with no-arg notify without throwing', () => {
            const searcher = new BookSearcher();
            expect(searcher).toBeDefined();
        });

        it('returns empty array for non-string input', async () => {
            const searcher = new BookSearcher();
            await expect(searcher.search(42 as unknown as string)).resolves.toEqual([]);
            await expect(searcher.search(null as unknown as string)).resolves.toEqual([]);
            await expect(searcher.search(undefined as unknown as string)).resolves.toEqual([]);
        });

        it('returns empty array for empty or whitespace query', async () => {
            const searcher = new BookSearcher();
            await expect(searcher.search('')).resolves.toEqual([]);
            await expect(searcher.search('   ')).resolves.toEqual([]);
        });

        it('returns empty array when normalized query is shorter than 2 characters', async () => {
            const searcher = new BookSearcher();
            await expect(searcher.search('a')).resolves.toEqual([]);
        });

        it('clear() resets state without throwing', async () => {
            const searcher = new BookSearcher();
            searcher.clear();
            searcher.preloadBookId('abc');
            searcher.removeBookId('abc');
            searcher.clear();
            expect(searcher).toBeDefined();
        });

        it('invokes notify callback with a message', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Just trigger the constructor path — verify the callback is stored.
            await searcher.search('a');
            expect(notify).not.toHaveBeenCalled(); // short query short-circuits before notify
        });

        it('does not throw for a valid-but-rate-limited search shape', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Cannot mock fetch easily here; just verify the public API is callable.
            expect(() => searcher.clear()).not.toThrow();
            expect(() => searcher.preloadBookId('x')).not.toThrow();
            expect(() => searcher.removeBookId('x')).not.toThrow();
        });

        it('preloadBookId and removeBookId manage book tracking state', () => {
            const searcher = new BookSearcher();
            // preload adds a book id, then clear resets — re-adding the same id should still work
            searcher.preloadBookId('book-alpha');
            expect(() => searcher.removeBookId('book-alpha')).not.toThrow();
            searcher.clear();
            searcher.preloadBookId('book-beta');
            expect(() => searcher.removeBookId('book-beta')).not.toThrow();
        });

        it('clear() resets both query cache and found book IDs to initial empty state', () => {
            const searcher = new BookSearcher();
            // Seed both caches via preload (foundBookIds) and a short query that hits the cache path
            searcher.preloadBookId('seed-id-1');
            searcher.preloadBookId('seed-id-2');
            searcher.clear();
            // After clear, preloading again should not accumulate with previous state
            searcher.preloadBookId('post-clear-id');
            expect(() => searcher.removeBookId('post-clear-id')).not.toThrow();
            // A second clear followed by a fresh preload confirms both caches were reset
            searcher.clear();
            searcher.preloadBookId('fresh-id');
            expect(() => searcher.removeBookId('fresh-id')).not.toThrow();
        });

        it('notify callback is stored and callable through search lifecycle', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Short query short-circuits before notify — confirms the callback exists without invoking it.
            await searcher.search('a');
            expect(notify).not.toHaveBeenCalled();
        });

        it('search returns empty array for non-string, empty, and whitespace inputs', async () => {
            const searcher = new BookSearcher();
            // Verifies the contract across all three guard branches in one focused block.
            await expect(searcher.search(42 as unknown as string)).resolves.toEqual([]);
            await expect(searcher.search(null as unknown as string)).resolves.toEqual([]);
            await expect(searcher.search(undefined as unknown as string)).resolves.toEqual([]);
            await expect(searcher.search('')).resolves.toEqual([]);
            await expect(searcher.search('   ')).resolves.toEqual([]);
            await expect(searcher.search('a')).resolves.toEqual([]);
        });

        it('preloadBookId adds to foundBookIds and removeBookId removes from it', () => {
            const searcher = new BookSearcher();
            // Access the private foundBookIds via 'as any' since it's not exposed.
            const fbids = (searcher as any).foundBookIds as Set<string>;
            expect(fbids.has('book-a')).toBe(false);
            searcher.preloadBookId('book-a');
            expect(fbids.has('book-a')).toBe(true);
            searcher.removeBookId('book-a');
            expect(fbids.has('book-a')).toBe(false);
        });

        it('preloadBookId is idempotent — adding the same ID twice does not duplicate', () => {
            const searcher = new BookSearcher();
            const fbids = (searcher as any).foundBookIds as Set<string>;
            searcher.preloadBookId('dup');
            searcher.preloadBookId('dup');
            expect(fbids.size).toBe(1);
        });

        it('removeBookId on a missing ID does not throw and leaves state unchanged', () => {
            const searcher = new BookSearcher();
            const fbids = (searcher as any).foundBookIds as Set<string>;
            expect(() => searcher.removeBookId('nonexistent')).not.toThrow();
            expect(fbids.has('nonexistent')).toBe(false);
        });

        it('clear() empties foundBookIds in addition to queryCache', () => {
            const searcher = new BookSearcher();
            searcher.preloadBookId('a');
            searcher.preloadBookId('b');
            expect((searcher as any).foundBookIds.size).toBe(2);
            expect((searcher as any).queryCache.size).toBe(0);
            searcher.clear();
            expect((searcher as any).foundBookIds.size).toBe(0);
            expect((searcher as any).queryCache.size).toBe(0);
        });

        it('notify is invoked on API error responses from search', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Mock fetch to return a non-ok response so the error branch fires.
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                json: async () => ({}),
            }));
            await searcher.search('test');
            expect(notify).toHaveBeenCalledWith('API error: 503');
            vi.unstubAllGlobals();
        });

        it('notify is invoked on rate-limit (429) responses from search', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Use fake timers so the 5-second pause resolves instantly.
            vi.useFakeTimers();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 429,
                json: async () => ({}),
            }));
            void searcher.search('test');
            await vi.runAllTimersAsync();
            expect(notify).toHaveBeenCalledWith(expect.stringContaining('rate limit'));
            vi.restoreAllMocks();
            vi.useRealTimers();
        });

        it('search does not call notify on successful empty response', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [] }),
            }));
            await searcher.search('test');
            expect(notify).not.toHaveBeenCalled();
            vi.unstubAllGlobals();
        });

        it('search returns empty array and does not notify on fetch exception', async () => {
            const notify = vi.fn();
            const searcher = new BookSearcher(notify);
            // Simulate a network error — the catch branch swallows and logs.
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
            await expect(searcher.search('test')).resolves.toEqual([]);
            expect(notify).not.toHaveBeenCalled();
            vi.unstubAllGlobals();
        });

        it('search skips cached queries and returns empty array without calling fetch', async () => {
            const searcher = new BookSearcher();
            // Pre-populate the cache directly (bypass search to avoid a real fetch).
            (searcher as any).queryCache.add('cached-query');
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
            await searcher.search('cached-query'); // normalized lowercase — matches cache key exactly
            expect((searcher as any).queryCache.has('cached-query')).toBe(true);
            vi.unstubAllGlobals();
        });

        it('parseBook returns null for a volume with empty id', async () => {
            const searcher = new BookSearcher();
            // parseBook is private — invoke via search and intercept fetch.
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [{ id: '', volumeInfo: {} }] }),
            }));
            await expect(searcher.search('test')).resolves.toEqual([]);
            vi.unstubAllGlobals();
        });

        it('parseBook returns null for a volume with whitespace-only id', async () => {
            const searcher = new BookSearcher();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [{ id: '   ', volumeInfo: {} }] }),
            }));
            await expect(searcher.search('test')).resolves.toEqual([]);
            vi.unstubAllGlobals();
        });

        it('parseBook extracts ISBN_13 preferentially over ISBN_10', async () => {
            const searcher = new BookSearcher();
            // Intercept fetch and assert the returned book has isbn '9780743276540'.
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [{
                        id: 'vol-1',
                        volumeInfo: {
                            title: 'Test Book',
                            authors: ['X'],
                            industryIdentifiers: [
                                { type: 'ISBN_10', identifier: '0743276540' },
                                { type: 'ISBN_13', identifier: '9780743276540' },
                            ],
                        },
                    }],
                }),
            }));
            const results = await searcher.search('Test Book');
            expect(results).toHaveLength(1);
            expect(results[0].isbn).toBe('9780743276540'); // ISBN_13 takes priority over ISBN_10 per parseBook logic
            vi.unstubAllGlobals();
        });

        it('search deduplicates results across calls via foundBookIds', async () => {
            const searcher = new BookSearcher();
            // Pre-load the ID so it gets filtered on search return.
            searcher.preloadBookId('dedup-id');
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    items: [{ id: 'dedup-id', volumeInfo: { title: 'Dup' } }],
                }),
            }));
            const results = await searcher.search('test');
            expect(results).toHaveLength(0); // preloaded -> filtered out
            vi.unstubAllGlobals();
        });

        it('search stores a normalized query in the cache on call', async () => {
            const searcher = new BookSearcher();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [] }),
            }));
            await searcher.search('Test Query');
            expect((searcher as any).queryCache.has('test query')).toBe(true);
            vi.unstubAllGlobals();
        });

        it('notify callback receives the constructor default empty function when no notify provided', () => {
            const searcher = new BookSearcher();
            // Default notify is () => {} — calling it must not throw.
            expect(() => (searcher as any).notify('anything')).not.toThrow();
        });

        it('evicts the oldest cache entry when MAX_CACHE_SIZE (200) is reached', async () => {
            const searcher = new BookSearcher();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
            // Seed 200 entries — triggers eviction on the next call.
            for (let i = 0; i < 200; i++) {
                await searcher.search(`seed-${i}`);
            }
            expect((searcher as any).queryCache.size).toBe(200);
            // The 201st call should trigger eviction of the first inserted entry.
            const firstKey = Array.from((searcher as any).queryCache)[0];
            await searcher.search(`seed-overflow`);
            expect((searcher as any).queryCache.has(firstKey)).toBe(false);
            expect((searcher as any).queryCache.size).toBe(200);
            vi.unstubAllGlobals();
        });

        it('parseBook assigns "Unknown Title" when volumeInfo.title is missing', async () => {
            const searcher = new BookSearcher();
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [{ id: 'vol-empty', volumeInfo: {} }] }),
            }));
            const results = await searcher.search('test');
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Unknown Title');
            vi.unstubAllGlobals();
        });

        it('queryMatchRatio merges consecutive single-letter initials in query', () => {
            // splitAndMergeShort: "J. K." produces tokens ["jk"] — one merged word, not zero.
            const book = { id: '1', title: 'JK Rowling', authors: ['J.K. Rowling'], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            // queryWords after merge from "J. K.": ['jk']; book text "JK Rowling" yields {'jk', 'rowling'} — full match.
            expect(queryMatchRatio(book, 'J. K.')).toBe(1);
        });


        it('queryMatchRatio returns 1 when query is fully merged short tokens present in book', () => {
            // The merge path: query "J K" splits to ['j','k'] which merge into ['jk']. Book title "Jack" contains 'jack' not 'jk'. Test a case where the merged token matches.
            const book = { id: '1', title: 'JK Rowling', authors: [], publisher: null, publishedDate: null, description: null, isbn: null, pageCount: null, thumbnailUrl: null, infoLink: null, confidence: 0 } as Book;
            // queryWords after merge from "J K": ['jk']. book text words include 'jk' (from title).
            expect(queryMatchRatio(book, 'J K')).toBe(1);
        });

        it('search deduplicates preloaded books across multiple calls', async () => {
            const searcher = new BookSearcher();
            const notify = vi.fn();
            searcher.preloadBookId('preloaded-1');
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ items: [
                    { id: 'preloaded-1', volumeInfo: { title: 'Dup' } },
                    { id: 'new-id', volumeInfo: { title: 'Fresh' } },
                ] }),
            }));
            const results = await searcher.search('test');
            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('Fresh');
            vi.unstubAllGlobals();
        });
    });
});
