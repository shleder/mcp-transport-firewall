

export interface L2CacheOptions {
  dir: string;
  filename?: string;
}

export interface L1CacheOptions {
  l1MaxItems: number;
  l1MaxSizeBytes: number;
}

export interface CacheEntryMeta {
  key: string;
  method: string;
  paramsHash: string;
  expiresAt: number;
}
