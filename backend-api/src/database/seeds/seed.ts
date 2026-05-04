import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('Admin@123456', 12);

  // ─── Create Tenants ────────────────────────────────────────────────────────

  const tenantAcme = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'A demo technology company',
      maxUsers: 50,
      settings: {
        allowedModels: ['gpt-4o-mini', 'gpt-4o'],
        maxTokensPerRequest: 4096,
      },
    },
  });
  console.log(`Tenant created: ${tenantAcme.name} (${tenantAcme.slug})`);

  const tenantGlobetech = await prisma.tenant.upsert({
    where: { slug: 'globetech' },
    update: {},
    create: {
      name: 'GlobeTech Solutions',
      slug: 'globetech',
      description: 'A demo consulting firm',
      maxUsers: 25,
      settings: {
        allowedModels: ['gpt-4o-mini'],
        maxTokensPerRequest: 2048,
      },
    },
  });
  console.log(
    `Tenant created: ${tenantGlobetech.name} (${tenantGlobetech.slug})`,
  );

  // ─── Create Super Admin (no tenant) ────────────────────────────────────────

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@enterprise.com' },
    update: {},
    create: {
      email: 'admin@enterprise.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Super Admin created: ${superAdmin.email}`);

  // ─── Create Tenant Admin for Acme ──────────────────────────────────────────

  const acmeAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      password: hashedPassword,
      firstName: 'Acme',
      lastName: 'Admin',
      role: Role.TENANT_ADMIN,
      tenantId: tenantAcme.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Tenant Admin created: ${acmeAdmin.email} (Acme Corp)`);

  // ─── Create Regular User for Acme ─────────────────────────────────────────

  const acmeUser = await prisma.user.upsert({
    where: { email: 'user@acme.com' },
    update: {},
    create: {
      email: 'user@acme.com',
      password: hashedPassword,
      firstName: 'Acme',
      lastName: 'User',
      role: Role.USER,
      tenantId: tenantAcme.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`User created: ${acmeUser.email} (Acme Corp)`);

  // ─── Create Developer for Acme ────────────────────────────────────────────

  const acmeDev = await prisma.user.upsert({
    where: { email: 'dev@acme.com' },
    update: {},
    create: {
      email: 'dev@acme.com',
      password: hashedPassword,
      firstName: 'Acme',
      lastName: 'Developer',
      role: Role.DEVELOPER,
      tenantId: tenantAcme.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Developer created: ${acmeDev.email} (Acme Corp)`);

  // ─── Create Tenant Admin for GlobeTech ─────────────────────────────────────

  const globetechAdmin = await prisma.user.upsert({
    where: { email: 'admin@globetech.com' },
    update: {},
    create: {
      email: 'admin@globetech.com',
      password: hashedPassword,
      firstName: 'GlobeTech',
      lastName: 'Admin',
      role: Role.TENANT_ADMIN,
      tenantId: tenantGlobetech.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(
    `Tenant Admin created: ${globetechAdmin.email} (GlobeTech Solutions)`,
  );

  // ─── Create Regular User for GlobeTech ─────────────────────────────────────

  const globetechUser = await prisma.user.upsert({
    where: { email: 'user@globetech.com' },
    update: {},
    create: {
      email: 'user@globetech.com',
      password: hashedPassword,
      firstName: 'GlobeTech',
      lastName: 'User',
      role: Role.USER,
      tenantId: tenantGlobetech.id,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`User created: ${globetechUser.email} (GlobeTech Solutions)`);

  // ─── Keep legacy test user ─────────────────────────────────────────────────

  const testUser = await prisma.user.upsert({
    where: { email: 'user@enterprise.com' },
    update: {},
    create: {
      email: 'user@enterprise.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: Role.USER,
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`Test User created: ${testUser.email}`);

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
