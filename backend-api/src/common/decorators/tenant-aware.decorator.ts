import { SetMetadata } from '@nestjs/common';
import { TENANT_AWARE_KEY } from '../guards/tenant.guard';

export const TenantAware = () => SetMetadata(TENANT_AWARE_KEY, true);
