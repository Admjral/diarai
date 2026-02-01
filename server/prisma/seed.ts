import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начало заполнения базы данных...');

  // Создаем тестового пользователя
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Тестовый Пользователь',
      plan: 'Pro',
    },
  });

  console.log('✅ Пользователь создан:', user.email);

  // Создаем тестовые лиды
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: 'Анна Иванова',
        phone: '+7 777 123 4567',
        email: 'anna@example.com',
        status: 'Активный',
        stage: 'Переговоры',
        userId: user.id,
        avatar: 'А',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Дмитрий Петров',
        phone: '+7 777 234 5678',
        email: 'dmitry@example.com',
        status: 'Новый',
        stage: 'Первый контакт',
        userId: user.id,
        avatar: 'Д',
      },
    }),
  ]);

  console.log('✅ Лиды созданы:', leads.length);

  // Создаем тестовые сделки
  const deals = await Promise.all([
    prisma.deal.create({
      data: {
        title: 'Сделка с Анной',
        amount: 500000,
        currency: 'KZT',
        stage: 'Переговоры',
        probability: 70,
        userId: user.id,
        leadId: leads[0].id,
      },
    }),
    prisma.deal.create({
      data: {
        title: 'Сделка с Дмитрием',
        amount: 300000,
        currency: 'KZT',
        stage: 'Предложение',
        probability: 50,
        userId: user.id,
        leadId: leads[1].id,
      },
    }),
  ]);

  console.log('✅ Сделки созданы:', deals.length);

  // Создаем тестовые задачи
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Позвонить Анне',
        description: 'Обсудить детали сделки',
        status: 'Новая',
        priority: 'Высокий',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Завтра
        userId: user.id,
        leadId: leads[0].id,
      },
    }),
    prisma.task.create({
      data: {
        title: 'Отправить предложение Дмитрию',
        description: 'Подготовить коммерческое предложение',
        status: 'В работе',
        priority: 'Средний',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Послезавтра
        userId: user.id,
        leadId: leads[1].id,
      },
    }),
  ]);

  console.log('✅ Задачи созданы:', tasks.length);

  console.log('🎉 База данных успешно заполнена!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



