import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create super admin
  const hashedPassword = await bcrypt.hash('Admin@123456', 12);

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

  // Create test user
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
