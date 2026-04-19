import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_USERS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@al-mizan.dz',
    plainPassword: 'Admin@123',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'operateur@al-mizan.dz',
    plainPassword: 'Operateur@123',
  },
];

async function main() {
  console.log('Seeding auth-service database...');

  for (const entry of SEED_USERS) {
    const hashedPassword = await bcrypt.hash(entry.plainPassword, 10);

    await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        password: hashedPassword,
      },
      create: {
        id: entry.id,
        email: entry.email,
        password: hashedPassword,
      },
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.upsert({
    where: { token: 'seed-auth-session-token-0001' },
    update: {
      expiresAt,
    },
    create: {
      token: 'seed-auth-session-token-0001',
      userId: SEED_USERS[0].id,
      deviceInfo: 'Seed Script Device',
      ipAddress: '127.0.0.1',
      expiresAt,
    },
  });

  console.log(`Seed complete: ${SEED_USERS.length} users and 1 session upserted.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
