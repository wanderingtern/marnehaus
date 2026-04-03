import { PrismaClient, UnitStatus, LeaseStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'demo@marnehaus.com' },
    update: {},
    create: {
      clerkId: 'user_demo_seed',
      email: 'demo@marnehaus.com',
      name: 'Demo Landlord',
    },
  });

  const property = await prisma.property.upsert({
    where: { id: 'seed-property-1' },
    update: {},
    create: {
      id: 'seed-property-1',
      userId: user.id,
      name: '123 Main Apartments',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
  });

  const unit = await prisma.unit.upsert({
    where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: '1A' } },
    update: {},
    create: {
      propertyId: property.id,
      unitNumber: '1A',
      type: '1BR',
      monthlyRent: 1500,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 750,
      status: UnitStatus.OCCUPIED,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'tenant@example.com',
      phone: '512-555-0100',
      unitId: unit.id,
    },
  });

  await prisma.lease.create({
    data: {
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: 1500,
      status: LeaseStatus.ACTIVE,
    },
  }).catch(() => { /* skip if already exists */ });

  console.log('Seed complete:', { user: user.email, property: property.name, unit: unit.unitNumber, tenant: `${tenant.firstName} ${tenant.lastName}` });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
