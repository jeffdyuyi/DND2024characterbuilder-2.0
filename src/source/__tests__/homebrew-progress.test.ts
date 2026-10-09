import { describe, expect, it } from 'vitest';
import { FiveEToolsCnLoader } from '../fiveetools-cn/loader';
import { InMemoryCatalogService } from '@/catalog/catalog';

it('第三方文件未全部完成时已上报进度，最后才进入跨文件解析', async () => {
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const events: Array<{ loadedFiles: number; failedFiles: number; phase: string }> = [];
  let firstProgress!: () => void;
  const progressReceived = new Promise<void>((resolve) => {
    firstProgress = resolve;
  });
  const source: any = {
    id: 'homebrew',
    kind: 'homebrew',
    fetchJson: async (path: string) => {
      if (path === 'pending') return pending;
      if (path === 'bad') throw new Error('offline');
      return { body: {}, revision: 'r' };
    },
  };
  const loader = new FiveEToolsCnLoader(source, new InMemoryCatalogService());
  const task = loader.loadClassFiles(['ok', 'bad', 'pending'], {
    onProgress: (event) => {
      events.push(event);
      firstProgress();
    },
  });
  await progressReceived;
  expect(events.some((event) => event.phase === 'download')).toBe(true);
  expect(events.some((event) => event.phase === 'parse')).toBe(false);
  finish({ body: {}, revision: 'r' });
  const summary = await task;
  expect(events.at(-1)).toEqual({ phase: 'parse', loadedFiles: 2, failedFiles: 1 });
  expect(summary).toMatchObject({ loadedFiles: 2, failedFiles: 1 });
});
