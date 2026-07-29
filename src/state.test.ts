import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getState, update, addBook, removeBook, moveBook, clearBooks, setView, addCandidates, removeCandidateById, clearAll, clearCandidates, toast, on, emit } from './state';

describe('update (edge cases)', () => {
    it('does not emit change when updating to the same value', () => {
        const listener = vi.fn();
        on('change', listener);
        update({ isScanning: false }); // already false by default
        expect(listener).not.toHaveBeenCalled();
    });

    it('handles empty patch without emitting', () => {
        const listener = vi.fn();
        on('change', listener);
        update({});
        expect(listener).not.toHaveBeenCalled();
    });

    it('returns current state with all fields after partial update', () => {
        update({ autoScan: true, scanCount: 5 });
        const s = getState();
        expect(s.autoScan).toBe(true);
        expect(s.scanCount).toBe(5);
        // Verify other fields preserved
        expect(s.books).toEqual([]);
        expect(s.isScanning).toBe(false);
        expect(s.view).toBe('home');
        expect(s.ocrLanguage).toBe('ron');
    });
});

import type { Book } from './books';

function makeBook(overrides: Partial<Book> = {}): Book {
    return {
        id: 'book-1',
        title: 'Test Book',
        authors: ['Author A'],
        publisher: 'Publisher',
        publishedDate: '2024',
        description: 'A test book',
        isbn: '1234567890',
        pageCount: 200,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        infoLink: 'https://example.com/book',
        confidence: 75,
        ...overrides,
    };
}

