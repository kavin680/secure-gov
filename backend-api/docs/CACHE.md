# Cache Guide

## Overview

The cache system supports both **Redis** and **in-memory** caching with a toggle switch.

## Configuration

```env
REDIS_ENABLED=true        # Enable Redis (false = in-memory)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=300             # Default TTL in seconds
REDIS_KEY_PREFIX=enterprise:
```

## Usage in Services

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MyService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async getCachedData(key: string) {
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const data = await this.fetchData();
    await this.cache.set(key, data, 600); // TTL in seconds
    return data;
  }

  async invalidateCache(key: string) {
    await this.cache.del(key);
  }
}
```

## Cache Strategies

- **Cache-aside**: Check cache first, fetch from DB on miss
- **Write-through**: Update cache when writing to DB
- **TTL-based**: Automatic expiration

## Key Naming Convention

```
{prefix}:{resource}:{id}
enterprise:user:uuid-123
enterprise:users:list:page-1
```
