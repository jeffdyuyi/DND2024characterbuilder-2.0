import type { FiveEToolsCnSource } from './client';
import { inferEditionFromSource } from '@/catalog/identity';
import type { Edition } from '@/catalog/types';

type Publication = { source?: string; id?: string; published?: string };

/** 对齐上游 SourceUtil.isClassicSource：以新版玩家手册出版日期作为界限。 */
export function parsePublicationEditions(books: Publication[], adventures: Publication[] = []) {
  const editions = new Map<string, '2014' | '2024'>();
  const boundary = books.find((book) => book.source === 'XPHB')?.published;
  const validDate = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value));
  if (!validDate(boundary)) return editions;
  for (const publication of [...books, ...adventures]) {
    const source = publication.source || publication.id;
    if (source && validDate(publication.published)) {
      editions.set(source.trim().toUpperCase(), publication.published < boundary ? '2014' : '2024');
    }
  }
  return editions;
}

export class PublicationEditionIndex {
  private editions = new Map<string, '2014' | '2024'>();
  private loading?: Promise<void>;
  private lastOptions?: { signal?: AbortSignal; refresh?: boolean };

  async load(client: FiveEToolsCnSource, options?: { signal?: AbortSignal; refresh?: boolean }) {
    // 第三方来源不能借用官方同名缩写的出版日期。
    if (client.kind === 'homebrew') return;
    if (!this.loading || (options?.refresh && options !== this.lastOptions)) {
      this.lastOptions = options;
      this.loading = (async () => {
        const results = await Promise.allSettled([
          client.fetchJson<{ book?: Publication[] }>('data/books.json', options),
          client.fetchJson<{ adventure?: Publication[] }>('data/adventures.json', options),
        ]);
        const books = results[0].status === 'fulfilled' ? results[0].value?.body?.book : [];
        const adventures =
          results[1].status === 'fulfilled' ? results[1].value?.body?.adventure : [];
        this.editions = parsePublicationEditions(
          Array.isArray(books) ? books : [],
          Array.isArray(adventures) ? adventures : [],
        );
      })();
    }
    await this.loading;
  }

  resolve(source: string, raw: Record<string, unknown> = {}): Edition {
    return inferEditionFromSource(source, raw, this.editions.get(source.trim().toUpperCase()));
  }
}
