import { PrismaClient, Role, PolicyType, PolicyAction } from '@prisma/client';
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

  // ─── Create Demo Policies for Acme ─────────────────────────────────────────

  await prisma.policy.deleteMany({ where: { tenantId: tenantAcme.id } });

  const keywordPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantAcme.id,
      name: 'Block Sensitive Keywords',
      description:
        'Blocks prompts containing sensitive keywords like passwords, SSN, credit card numbers',
      type: PolicyType.KEYWORD_BLOCK,
      action: PolicyAction.DENY,
      priority: 100,
      rules: {
        keywords: [
          'password',
          'ssn',
          'social security',
          'credit card number',
          'secret key',
          'api key',
        ],
        caseSensitive: false,
      },
      createdBy: acmeAdmin.id,
    },
  });
  console.log(`Policy created: ${keywordPolicy.name} (Acme Corp)`);

  const modelPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantAcme.id,
      name: 'Restrict AI Models',
      description: 'Only allow approved AI models for this tenant',
      type: PolicyType.MODEL_RESTRICT,
      action: PolicyAction.DENY,
      priority: 90,
      rules: {
        allowedModels: ['gpt-4o-mini', 'gpt-4o'],
      },
      createdBy: acmeAdmin.id,
    },
  });
  console.log(`Policy created: ${modelPolicy.name} (Acme Corp)`);

  const topicPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantAcme.id,
      name: 'Block Harmful Topics',
      description: 'Blocks prompts related to harmful or unethical topics',
      type: PolicyType.TOPIC_RESTRICT,
      action: PolicyAction.DENY,
      priority: 80,
      rules: {
        blockedTopics: ['hack', 'exploit', 'malware', 'ransomware', 'phishing'],
        caseSensitive: false,
      },
      createdBy: acmeAdmin.id,
    },
  });
  console.log(`Policy created: ${topicPolicy.name} (Acme Corp)`);

  const sensitiveDataPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantAcme.id,
      name: 'Detect Sensitive Data Patterns',
      description:
        'Flags prompts containing patterns matching SSN, email, or phone numbers',
      type: PolicyType.SENSITIVE_DATA,
      action: PolicyAction.FLAG,
      priority: 70,
      rules: {
        patterns: [
          '\\b\\d{3}-\\d{2}-\\d{4}\\b',
          '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
          '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b',
        ],
      },
      createdBy: acmeAdmin.id,
    },
  });
  console.log(`Policy created: ${sensitiveDataPolicy.name} (Acme Corp)`);

  // ─── Create Demo Policies for GlobeTech ────────────────────────────────────

  await prisma.policy.deleteMany({ where: { tenantId: tenantGlobetech.id } });

  const gtKeywordPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantGlobetech.id,
      name: 'Block Confidential Keywords',
      description: 'Blocks prompts containing confidential business terms',
      type: PolicyType.KEYWORD_BLOCK,
      action: PolicyAction.DENY,
      priority: 100,
      rules: {
        keywords: [
          'confidential',
          'trade secret',
          'proprietary',
          'internal only',
        ],
        caseSensitive: false,
      },
      createdBy: globetechAdmin.id,
    },
  });
  console.log(`Policy created: ${gtKeywordPolicy.name} (GlobeTech)`);

  const gtModelPolicy = await prisma.policy.create({
    data: {
      tenantId: tenantGlobetech.id,
      name: 'GlobeTech Model Restrictions',
      description: 'GlobeTech only allows gpt-4o-mini',
      type: PolicyType.MODEL_RESTRICT,
      action: PolicyAction.DENY,
      priority: 90,
      rules: {
        allowedModels: ['gpt-4o-mini'],
      },
      createdBy: globetechAdmin.id,
    },
  });
  console.log(`Policy created: ${gtModelPolicy.name} (GlobeTech)`);

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
