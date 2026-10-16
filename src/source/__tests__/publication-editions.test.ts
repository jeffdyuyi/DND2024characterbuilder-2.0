import { describe, expect, it, vi } from 'vitest';
import {
  PublicationEditionIndex,
  parsePublicationEditions,
} from '../fiveetools-cn/publicationEditions';
import { FiveEToolsCnLoader } from '../fiveetools-cn/loader';
import type { FiveEToolsCnSource } from '../fiveetools-cn/client';
import { InMemoryCatalogService } from '@/catalog/catalog';

// 日期取自 5etools-cn/cn2.0/data/books.json；仅保存用于判定边界的元数据。
const books = [
  { source: 'PHB', published: '2014-08-19' },
  { source: 'XGE', published: '2017-11-21' },
  { source: 'XPHB', published: '2024-09-17' },
];

describe('publication edition attribution', () => {
  it('uses upstream publication dates rather than source prefixes or names', () => {
    const editions = parsePublicationEditions(books, [
      { source: 'NEW-BOOK', published: '2025-01-01' },
      { source: 'X-OLD-BOOK', published: '2023-01-01' },
      { source: 'UNDATED' },
    ]);
    expect(editions.get('XGE')).toBe('2014');
    expect(editions.get('XPHB')).toBe('2024');
    expect(editions.get('NEW-BOOK')).toBe('2024');
    expect(editions.get('X-OLD-BOOK')).toBe('2014');
    expect(editions.has('UNDATED')).toBe(false);
    expect(parsePublicationEditions(books.filter((book) => book.source !== 'XPHB')).size).toBe(0);
  });

  it('shares concurrent loads, respects native edition and isolates homebrew sources', async () => {
    const fetchJson = vi.fn(async (path: string) => ({
      body: path.endsWith('books.json') ? { book: books } : { adventure: [] },
    }));
    const client = { kind: '5etools-cn', fetchJson } as unknown as FiveEToolsCnSource;
    const index = new PublicationEditionIndex();
    const options = { refresh: true };
    await Promise.all([index.load(client, options), index.load(client, options)]);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(index.resolve('xge')).toBe('2014');
    expect(index.resolve('XPHB', { edition: 'classic' })).toBe('2014');
    expect(index.resolve('PHB', { edition: 'one' })).toBe('2024');
    expect(index.resolve('UNKNOWN2024')).toBe('both');
    const homebrew = new PublicationEditionIndex();
    await homebrew.load({ ...client, kind: 'homebrew' } as FiveEToolsCnSource);
    expect(homebrew.resolve('XGE')).toBe('both');
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('applies metadata before catalog registration without altering raw text or IDs', async () => {
    const raw = { name: 'Test', source: 'XGE', entries: ['original text'] };
    const fetchJson = vi.fn(async (path: string) => ({
      body:
        path === 'data/books.json'
          ? { book: books }
          : path === 'data/adventures.json'
            ? { adventure: [] }
            : { feat: [raw] },
    }));
    const catalog = new InMemoryCatalogService();
    const loader = new FiveEToolsCnLoader(
      { id: '5etools-cn', kind: '5etools-cn', fetchJson } as unknown as FiveEToolsCnSource,
      catalog,
    );
    await loader.loadFeats();
    const entry = catalog.list('feat')[0];
    expect(entry.edition).toBe('2014');
    expect(entry.id).toBe('5etools-cn:feat:xge:test');
    expect(entry.raw.entries).toEqual(raw.entries);
    expect(catalog.list('feat', { edition: '2024' })).toHaveLength(0);
  });

  it('keeps entries available if metadata is unavailable, without guessing their edition', async () => {
    const index = new PublicationEditionIndex();
    await index.load({
      kind: '5etools-cn',
      fetchJson: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as FiveEToolsCnSource);
    expect(index.resolve('XGE')).toBe('both');
    expect(index.resolve('XPHB', { edition: 'one' })).toBe('2024');
  });
});
