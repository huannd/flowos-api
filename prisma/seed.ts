import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 FlowOS — Seeding database...\n');

  // ═══════════════════════════════════
  // 1. CATEGORIES
  // ═══════════════════════════════════
  console.log('📂 Seeding categories...');
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'social-media' },
      update: {},
      create: {
        name: 'Social Media',
        slug: 'social-media',
        icon: '📱',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'marketing' },
      update: {},
      create: {
        name: 'Marketing',
        slug: 'marketing',
        icon: '📣',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'e-commerce' },
      update: {},
      create: {
        name: 'E-Commerce',
        slug: 'e-commerce',
        icon: '🛒',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'ai-tools' },
      update: {},
      create: {
        name: 'AI Tools',
        slug: 'ai-tools',
        icon: '🤖',
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'productivity' },
      update: {},
      create: {
        name: 'Productivity',
        slug: 'productivity',
        icon: '⚡',
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'notifications' },
      update: {},
      create: {
        name: 'Notifications',
        slug: 'notifications',
        icon: '🔔',
        sortOrder: 6,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'data-processing' },
      update: {},
      create: {
        name: 'Data Processing',
        slug: 'data-processing',
        icon: '📊',
        sortOrder: 7,
      },
    }),
  ]);
  console.log(`   ✅ ${categories.length} categories ready\n`);

  // ═══════════════════════════════════
  // 2. SAMPLE TEMPLATES
  // ═══════════════════════════════════
  console.log('📋 Seeding templates...');

  const socialCategory = categories[0];
  const marketingCategory = categories[1];
  const aiCategory = categories[3];
  const notifCategory = categories[5];
  const dataCategory = categories[6];

  const templates = await Promise.all([
    // Template 1: Telegram Channel Auto-Post
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-telegram-autopost' },
      update: {},
      create: {
        name: 'Telegram Channel Auto-Post',
        description: 'Tự động đăng bài viết lên kênh Telegram của bạn',
        longDescription: 'Gửi tin nhắn văn bản, hình ảnh hoặc nội dung HTML lên kênh Telegram. Hỗ trợ Markdown và HTML format. Yêu cầu Bot Token và Channel ID.',
        icon: '✈️',
        categoryId: socialCategory.id,
        n8nWorkflowId: 'tpl-telegram-autopost',
        webhookPath: 'flowos/telegram-autopost',
        tags: ['telegram', 'social', 'auto-post'],
        inputSchema: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              title: 'Nội dung tin nhắn',
              description: 'Nội dung bài viết (hỗ trợ Markdown)',
              'x-ui': { widget: 'textarea', rows: 5, placeholder: 'Nhập nội dung bài viết...' },
            },
            imageUrl: {
              type: 'string',
              title: 'URL hình ảnh',
              description: 'Link hình ảnh kèm theo (tùy chọn)',
              'x-ui': { widget: 'text', placeholder: 'https://example.com/image.jpg' },
            },
            parseMode: {
              type: 'string',
              title: 'Định dạng',
              enum: ['Markdown', 'HTML', 'MarkdownV2'],
              default: 'Markdown',
              'x-ui': { widget: 'select' },
            },
            scheduleDelay: {
              type: 'number',
              title: 'Độ trễ (phút)',
              description: 'Gửi sau bao nhiêu phút (0 = gửi ngay)',
              default: 0,
              'x-ui': { widget: 'number', min: 0, max: 1440 },
            },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'number' },
            chatId: { type: 'string' },
            sentAt: { type: 'string' },
          },
        },
        averageRunTime: 3000,
        sortOrder: 1,
      },
    }),

    // Template 2: AI Content Generator
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-ai-content-gen' },
      update: {},
      create: {
        name: 'AI Content Generator',
        description: 'Tạo nội dung marketing bằng AI (GPT-4)',
        longDescription: 'Sử dụng GPT-4 để tạo nội dung marketing chuyên nghiệp. Hỗ trợ nhiều tone và format: bài blog, caption mạng xã hội, email marketing, mô tả sản phẩm.',
        icon: '🤖',
        categoryId: aiCategory.id,
        n8nWorkflowId: 'tpl-ai-content-gen',
        webhookPath: 'flowos/ai-content-gen',
        tags: ['ai', 'gpt', 'content', 'marketing'],
        isPremium: true,
        inputSchema: {
          type: 'object',
          required: ['topic', 'contentType'],
          properties: {
            topic: {
              type: 'string',
              title: 'Chủ đề',
              description: 'Chủ đề bạn muốn viết về',
              'x-ui': { widget: 'text', placeholder: 'VD: Xu hướng AI trong kinh doanh 2026' },
            },
            contentType: {
              type: 'string',
              title: 'Loại nội dung',
              enum: ['blog_post', 'social_caption', 'email', 'product_description', 'ad_copy'],
              'x-ui': {
                widget: 'select',
                labels: {
                  blog_post: '📝 Bài blog',
                  social_caption: '📱 Caption mạng xã hội',
                  email: '📧 Email marketing',
                  product_description: '🛒 Mô tả sản phẩm',
                  ad_copy: '📢 Nội dung quảng cáo',
                },
              },
            },
            tone: {
              type: 'string',
              title: 'Giọng văn',
              enum: ['professional', 'casual', 'humorous', 'persuasive', 'informative'],
              default: 'professional',
              'x-ui': { widget: 'select' },
            },
            language: {
              type: 'string',
              title: 'Ngôn ngữ',
              enum: ['vi', 'en'],
              default: 'vi',
              'x-ui': { widget: 'radio', labels: { vi: '🇻🇳 Tiếng Việt', en: '🇬🇧 English' } },
            },
            maxWords: {
              type: 'number',
              title: 'Số từ tối đa',
              default: 500,
              'x-ui': { widget: 'number', min: 50, max: 3000, step: 50 },
            },
            additionalContext: {
              type: 'string',
              title: 'Thông tin bổ sung',
              description: 'Bối cảnh, từ khóa, yêu cầu đặc biệt',
              'x-ui': { widget: 'textarea', rows: 3 },
            },
          },
        },
        averageRunTime: 15000,
        sortOrder: 2,
      },
    }),

    // Template 3: Daily Report to Telegram
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-daily-report' },
      update: {},
      create: {
        name: 'Daily Report to Telegram',
        description: 'Gửi báo cáo hàng ngày tổng hợp từ Google Sheets lên Telegram',
        icon: '📊',
        categoryId: notifCategory.id,
        n8nWorkflowId: 'tpl-daily-report',
        webhookPath: 'flowos/daily-report',
        tags: ['report', 'telegram', 'google-sheets'],
        inputSchema: {
          type: 'object',
          required: ['spreadsheetUrl', 'sheetName'],
          properties: {
            spreadsheetUrl: {
              type: 'string',
              title: 'Google Sheets URL',
              description: 'Link Google Sheets chứa dữ liệu báo cáo',
              'x-ui': { widget: 'text', placeholder: 'https://docs.google.com/spreadsheets/d/...' },
            },
            sheetName: {
              type: 'string',
              title: 'Tên Sheet',
              default: 'Sheet1',
              'x-ui': { widget: 'text' },
            },
            reportFormat: {
              type: 'string',
              title: 'Định dạng báo cáo',
              enum: ['summary', 'detailed', 'chart'],
              default: 'summary',
              'x-ui': { widget: 'select' },
            },
          },
        },
        averageRunTime: 8000,
        sortOrder: 3,
      },
    }),

    // Template 4: Shopee Order Notification
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-shopee-notify' },
      update: {},
      create: {
        name: 'Shopee Order Notification',
        description: 'Nhận thông báo đơn hàng Shopee mới qua Telegram',
        icon: '🛒',
        categoryId: categories[2].id, // e-commerce
        n8nWorkflowId: 'tpl-shopee-notify',
        webhookPath: 'flowos/shopee-notify',
        tags: ['shopee', 'e-commerce', 'notification'],
        isPremium: true,
        inputSchema: {
          type: 'object',
          required: ['shopId'],
          properties: {
            shopId: {
              type: 'string',
              title: 'Shop ID',
              description: 'ID cửa hàng Shopee',
              'x-ui': { widget: 'text' },
            },
            notifyTypes: {
              type: 'string',
              title: 'Loại thông báo',
              enum: ['all', 'new_order', 'canceled', 'shipped'],
              default: 'new_order',
              'x-ui': { widget: 'select' },
            },
            includeProductDetails: {
              type: 'boolean',
              title: 'Bao gồm chi tiết sản phẩm',
              default: true,
              'x-ui': { widget: 'checkbox' },
            },
          },
        } as any,
        averageRunTime: 5000,
        sortOrder: 4,
      },
    }),

    // Template 5: CSV Data Processing
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-csv-process' },
      update: {},
      create: {
        name: 'CSV Data Processing',
        description: 'Xử lý file CSV: lọc, chuyển đổi và export kết quả',
        icon: '📑',
        categoryId: dataCategory.id,
        n8nWorkflowId: 'tpl-csv-process',
        webhookPath: 'flowos/csv-process',
        tags: ['csv', 'data', 'processing'],
        inputSchema: {
          type: 'object',
          required: ['csvUrl', 'operation'],
          properties: {
            csvUrl: {
              type: 'string',
              title: 'CSV URL hoặc dữ liệu',
              description: 'Link đến file CSV hoặc paste dữ liệu CSV trực tiếp',
              'x-ui': { widget: 'textarea', rows: 3 },
            },
            operation: {
              type: 'string',
              title: 'Thao tác',
              enum: ['filter', 'sort', 'deduplicate', 'transform', 'aggregate'],
              'x-ui': {
                widget: 'select',
                labels: {
                  filter: '🔍 Lọc dữ liệu',
                  sort: '📊 Sắp xếp',
                  deduplicate: '🧹 Loại bỏ trùng lặp',
                  transform: '🔄 Chuyển đổi',
                  aggregate: '📈 Tổng hợp',
                },
              },
            },
            filterColumn: {
              type: 'string',
              title: 'Cột lọc',
              description: 'Tên cột để áp dụng thao tác',
              'x-ui': { widget: 'text' },
            },
            filterValue: {
              type: 'string',
              title: 'Giá trị lọc',
              'x-ui': { widget: 'text' },
            },
            outputFormat: {
              type: 'string',
              title: 'Định dạng kết quả',
              enum: ['csv', 'json', 'table'],
              default: 'json',
              'x-ui': { widget: 'select' },
            },
          },
        },
        averageRunTime: 10000,
        sortOrder: 5,
      },
    }),

    // Template 6: Email Campaign Sender
    prisma.template.upsert({
      where: { n8nWorkflowId: 'tpl-email-campaign' },
      update: {},
      create: {
        name: 'Email Campaign Sender',
        description: 'Gửi email hàng loạt từ danh sách liên hệ',
        icon: '📧',
        categoryId: marketingCategory.id,
        n8nWorkflowId: 'tpl-email-campaign',
        webhookPath: 'flowos/email-campaign',
        tags: ['email', 'marketing', 'campaign'],
        isPremium: true,
        inputSchema: {
          type: 'object',
          required: ['subject', 'body', 'recipientSource'],
          properties: {
            subject: {
              type: 'string',
              title: 'Tiêu đề email',
              'x-ui': { widget: 'text', placeholder: 'Chào mừng bạn đến với...' },
            },
            body: {
              type: 'string',
              title: 'Nội dung email',
              description: 'Hỗ trợ HTML. Sử dụng {{name}} cho personalization.',
              'x-ui': { widget: 'richtext' },
            },
            recipientSource: {
              type: 'string',
              title: 'Nguồn danh sách',
              enum: ['csv_url', 'google_sheet', 'manual'],
              'x-ui': { widget: 'select' },
            },
            recipientData: {
              type: 'string',
              title: 'Dữ liệu người nhận',
              description: 'URL CSV / Google Sheet hoặc danh sách email',
              'x-ui': { widget: 'textarea', rows: 3 },
            },
            fromName: {
              type: 'string',
              title: 'Tên người gửi',
              default: 'FlowOS',
              'x-ui': { widget: 'text' },
            },
          },
        },
        averageRunTime: 30000,
        sortOrder: 6,
      },
    }),
  ]);
  console.log(`   ✅ ${templates.length} templates ready\n`);

  // ═══════════════════════════════════
  // 3. PLANS
  // ═══════════════════════════════════
  console.log('💳 Seeding plans...');
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: 'plan-free' },
      update: {},
      create: {
        id: 'plan-free',
        name: 'Free',
        description: 'Gói miễn phí — Trải nghiệm cơ bản',
        price: 0,
        currency: 'VND',
        interval: 'MONTH',
        executionLimit: 100,
        templateAccess: [],
        features: [
          '100 lượt chạy/tháng',
          'Templates miễn phí',
          'Lịch sử 30 ngày',
          'Hỗ trợ qua cộng đồng',
        ],
        sortOrder: 1,
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-pro' },
      update: {},
      create: {
        id: 'plan-pro',
        name: 'Pro',
        description: 'Gói chuyên nghiệp — Dành cho cá nhân',
        price: 199000,
        currency: 'VND',
        interval: 'MONTH',
        executionLimit: 1000,
        templateAccess: [],
        features: [
          '1,000 lượt chạy/tháng',
          'Tất cả templates (bao gồm Premium)',
          'Lịch sử không giới hạn',
          'SSE realtime tracking',
          'Hỗ trợ qua email',
          'Export kết quả',
        ],
        sortOrder: 2,
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-business' },
      update: {},
      create: {
        id: 'plan-business',
        name: 'Business',
        description: 'Gói doanh nghiệp — Dành cho team',
        price: 599000,
        currency: 'VND',
        interval: 'MONTH',
        executionLimit: 5000,
        templateAccess: [],
        features: [
          '5,000 lượt chạy/tháng',
          'Tất cả templates Premium',
          'API access',
          'Priority support',
          'Custom templates (yêu cầu)',
          'Webhook integration',
          'Team management (soon)',
        ],
        sortOrder: 3,
      },
    }),
    prisma.plan.upsert({
      where: { id: 'plan-enterprise' },
      update: {},
      create: {
        id: 'plan-enterprise',
        name: 'Enterprise',
        description: 'Gói doanh nghiệp lớn — Tùy chỉnh theo nhu cầu',
        price: 0,
        currency: 'VND',
        interval: 'MONTH',
        executionLimit: 999999,
        templateAccess: [],
        features: [
          'Không giới hạn lượt chạy',
          'Tất cả tính năng',
          'Dedicated support',
          'Custom workflow development',
          'SLA guarantee',
          'On-premise deployment option',
        ],
        isPublic: false,
        sortOrder: 4,
      },
    }),
  ]);
  console.log(`   ✅ ${plans.length} plans ready\n`);

  // ═══════════════════════════════════
  // 4. ADMIN ACCOUNT
  // ═══════════════════════════════════
  console.log('👤 Seeding admin account...');
  const adminDefaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'FlowOS2026!';
  if (!process.env.ADMIN_DEFAULT_PASSWORD) {
    console.warn('   ⚠️  Using default admin password. Set ADMIN_DEFAULT_PASSWORD env to customize.');
  }
  const adminPasswordHash = await bcrypt.hash(adminDefaultPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@flowos.io' },
    update: {},
    create: {
      email: 'admin@flowos.io',
      passwordHash: adminPasswordHash,
      fullName: 'FlowOS Admin',
      systemRole: 'SUPER_ADMIN',
    },
  });
  console.log(`   ✅ Admin: ${admin.email} (${admin.systemRole})\n`);

  // ═══════════════════════════════════
  // 5. SYSTEM CONFIG
  // ═══════════════════════════════════
  console.log('⚙️ Seeding system config...');
  await prisma.systemConfig.upsert({
    where: { key: 'platform.maintenance' },
    update: {},
    create: {
      key: 'platform.maintenance',
      value: { enabled: false, message: '' },
    },
  });
  await prisma.systemConfig.upsert({
    where: { key: 'platform.version' },
    update: {},
    create: {
      key: 'platform.version',
      value: { version: '1.0.0', releaseDate: '2026-06-04' },
    },
  });
  console.log('   ✅ System config ready\n');

  console.log('═══════════════════════════════════');
  console.log('🎉 FlowOS seed complete!');
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Templates:  ${templates.length}`);
  console.log(`   Plans:      ${plans.length}`);
  console.log(`   Admin:      ${admin.email}`);
  console.log('═══════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
