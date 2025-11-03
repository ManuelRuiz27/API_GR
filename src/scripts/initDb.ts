import dotenv from 'dotenv';
import prisma from '../prisma';

dotenv.config();

const layouts = [
  {
    name: 'Landing Page',
    data: {
      sections: [
        { type: 'hero', title: 'Welcome to Layouts', cta: 'Get Started' },
        { type: 'features', items: ['Drag & Drop', 'Responsive', 'Customizable'] },
        { type: 'footer', text: '© 2024 Layouts Inc.' },
      ],
    },
  },
  {
    name: 'Dashboard',
    data: {
      widgets: [
        { type: 'chart', variant: 'line', title: 'Weekly Views' },
        { type: 'table', title: 'Recent Signups' },
        { type: 'stat', label: 'Conversion Rate', value: '4.7%' },
      ],
    },
  },
];

async function seedLayouts() {
  for (const layout of layouts) {
    const existing = await prisma.layout.findFirst({
      where: { name: layout.name },
    });

    if (existing) {
      console.log(`Layout "${layout.name}" already exists (id: ${existing.id})`);
      continue;
    }

    const created = await prisma.layout.create({
      data: layout,
    });
    console.log(`Created layout "${created.name}" (id: ${created.id})`);
  }
}

async function main() {
  try {
    await seedLayouts();
  } catch (error) {
    console.error('Failed to initialize database', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