describe('state', () => {
    beforeEach(() => {
        // Reset state to defaults
        update({
            books: [],
            candidateBooks: [],
            candidateFilter: '',
            isScanning: false,
            autoScan: false,
            scanCount: 0,
            lastDetectedText: '',
            error: null,
            view: 'home',
            isProcessingImage: false,
            ocrReady: false,
            ocrLanguage: 'ron',
            isChangingLanguage: false,
        });
    });

    describe('getState', () => {
        it('returns current state', () => {
            const state = getState();
            expect(state.books).toEqual([]);
            expect(state.isScanning).toBe(false);
            expect(state.autoScan).toBe(false);
            expect(state.view).toBe('home');
            expect(state.isProcessingImage).toBe(false);
            expect(state.ocrReady).toBe(false);
            expect(state.ocrLanguage).toBe('ron');
            expect(state.isChangingLanguage).toBe(false);
            expect(state.candidateFilter).toBe('');
        });
    });

    describe('update', () => {
        it('merges partial state', () => {
            update({ isScanning: true, scanCount: 5 });
            expect(getState().isScanning).toBe(true);
            expect(getState().scanCount).toBe(5);
        });

        it('emits change event', () => {
            const listener = vi.fn();
            on('change', listener);
            update({ scanCount: 1 });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('updates view field', () => {
            update({ view: 'scan' });
            expect(getState().view).toBe('scan');
        });

        it('sets view via setView helper', () => {
            setView('scan');
            expect(getState().view).toBe('scan');
            setView('home');
            expect(getState().view).toBe('home');
        });

        it('emits change event via setView', () => {
            const listener = vi.fn();
            on('change', listener);
            setView('scan');
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('throws for unknown view mode', () => {
            expect(() => setView('home' as any)).not.toThrow();
            // @ts-expect-error — deliberately invalid input to verify runtime guard
            expect(() => setView('dashboard')).toThrow(/Invalid view mode.*"dashboard"/);
        });

        it('updates autoScan field', () => {
            update({ autoScan: false });
            expect(getState().autoScan).toBe(false);
        });

        it('updates isProcessingImage field', () => {
            update({ isProcessingImage: true });
            expect(getState().isProcessingImage).toBe(true);
        });

        it('updates ocrReady field', () => {
            update({ ocrReady: true });
            expect(getState().ocrReady).toBe(true);
        });

        it('updates ocrLanguage field', () => {
            update({ ocrLanguage: 'eng' });
            expect(getState().ocrLanguage).toBe('eng');
        });

        it('updates isChangingLanguage field', () => {
            update({ isChangingLanguage: true });
            expect(getState().isChangingLanguage).toBe(true);
        });

        it('updates candidateFilter field', () => {
            update({ candidateFilter: 'search term' });
            expect(getState().candidateFilter).toBe('search term');
        });

        it('updates lastDetectedText via OCR result parsing', () => {
            update({ lastDetectedText: 'some detected text from OCR' });
            expect(getState().lastDetectedText).toBe('some detected text from OCR');
        });

        it('preserves other fields when updating lastDetectedText', () => {
            update({ scanCount: 3, view: 'scan' });
            update({ lastDetectedText: 'new text' });
            const s = getState();
            expect(s.lastDetectedText).toBe('new text');
            expect(s.scanCount).toBe(3);
            expect(s.view).toBe('scan');
        });

        it('handles empty string for lastDetectedText', () => {
            update({ lastDetectedText: 'some text' });
            update({ lastDetectedText: '' });
            expect(getState().lastDetectedText).toBe('');
        });

        it('emits change when updating lastDetectedText', () => {
            const listener = vi.fn();
            on('change', listener);
            update({ lastDetectedText: 'detected' });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('updates error field via state patch', () => {
            update({ error: 'some error message' });
            expect(getState().error).toBe('some error message');
        });

        it('sets error to null on recovery', () => {
            update({ error: 'a problem' });
            update({ error: null });
            expect(getState().error).toBeNull();
        });
    });

    describe('addBook', () => {
        it('adds a book and returns true', () => {
            const book = makeBook();
            const result = addBook(book);
            expect(result).toBe(true);
            expect(getState().books).toHaveLength(1);
            expect(getState().books[0].title).toBe('Test Book');
        });

        it('rejects duplicate book by id', () => {
            addBook(makeBook({ id: 'dup' }));
            const result = addBook(makeBook({ id: 'dup', title: 'Different Title' }));
            expect(result).toBe(false);
            expect(getState().books).toHaveLength(1);
        });

        it('allows different books', () => {
            addBook(makeBook({ id: 'a' }));
            addBook(makeBook({ id: 'b' }));
            expect(getState().books).toHaveLength(2);
        });

        it('emits change event', () => {
            const listener = vi.fn();
            on('change', listener);
            addBook(makeBook());
            expect(listener).toHaveBeenCalled();
        });

        it('trims thumbnailUrl and infoLink during addBook', () => {
            addBook(makeBook({
                thumbnailUrl: '  https://example.com/thumb.jpg  ',
                infoLink: '  https://example.com/book  ',
            }));
            const [book] = getState().books;
            expect(book.thumbnailUrl).toBe('https://example.com/thumb.jpg');
            expect(book.infoLink).toBe('https://example.com/book');
        });
    });

    describe('removeBook', () => {
        it('removes book at index and returns it', () => {
            addBook(makeBook({ id: 'a', title: 'First' }));
            addBook(makeBook({ id: 'b', title: 'Second' }));

            const removed = removeBook(0);
            expect(removed).not.toBeNull();
            expect(removed!.title).toBe('First');
            expect(getState().books).toHaveLength(1);
            expect(getState().books[0].title).toBe('Second');
        });

        it('allows re-adding a book after removal', () => {
            addBook(makeBook({ id: 'readd', title: 'Original' }));
            removeBook(0);
            const result = addBook(makeBook({ id: 'readd', title: 'Replaced' }));
            expect(result).toBe(true);
            expect(getState().books[0].title).toBe('Replaced');
        });

        it('returns null for invalid index', () => {
            expect(removeBook(-1)).toBeNull();
            expect(removeBook(0)).toBeNull();
            expect(removeBook(100)).toBeNull();
        });

        it('emits change event', () => {
            addBook(makeBook());
            const listener = vi.fn();
            on('change', listener);
            removeBook(0);
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('moveBook', () => {
        it('reorders books between valid indices', () => {
            addBook(makeBook({ id: 'a', title: 'First' }));
            addBook(makeBook({ id: 'b', title: 'Second' }));
            addBook(makeBook({ id: 'c', title: 'Third' }));

            moveBook(0, 2);
            const books = getState().books;
            expect(books[0].id).toBe('b');
            expect(books[1].id).toBe('c');
            expect(books[2].id).toBe('a');
        });

        it('does not emit change when moving same index to itself', () => {
            addBook(makeBook());
            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 0);
            expect(listener).not.toHaveBeenCalled();
        });

        it('returns without emitting for negative fromIndex', () => {
            addBook(makeBook({ id: 'a' }));
            const listener = vi.fn();
            on('change', listener);
            moveBook(-1, 0);
            expect(listener).not.toHaveBeenCalled();
        });

        it('returns without emitting for fromIndex out of bounds', () => {
            addBook(makeBook());
            const listener = vi.fn();
            on('change', listener);
            moveBook(5, 0);
            expect(listener).not.toHaveBeenCalled();
        });

        it('returns without emitting for toIndex out of bounds', () => {
            addBook(makeBook({ id: 'a' }));
            addBook(makeBook({ id: 'b' }));
            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 5);
            expect(listener).not.toHaveBeenCalled();
        });

        it('emits change event for valid reorder', () => {
            addBook(makeBook({ id: 'a' }));
            addBook(makeBook({ id: 'b' }));
            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 1);
            expect(listener).toHaveBeenCalled();
        });

        it('preserves book count after reorder', () => {
            addBook(makeBook());
            addBook(makeBook({ id: 'b' }));
            addBook(makeBook({ id: 'c' }));
            moveBook(1, 0);
            expect(getState().books).toHaveLength(3);
        });

        it('wraps around when moving to end', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));
            moveBook(0, 1);
            expect(getState().books[0].id).toBe('b');
            expect(getState().books[1].id).toBe('a');
        });
    });

    describe('clearBooks', () => {
        it('removes all books', () => {
            addBook(makeBook({ id: 'a' }));
            addBook(makeBook({ id: 'b' }));
            clearBooks();
            expect(getState().books).toEqual([]);
        });

        it('emits change event', () => {
            const listener = vi.fn();
            on('change', listener);
            addBook(makeBook());
            expect(listener).toHaveBeenCalled();
        });

        it('trims whitespace from id and title during addBook', () => {
            addBook(makeBook({ id: '  dup-1  ', title: '  Title 1  ' }));
            addBook(makeBook({ id: 'dup-2', title: 'Title 2' }));
            const books = getState().books;
            expect(books).toHaveLength(2);
            expect(books[0].id).toBe('dup-1');
            expect(books[0].title).toBe('Title 1');
        });

        it('rejects duplicate book by id even with whitespace', () => {
            addBook(makeBook({ id: 'dup' }));
            const result = addBook(makeBook({ id: '  dup  ', title: 'Different Title' }));
            expect(result).toBe(false);
            expect(getState().books).toHaveLength(1);
        });

        it('trims ISBN and optional metadata fields during addBook', () => {
            addBook(makeBook({
                isbn: '  978-0-123456-78-9  ',
                publisher: '  Publisher Co  ',
                publishedDate: '  2024  ',
                description: '  A great book  ',
            }));
            const [book] = getState().books;
            expect(book.isbn).toBe('978-0-123456-78-9');
            expect(book.publisher).toBe('Publisher Co');
            expect(book.publishedDate).toBe('2024');
            expect(book.description).toBe('A great book');
        });

        it('trims author names and drops whitespace-only authors during addBook', () => {
            addBook(makeBook({ authors: ['  Author A  ', '   ', 'Author B'] }));
            const [book] = getState().books;
            expect(book.authors).toEqual(['Author A', 'Author B']);
        });

        it('collapses internal OCR-style whitespace runs in title, authors, description, publisher (addBook)', () => {
            addBook(makeBook({
                id: 'ocr-spaces',
                title: 'John    Smith: A   Book  of  Chapters',
                authors: ['John    Smith'],
                publisher: 'Oxford    University  Press',
                description: 'A  book  about  many  things',
            }));
            const [book] = getState().books;
            expect(book.title).toBe('John Smith: A Book of Chapters');
            expect(book.authors).toEqual(['John Smith']);
            expect(book.publisher).toBe('Oxford University Press');
            expect(book.description).toBe('A book about many things');
        });

        it('collapses internal OCR-style whitespace runs in title, authors (addCandidates)', () => {
            addCandidates([makeBook({
                id: 'ocr-cand',
                title: 'Multiple   Spaces   Here',
                authors: ['Author    One', 'Another   Two'],
            })]);
            const [book] = getState().candidateBooks;
            expect(book.title).toBe('Multiple Spaces Here');
            expect(book.authors).toEqual(['Author One', 'Another Two']);
        });

        it('trims leading and trailing whitespace from title during addBook', () => {
            addBook(makeBook({ id: 'trim-title', title: '   Book Title With Padding  ' }));
            const [book] = getState().books;
            expect(book.title).toBe('Book Title With Padding');
        });

        it('trims leading and trailing whitespace from title during addCandidates', () => {
            addCandidates([makeBook({ id: 'trim-cand-title', title: '   Candidate Title  ' })]);
            const [book] = getState().candidateBooks;
            expect(book.title).toBe('Candidate Title');
        });

        it('converts whitespace-only isbn to null during addBook', () => {
            addBook(makeBook({ isbn: '   ' }));
            const [book] = getState().books;
            expect(book.isbn).toBeNull();
        });

        it('converts empty-string optional fields to null during addBook', () => {
            addBook(makeBook({
                isbn: '',
                publisher: '',
                publishedDate: '',
                description: '',
            }));
            const [book] = getState().books;
            expect(book.isbn).toBeNull();
            expect(book.publisher).toBeNull();
            expect(book.publishedDate).toBeNull();
            expect(book.description).toBeNull();
        });

        it('converts empty-string optional fields to null during addCandidates', () => {
            addCandidates([makeBook({
                id: 'c-empty',
                isbn: '',
                publisher: '',
                publishedDate: '',
                description: '',
            })]);
            const [book] = getState().candidateBooks;
            expect(book.isbn).toBeNull();
            expect(book.publisher).toBeNull();
            expect(book.publishedDate).toBeNull();
            expect(book.description).toBeNull();
        });

        it('normalizes whitespace-only book id to empty string during addBook', () => {
            addBook(makeBook({ id: '   ', title: 'Whitespace Id' }));
            const [book] = getState().books;
            expect(book.id).toBe('');
            expect(book.title).toBe('Whitespace Id');
        });

        it('rejects duplicate when both books have whitespace-only ids', () => {
            addBook(makeBook({ id: '   ', title: 'First' }));
            const result = addBook(makeBook({ id: '  \t  ', title: 'Second' }));
            expect(result).toBe(false);
            expect(getState().books).toHaveLength(1);
        });

        it('does not reset scanCount or lastDetectedText when clearing books', () => {
            addBook(makeBook({ id: 'a' }));
            update({ scanCount: 5, lastDetectedText: 'previous ocr result' });
            clearBooks();
            const s = getState();
            expect(s.books).toEqual([]);
            expect(s.scanCount).toBe(5);
            expect(s.lastDetectedText).toBe('previous ocr result');
        });

        it('does not reset isScanning or autoScan when clearing books', () => {
            addBook(makeBook({ id: 'a' }));
            update({ isScanning: true, autoScan: true });
            clearBooks();
            const s = getState();
            expect(s.isScanning).toBe(true);
            expect(s.autoScan).toBe(true);
        });

        it('does not reset ocrReady or ocrLanguage when clearing books', () => {
            update({ ocrReady: true, ocrLanguage: 'eng' });
            clearBooks();
            const s = getState();
            expect(s.ocrReady).toBe(true);
            expect(s.ocrLanguage).toBe('eng');
        });

        it('detects change when updating a nullable field from non-null to empty string', () => {
            update({ error: 'a problem' }); // no listener yet
            const listener = vi.fn();
            on('change', listener);
            update({ error: '' });
            expect(listener).toHaveBeenCalledTimes(1);
            expect(getState().error).toBe('');
        });

        it('does not detect change when updating a nullable field from null to null', () => {
            const listener = vi.fn();
            on('change', listener);
            update({ error: null } as any);
            expect(listener).not.toHaveBeenCalled();
        });

        it('converts whitespace-only thumbnailUrl to null during addBook', () => {
            addBook(makeBook({ thumbnailUrl: '   ' }));
            const [book] = getState().books;
            expect(book.thumbnailUrl).toBeNull();
        });

        it('deduplicates against existing candidates', () => {
            addCandidates([makeBook({ id: 'c1' })]);
            addCandidates([makeBook({ id: 'c1' }), makeBook({ id: 'c2' })]);
            expect(getState().candidateBooks).toHaveLength(2);
        });

        it('deduplicates against already-added books', () => {
            addBook(makeBook({ id: 'b1' }));
            addCandidates([makeBook({ id: 'b1' })]);
            expect(getState().candidateBooks).toHaveLength(0);
        });

        it('re-adds a book as candidate after clearBooks empties the books list', () => {
            addBook(makeBook({ id: 'b2', title: 'Original Title' }));
            clearBooks();
            expect(getState().books).toEqual([]);
            addCandidates([makeBook({ id: 'b2', title: 'Re-added' })]);
            const [candidate] = getState().candidateBooks;
            expect(candidate.id).toBe('b2');
            expect(candidate.title).toBe('Re-added');
        });

        it('trims metadata fields during addCandidates', () => {
            addCandidates([makeBook({
                id: 'c-trim',
                isbn: '  978-0-123456-78-9  ',
                authors: ['  Author A  ', '   '],
                publisher: '  Pub Co  ',
            })]);
            const [candidate] = getState().candidateBooks;
            expect(candidate.isbn).toBe('978-0-123456-78-9');
            expect(candidate.authors).toEqual(['Author A']);
            expect(candidate.publisher).toBe('Pub Co');
        });

        it('emits change event when candidates added', () => {
            const listener = vi.fn();
            on('change', listener);
            addCandidates([makeBook({ id: 'c1' })]);
            expect(listener).toHaveBeenCalled();
        });

        it('does not emit change when all duplicates', () => {
            addCandidates([makeBook({ id: 'c1' })]);
            const listener = vi.fn();
            on('change', listener);
            addCandidates([makeBook({ id: 'c1' })]);
            expect(listener).not.toHaveBeenCalled();
        });

        it('does nothing when called with empty array', () => {
            const listener = vi.fn();
            on('change', listener);
            addCandidates([]);
            expect(getState().candidateBooks).toHaveLength(0);
            expect(listener).not.toHaveBeenCalled();
        });

        it('handles mixed new and duplicate entries in a single batch (cross-list dedup)', () => {
            addBook(makeBook({ id: 'in-books' }));
            addCandidates([makeBook({ id: 'c-new-1' })]);

            const listener = vi.fn();
            on('change', listener);
            addCandidates([
                makeBook({ id: 'new-a' }),       // new → added
                makeBook({ id: 'in-books' }),    // exists in books → skipped
                makeBook({ id: 'c-new-1' }),     // exists in candidates → skipped
                makeBook({ id: 'new-b' }),       // new → added
            ]);

            expect(getState().candidateBooks).toHaveLength(3);
            const ids = getState().candidateBooks.map((b) => b.id);
            expect(ids).toEqual(['c-new-1', 'new-a', 'new-b']);
            expect(listener).toHaveBeenCalled();
        });

        it('does not re-add a candidate already present in candidateBooks from prior call', () => {
            addCandidates([makeBook({ id: 'persisted' })]);
            const listener = vi.fn();
            on('change', listener);
            addCandidates([makeBook({ id: 'persisted' }), makeBook({ id: 'fresh' })]);

            expect(getState().candidateBooks).toHaveLength(2);
            expect(listener).toHaveBeenCalledTimes(1); // only one emit for fresh addition
        });
    });

    describe('removeCandidateById', () => {
        it('removes candidate by id', () => {
            addCandidates([makeBook({ id: 'c1' }), makeBook({ id: 'c2' })]);
            removeCandidateById('c1');
            expect(getState().candidateBooks).toHaveLength(1);
            expect(getState().candidateBooks[0].id).toBe('c2');
        });

        it('trims whitespace from bookId before matching', () => {
            addCandidates([makeBook({ id: '  trimmed-id  ' })]);
            removeCandidateById('trimmed-id');
            expect(getState().candidateBooks).toHaveLength(0);
        });

        it('emits change event', () => {
            addCandidates([makeBook({ id: 'c1' })]);
            const listener = vi.fn();
            on('change', listener);
            removeCandidateById('c1');
            expect(listener).toHaveBeenCalled();
        });

        it('does nothing when bookId does not match any candidate', () => {
            addCandidates([makeBook({ id: 'c1' })]);
            const listener = vi.fn();
            on('change', listener);
            removeCandidateById('nonexistent-id');
            expect(getState().candidateBooks).toHaveLength(1);
            expect(getState().candidateBooks[0].id).toBe('c1');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('clearCandidates', () => {
        it('removes all candidates', () => {
            addCandidates([makeBook({ id: 'c1' }), makeBook({ id: 'c2' })]);
            clearCandidates();
            expect(getState().candidateBooks).toEqual([]);
        });

        it('resets candidateFilter', () => {
            update({ candidateFilter: 'some filter' });
            clearCandidates();
            expect(getState().candidateFilter).toBe('');
        });

        it('emits change event', () => {
            const listener = vi.fn();
            on('change', listener);
            clearCandidates();
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('clearAll', () => {
        it('removes all books, candidates, and resets filter in one call', () => {
            addBook(makeBook({ id: 'a' }));
            addCandidates([makeBook({ id: 'c1' })]);
            update({ candidateFilter: 'search term' });

            clearAll();

            const s = getState();
            expect(s.books).toEqual([]);
            expect(s.candidateBooks).toEqual([]);
            expect(s.candidateFilter).toBe('');
        });

        it('emits change event exactly once', () => {
            addBook(makeBook({ id: 'a' }));
            addCandidates([makeBook({ id: 'c1' })]);
            const listener = vi.fn();
            on('change', listener);

            clearAll();

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('does not reset isScanning or autoScan (preserves scanning state)', () => {
            addBook(makeBook({ id: 'a' }));
            update({ isScanning: true, autoScan: true });

            clearAll();

            const s = getState();
            expect(s.isScanning).toBe(true);
            expect(s.autoScan).toBe(true);
        });

        it('does not reset scanCount or lastDetectedText', () => {
            addBook(makeBook({ id: 'a' }));
            update({ scanCount: 5, lastDetectedText: 'previous ocr result' });

            clearAll();

            const s = getState();
            expect(s.scanCount).toBe(5);
            expect(s.lastDetectedText).toBe('previous ocr result');
        });

        it('does not reset ocrReady or ocrLanguage', () => {
            update({ ocrReady: true, ocrLanguage: 'eng' });

            clearAll();

            const s = getState();
            expect(s.ocrReady).toBe(true);
            expect(s.ocrLanguage).toBe('eng');
        });

        it('does not reset view mode', () => {
            setView('scan');

            clearAll();

            const s = getState();
            expect(s.view).toBe('scan');
        });

        it('is idempotent — safe to call when already empty', () => {
            const listener = vi.fn();
            on('change', listener);

            clearAll();

            // Should still emit even though nothing changed (consistent with clearBooks/clearCandidates)
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('event system', () => {
        it('on() returns unsubscribe function', () => {
            const listener = vi.fn();
            const unsub = on('change', listener);
            update({ scanCount: 1 });
            expect(listener).toHaveBeenCalledTimes(1);

            unsub();
            update({ scanCount: 2 });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('toast emits toast event with message', () => {
            const listener = vi.fn();
            on('toast', listener);
            toast('Hello!');
            expect(listener).toHaveBeenCalledWith('Hello!');
        });

        it('emit sends data to listeners', () => {
            const listener = vi.fn();
            on('toast', listener);
            emit('toast', 'test data');
            expect(listener).toHaveBeenCalledWith('test data');
        });

        it('multiple listeners receive events', () => {
            const a = vi.fn();
            const b = vi.fn();
            on('change', a);
            on('change', b);
            update({ scanCount: 1 });
            expect(a).toHaveBeenCalled();
            expect(b).toHaveBeenCalled();
        });

        it('listeners for one event type are not called when another type is emitted', () => {
            const changeListener = vi.fn();
            const toastListener = vi.fn();
            on('change', changeListener);
            on('toast', toastListener);
            emit('toast', 'hello');
            expect(changeListener).not.toHaveBeenCalled();
            expect(toastListener).toHaveBeenCalledWith('hello');
        });

        it('emit with void event does not pass arguments to listeners', () => {
            const listener = vi.fn();
            on('change', listener);
            emit('change');
            // Listener receives no arguments (void type)
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0]).toHaveLength(0);
        });

        it('unsubscribe only removes the specific listener, not others for same event', () => {
            const listenerA = vi.fn();
            const listenerB = vi.fn();
            const unsubA = on('toast', listenerA);
            on('toast', listenerB);

            emit('toast', 'hello');
            expect(listenerA).toHaveBeenCalledTimes(1);
            expect(listenerB).toHaveBeenCalledTimes(1);

            // Reset mocks to verify clean state
            listenerA.mockClear();
            listenerB.mockClear();

            unsubA();

            // After unsubscribe, only B should receive further events
            emit('toast', 'world');
            expect(listenerA).not.toHaveBeenCalled();
            expect(listenerB).toHaveBeenCalledWith('world');
        });
    });

    describe('moveBook', () => {
        it('moves a book from one position to another', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));
            addBook(makeBook({ id: 'c', title: 'C' }));

            moveBook(0, 2);
            const titles = getState().books.map((b) => b.title);
            expect(titles).toEqual(['B', 'C', 'A']);
        });

        it('does nothing when from equals to', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));

            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 0);
            expect(listener).not.toHaveBeenCalled();
        });

        it('preserves list order when from equals to (no-op invariant)', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));
            addBook(makeBook({ id: 'c', title: 'C' }));

            moveBook(1, 1);
            const titles = getState().books.map((b) => b.title);
            expect(titles).toEqual(['A', 'B', 'C']);
        });

        it('does nothing for out-of-bounds indices', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));

            moveBook(-1, 0);
            moveBook(0, 5);
            expect(getState().books).toHaveLength(1);
        });

        it('emits change event', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));

            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 1);
            expect(listener).toHaveBeenCalled();
        });

        it('moves an item past another (index shift during splice)', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));
            addBook(makeBook({ id: 'c', title: 'C' }));

            // move A (index 0) to index 2: splice(0,1)->[B,C], then splice(2,0,A)->[B,C,A]
            moveBook(0, 2);
            const titles = getState().books.map((b) => b.title);
            expect(titles).toEqual(['B', 'C', 'A']);
        });

        it('removes a book from the middle of the list by moving to end then removing last', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));
            addBook(makeBook({ id: 'c', title: 'C' }));

            // Move B (index 1) to end (last index = books.length - 1 = 2)
            moveBook(1, 2);
            const titles = getState().books.map((b) => b.title);
            expect(titles).toEqual(['A', 'C', 'B']);

            // Remove B from last position — leaves [A, C]
            const removed = removeBook(2);
            expect(removed!.title).toBe('B');
            expect(getState().books).toHaveLength(2);
        });

        it('does nothing when toIndex is out of bounds', () => {
            addBook(makeBook({ id: 'a', title: 'A' }));
            addBook(makeBook({ id: 'b', title: 'B' }));

            const listener = vi.fn();
            on('change', listener);
            moveBook(0, 5);
            expect(getState().books).toHaveLength(2);
            expect(listener).not.toHaveBeenCalled();
        });

        it('does nothing when fromIndex is negative', () => {
            addBook(makeBook({ id: 'a' }));
            const listener = vi.fn();
            on('change', listener);
            moveBook(-1, 0);
            expect(getState().books).toHaveLength(1);
            expect(listener).not.toHaveBeenCalled();
        });

        it('does nothing when toIndex is negative', () => {
            addBook(makeBook({ id: 'a' }));
            const listener = vi.fn();
            on('change', listener);
            moveBook(0, -1);
            expect(getState().books).toHaveLength(1);
            expect(listener).not.toHaveBeenCalled();
        });

        it('preserves list when moving a single book to itself', () => {
            addBook(makeBook({ id: 'solo' }));
            moveBook(0, 0);
            expect(getState().books).toHaveLength(1);
            expect(getState().books[0].id).toBe('solo');
        });
    });

    describe('clearBooks interaction with candidates', () => {
        it('does not affect candidateBooks when clearing books', () => {
            addBook(makeBook({ id: 'a' }));
            addCandidates([makeBook({ id: 'c1' })]);
            clearBooks();
            expect(getState().books).toHaveLength(0);
            expect(getState().candidateBooks).toHaveLength(1);
        });

        it('does not reset scanCount after adding candidates and clearing', () => {
            addCandidates([makeBook({ id: 'c1' })]);
            update({ scanCount: 7, lastDetectedText: 'ocr text' });
            clearBooks();
            const s = getState();
            expect(s.scanCount).toBe(7);
            expect(s.lastDetectedText).toBe('ocr text');
        });
    });

    describe('moveBook preserves order edge cases', () => {
        it('moves last item to first position (wrap-around)', () => {
            addBook(makeBook({ id: 'a' }));
            addBook(makeBook({ id: 'b' }));
            addBook(makeBook({ id: 'c' }));

            moveBook(2, 0);
            const ids = getState().books.map((b) => b.id);
            expect(ids).toEqual(['c', 'a', 'b']);
        });

        it('moves first item to last position', () => {
            addBook(makeBook({ id: 'x' }));
            addBook(makeBook({ id: 'y' }));
            addBook(makeBook({ id: 'z' }));

            moveBook(0, 2);
            const ids = getState().books.map((b) => b.id);
            expect(ids).toEqual(['y', 'z', 'x']);
        });
    });
});
