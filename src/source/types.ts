/**
 * 数据源接口定义
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §5
 */

export interface FetchResult<T> {
  body: T;
  revision: string;
  cached: boolean;
  fetchedAt: number;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  baseUrl: string;
  kind: '5etools' | '5etools-cn' | 'homebrew' | 'legacy';
  enabled: boolean;
  mirrorUrls?: string[];
  timeoutMs?: number;
  maxRetries?: number;
}

export interface RuleSource {
  id: string;
  name: string;
  kind: '5etools' | '5etools-cn' | 'homebrew' | 'legacy';
  fetchJson<T>(path: string, options?: { signal?: AbortSignal; refresh?: boolean }): Promise<FetchResult<T>>;
}
