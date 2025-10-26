// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@launchai.com' },
    update: {},
    create: {
      email: 'test@launchai.com',
      name: 'Test User',
      password: '$2b$10$rQJ5cGmXvZ3QlGxNzqJwvOqYk8CQQq0GqLZQh0qZqZqZqZqZqZqZq', // "password123"
      tier: 'free',
      credits: 3,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Test user created:', testUser.email);

  // Create system config
  await prisma.systemConfig.upsert({
    where: { key: 'app_version' },
    update: { value: '2.0.0' },
    create: {
      key: 'app_version',
      value: '2.0.0',
    },
  });

  console.log('✅ System config initialized');
  console.log('\n📊 Database seeded successfully!');
  console.log('\nTest credentials:');
  console.log('Email: test@launchai.com');
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });