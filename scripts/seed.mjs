#!/usr/bin/env node
/**
 * Idempotent local seed: representative trilingual content for development.
 *
 *   node scripts/seed.mjs            # writes scripts/seed.generated.sql
 *   npm run db:seed:local           # ...and applies it to the local D1
 *
 * Admin login after seeding:  admin@engurhesi.ge / engurhesi-dev-2026
 * (TOTP enrollment starts on first login.)
 */
import { webcrypto as crypto, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'seed.generated.sql');
const MEDIA_UPLOAD_OUT = join(dirname(fileURLToPath(import.meta.url)), 'seed-media-upload.sh');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@engurhesi.ge';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'engurhesi-dev-2026';
// must match src/lib/server/auth/password.ts (Workers caps PBKDF2 at 100k)
const PBKDF2_ITERATIONS = 100_000;

const NOW = new Date().toISOString();
const q = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

// --- rich text helpers (mirror the server renderer for seed content) --------
const doc = (...paragraphs) =>
  JSON.stringify({
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
  });
const htmlOf = (...paragraphs) => paragraphs.map((p) => `<p>${p}</p>`).join('');
const textOf = (...paragraphs) => paragraphs.join('\n');

async function hashPassword(password, saltB64) {
  const salt = Uint8Array.from(Buffer.from(saltB64, 'base64'));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Buffer.from(new Uint8Array(derived)).toString('base64');
}

const statements = [];
const insert = (table, row) => {
  const cols = Object.keys(row);
  statements.push(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => q(row[c])).join(', ')});`
  );
};
const meta = {
  created_at: NOW,
  updated_at: NOW,
  created_by: 'seed-admin',
  updated_by: 'seed-admin',
  version: 1
};
const i18nBody = (locale, paragraphs, extra = {}) => ({
  locale,
  body_json: doc(...paragraphs),
  body_html: htmlOf(...paragraphs),
  body_text: textOf(...paragraphs),
  content_schema_version: 1,
  review_status: locale === 'ka' ? 'reviewed' : 'machine',
  stale_source: 0,
  translation_model: locale === 'ka' ? null : 'seed',
  translation_provider: locale === 'ka' ? null : 'seed',
  ...extra
});
const fts = (entity, entityId, locale, title, bodyText) => {
  statements.push(
    `DELETE FROM search_index_fts WHERE entity = ${q(entity)} AND entity_id = ${q(entityId)} AND locale = ${q(locale)};`
  );
  statements.push(
    `INSERT INTO search_index_fts (entity, entity_id, locale, title, body_text) VALUES (${q(entity)}, ${q(entityId)}, ${q(locale)}, ${q(title)}, ${q(bodyText)});`
  );
};

// --- admin user --------------------------------------------------------------
const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
const hash = await hashPassword(ADMIN_PASSWORD, salt);
insert('users', {
  id: 'seed-admin',
  email: ADMIN_EMAIL,
  name: 'დეველოპერი',
  role: 'admin',
  password_hash: hash,
  password_salt: salt,
  totp_verified: 0,
  failed_logins: 0,
  created_at: NOW,
  updated_at: NOW
});

// --- settings ---------------------------------------------------------------
for (const [key, value] of Object.entries({
  contact_address: 'პატარა ჯვარი, წალენჯიხის მუნიციპალიტეტი, საქართველო',
  contact_address_en: 'Patara Jvari, Tsalenjikha Municipality, Georgia',
  contact_address_ru: 'Патара Джвари, Цаленджихский муниципалитет, Грузия',
  contact_phone: '+995 32 227 08 08',
  contact_email: 'info@engurhesi.ge'
})) {
  insert('settings', { key, value });
}

// --- media -------------------------------------------------------------------
// Photos originally published on engurhesi.ge, stored in static/img and mirrored
// into the local R2 bucket by scripts/seed-media-upload.sh (generated below).
const MEDIA = [
  {
    id: 'seed-media-hero',
    file: 'hero-dam.jpg',
    w: 1920,
    h: 960,
    placeholder: '#0b3c5d',
    alts: {
      ka: 'ენგურის კაშხალი — თაღოვანი კაშხლის ხედი',
      en: 'The Enguri arch dam',
      ru: 'Арочная плотина Ингури'
    }
  },
  {
    id: 'seed-media-unit',
    file: 'news-629161708101736.jpg',
    w: 1920,
    h: 1280,
    placeholder: '#11527d',
    alts: {
      ka: 'ჰიდროაგრეგატის სამანქანო დარბაზი',
      en: 'Turbine hall of the power plant',
      ru: 'Машинный зал электростанции'
    }
  },
  {
    id: 'seed-media-visit',
    file: 'news-345601765805312.jpg',
    w: 819,
    h: 546,
    placeholder: '#33475a',
    alts: {
      ka: 'დელეგაციის ვიზიტი ენგურჰესზე',
      en: 'Delegation visiting Enguri HPP',
      ru: 'Визит делегации на Ингурскую ГЭС'
    }
  },
  {
    id: 'seed-media-enviro',
    file: 'news-561821759756710.jpg',
    w: 819,
    h: 464,
    placeholder: '#15803d',
    alts: {
      ka: 'ენგურის წყალსაცავი',
      en: 'The Enguri reservoir',
      ru: 'Ингурское водохранилище'
    }
  },
  {
    id: 'seed-media-iso',
    file: 'news-507461698150869.jpg',
    w: 496,
    h: 702,
    placeholder: '#0e7490',
    alts: {
      ka: 'ენგურჰესის სერტიფიცირება',
      en: 'Certification at Enguri HPP',
      ru: 'Сертификация на Ингурской ГЭС'
    }
  },
  {
    id: 'seed-media-operation',
    file: 'operation.jpg',
    w: 1920,
    h: 1284,
    placeholder: '#0b3c5d',
    alts: {
      ka: 'ენგურჰესის ექსპლუატაცია — კაშხლის ხედი',
      en: 'Enguri HPP in operation',
      ru: 'Ингурская ГЭС в эксплуатации'
    }
  },
  {
    id: 'seed-media-activity',
    file: 'activity.jpg',
    w: 1920,
    h: 1279,
    placeholder: '#072a42',
    alts: {
      ka: 'ენგურის ხეობა და ჰიდროკვანძი',
      en: 'The Enguri valley and hydro complex',
      ru: 'Долина Ингури и гидроузел'
    }
  },
  {
    id: 'seed-media-construction',
    file: 'construction.jpg',
    w: 868,
    h: 1362,
    placeholder: '#5c718a',
    alts: {
      ka: 'ენგურჰესის მშენებლობა — არქივი',
      en: 'Construction of Enguri HPP — archive',
      ru: 'Строительство Ингурской ГЭС — архив'
    }
  },
  // partner logos
  {
    id: 'seed-media-logo-economy',
    file: 'partners/min-economy.jpg',
    w: 2256,
    h: 1304,
    logo: true,
    alts: {
      ka: 'საქართველოს ეკონომიკისა და მდგრადი განვითარების სამინისტრო',
      en: 'Ministry of Economy and Sustainable Development of Georgia',
      ru: 'Министерство экономики и устойчивого развития Грузии'
    }
  },
  {
    id: 'seed-media-logo-gnerc',
    file: 'partners/gnerc.png',
    w: 128,
    h: 127,
    logo: true,
    alts: { ka: 'სემეკი', en: 'GNERC', ru: 'GNERC' }
  },
  {
    id: 'seed-media-logo-gse',
    file: 'partners/gse.jpg',
    w: 112,
    h: 126,
    logo: true,
    alts: {
      ka: 'საქართველოს სახელმწიფო ელექტროსისტემა',
      en: 'Georgian State Electrosystem',
      ru: 'Государственная электросистема Грузии'
    }
  },
  {
    id: 'seed-media-logo-esco',
    file: 'partners/esco.jpg',
    w: 814,
    h: 226,
    logo: true,
    alts: { ka: 'ესკო', en: 'ESCO', ru: 'ESCO' }
  },
  {
    id: 'seed-media-logo-energo-pro',
    file: 'partners/energo-pro.jpg',
    w: 1847,
    h: 414,
    logo: true,
    alts: { ka: 'ენერგო-პრო ჯორჯია', en: 'Energo-Pro Georgia', ru: 'Энерго-Про Джорджия' }
  },
  {
    id: 'seed-media-logo-telasi',
    file: 'partners/telasi.jpg',
    w: 668,
    h: 214,
    logo: true,
    alts: { ka: 'თელასი', en: 'Telasi', ru: 'Теласи' }
  },
  {
    id: 'seed-media-logo-gedf',
    file: 'partners/gedf.jpg',
    w: 992,
    h: 520,
    logo: true,
    alts: {
      ka: 'საქართველოს ენერგეტიკის განვითარების ფონდი',
      en: 'Georgian Energy Development Fund',
      ru: 'Фонд развития энергетики Грузии'
    }
  },
  {
    id: 'seed-media-logo-genex',
    file: 'partners/genex.jpg',
    w: 472,
    h: 119,
    logo: true,
    alts: {
      ka: 'საქართველოს ენერგეტიკული ბირჟა',
      en: 'Georgian Energy Exchange',
      ru: 'Грузинская энергетическая биржа'
    }
  }
];

const uploadLines = [
  '#!/bin/sh',
  '# Generated by scripts/seed.mjs — uploads seed media into the local R2 bucket.',
  'set -e',
  'cd "$(dirname "$0")/.."'
];
const mediaKey = {};
for (const item of MEDIA) {
  const bytes = readFileSync(join(ROOT, 'static/img', item.file));
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const safeName = item.file
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-');
  const r2Key = `images/${checksum.slice(0, 12)}-${safeName}`;
  const mime = item.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  mediaKey[item.id] = r2Key;
  insert('media', {
    id: item.id,
    r2_key: r2Key,
    kind: 'image',
    declared_mime: mime,
    detected_mime: mime,
    size: bytes.length,
    width: item.w,
    height: item.h,
    original_filename: safeName,
    checksum,
    placeholder_color: item.placeholder ?? '#dcebf5',
    status: 'active',
    created_by: 'seed-admin',
    created_at: NOW,
    updated_at: NOW
  });
  for (const [locale, alt] of Object.entries(item.alts)) {
    insert('media_i18n', { media_id: item.id, locale, alt });
  }
  uploadLines.push(
    `npx wrangler r2 object put "engurhesi-media/${r2Key}" --file "static/img/${item.file}" --content-type "${mime}" --local`
  );
}
writeFileSync(MEDIA_UPLOAD_OUT, uploadLines.join('\n') + '\n', { mode: 0o755 });

insert('settings', { key: 'hero_media_id', value: 'seed-media-hero' });

// --- stats -------------------------------------------------------------------
const statsSeed = [
  [
    'capacity_mw',
    '1300',
    'მგვტ',
    { ka: 'დადგმული სიმძლავრე', en: 'Installed capacity', ru: 'Установленная мощность' }
  ],
  ['dam_height_m', '271.5', 'მ', { ka: 'კაშხლის სიმაღლე', en: 'Dam height', ru: 'Высота плотины' }],
  [
    'annual_gwh',
    '3800',
    'გვტსთ',
    { ka: 'წლიური გამომუშავება', en: 'Annual generation', ru: 'Годовая выработка' }
  ],
  ['units', '5', '', { ka: 'ჰიდროაგრეგატი', en: 'Generating units', ru: 'Гидроагрегаты' }]
];
statsSeed.forEach(([key, value, unit, labels], index) => {
  const id = `seed-stat-${key}`;
  insert('stats', { id, key, value, unit: unit || null, sort: index + 1, ...meta });
  for (const [locale, label] of Object.entries(labels)) {
    insert('stat_i18n', { stat_id: id, locale, label });
  }
});

// --- about pages ---------------------------------------------------------------
const pages = [
  {
    id: 'seed-page-history',
    slug: 'history',
    sort: 1,
    titles: { ka: 'ისტორია', en: 'History', ru: 'История' },
    bodies: {
      ka: [
        'ენგურის ჰიდროელექტროსადგური საქართველოს უმსხვილესი ელექტროსადგურია, რომლის მშენებლობა 1961 წელს დაიწყო და პირველი აგრეგატი 1978 წელს ამუშავდა.',
        '271,5 მეტრის სიმაღლის თაღოვანი კაშხალი მსოფლიოში ერთ-ერთი ყველაზე მაღალი თაღოვანი კაშხალია.'
      ],
      en: [
        'The Enguri Hydro Power Plant is the largest power plant in Georgia. Construction began in 1961 and the first unit was commissioned in 1978.',
        'The 271.5-metre arch dam is among the tallest arch dams in the world.'
      ],
      ru: [
        'Ингурская ГЭС — крупнейшая электростанция Грузии. Строительство началось в 1961 году, первый агрегат был введён в эксплуатацию в 1978 году.',
        'Арочная плотина высотой 271,5 метра — одна из самых высоких арочных плотин в мире.'
      ]
    }
  },
  {
    id: 'seed-page-mission',
    slug: 'mission',
    sort: 2,
    titles: { ka: 'მისია', en: 'Mission', ru: 'Миссия' },
    bodies: {
      ka: [
        'შპს „ენგურჰესის" მისიაა საქართველოს ენერგოსისტემის სტაბილური მომარაგება სუფთა, განახლებადი ენერგიით.'
      ],
      en: [
        'The mission of Engurhesi Ltd is to reliably supply the Georgian energy system with clean, renewable energy.'
      ],
      ru: [
        'Миссия ООО «Ингургэс» — стабильное снабжение энергосистемы Грузии чистой возобновляемой энергией.'
      ]
    }
  },
  {
    id: 'seed-page-management',
    slug: 'management',
    sort: 3,
    titles: { ka: 'მენეჯმენტი', en: 'Management', ru: 'Менеджмент' },
    bodies: {
      ka: ['კომპანიის მართვის სტრუქტურა.'],
      en: ['The company management structure.'],
      ru: ['Структура управления компанией.']
    }
  },
  {
    id: 'seed-page-reports',
    slug: 'reports',
    sort: 4,
    titles: { ka: 'ანგარიშები', en: 'Reports', ru: 'Отчёты' },
    bodies: {
      ka: ['კომპანიის ფინანსური და საოპერაციო ანგარიშები.'],
      en: ['Financial and operational reports of the company.'],
      ru: ['Финансовые и операционные отчёты компании.']
    }
  }
];
for (const page of pages) {
  insert('pages', {
    id: page.id,
    slug: page.slug,
    section: 'about',
    sort: page.sort,
    status: 'published',
    published_at: NOW,
    ...meta
  });
  for (const locale of ['ka', 'en', 'ru']) {
    insert('page_i18n', {
      page_id: page.id,
      title: page.titles[locale],
      ...i18nBody(locale, page.bodies[locale])
    });
    fts('page', page.id, locale, page.titles[locale], textOf(...page.bodies[locale]));
  }
}

// --- news articles ------------------------------------------------------------
const articles = [
  {
    id: 'seed-article-1',
    slug: 'agregati-4-reabilitacia',
    category: 'news',
    cover: 'seed-media-unit',
    publishedAt: '2026-06-15T10:00:00.000Z',
    legacyId: 101,
    titles: {
      ka: 'მეოთხე ჰიდროაგრეგატის რეაბილიტაცია დასრულდა',
      en: 'Rehabilitation of the fourth generating unit completed',
      ru: 'Завершена реабилитация четвёртого гидроагрегата'
    },
    excerpts: {
      ka: 'მეოთხე ჰიდროაგრეგატი განახლებული ტურბინით დაუბრუნდა ქსელს.',
      en: 'Unit four has returned to the grid with a refurbished turbine.',
      ru: 'Четвёртый агрегат вернулся в сеть с обновлённой турбиной.'
    },
    bodies: {
      ka: [
        'ენგურჰესზე დასრულდა მეოთხე ჰიდროაგრეგატის სრული რეაბილიტაცია, რომელიც ევროპის რეკონსტრუქციისა და განვითარების ბანკის მხარდაჭერით მიმდინარეობდა.',
        'განახლებული აგრეგატი ქსელს 260 მეგავატი სიმძლავრით დაუბრუნდა.'
      ],
      en: [
        'The complete rehabilitation of the fourth generating unit at Enguri HPP, supported by the European Bank for Reconstruction and Development, has been completed.',
        'The refurbished unit has returned to the grid with a capacity of 260 MW.'
      ],
      ru: [
        'На Ингурской ГЭС завершена полная реабилитация четвёртого гидроагрегата при поддержке Европейского банка реконструкции и развития.',
        'Обновлённый агрегат вернулся в сеть с мощностью 260 МВт.'
      ]
    }
  },
  {
    id: 'seed-article-2',
    slug: 'saertashoriso-vizita',
    category: 'news',
    cover: 'seed-media-visit',
    publishedAt: '2026-05-20T09:00:00.000Z',
    legacyId: 102,
    titles: {
      ka: 'საერთაშორისო დელეგაციის ვიზიტი ენგურჰესზე',
      en: 'International delegation visits Enguri HPP',
      ru: 'Визит международной делегации на Ингурскую ГЭС'
    },
    excerpts: {
      ka: 'პარტნიორი ორგანიზაციების წარმომადგენლები კაშხალს ესტუმრნენ.',
      en: 'Representatives of partner organisations toured the dam.',
      ru: 'Представители партнёрских организаций посетили плотину.'
    },
    bodies: {
      ka: [
        'ენგურჰესს საერთაშორისო საფინანსო ინსტიტუტების წარმომადგენლები ესტუმრნენ და მიმდინარე საინვესტიციო პროექტებს გაეცნენ.'
      ],
      en: [
        'Representatives of international financial institutions visited Enguri HPP and reviewed the ongoing investment projects.'
      ],
      ru: [
        'Представители международных финансовых институтов посетили Ингурскую ГЭС и ознакомились с текущими инвестиционными проектами.'
      ]
    }
  },
  {
    id: 'seed-article-3',
    slug: 'garemosdacviti-programa',
    category: 'news',
    cover: 'seed-media-enviro',
    publishedAt: '2026-04-02T12:00:00.000Z',
    legacyId: 103,
    titles: {
      ka: 'გარემოსდაცვითი პროგრამა 2026',
      en: 'Environmental programme 2026',
      ru: 'Экологическая программа 2026'
    },
    excerpts: {
      ka: 'კომპანიამ წლიური გარემოსდაცვითი პროგრამა დაამტკიცა.',
      en: 'The company approved its annual environmental programme.',
      ru: 'Компания утвердила годовую экологическую программу.'
    },
    bodies: {
      ka: [
        'ენგურჰესმა დაამტკიცა 2026 წლის გარემოსდაცვითი პროგრამა, რომელიც მოიცავს წყლის ხარისხის მონიტორინგსა და ბიომრავალფეროვნების კვლევებს.'
      ],
      en: [
        'Engurhesi approved the 2026 environmental programme, covering water quality monitoring and biodiversity studies.'
      ],
      ru: [
        'Ингургэс утвердил экологическую программу на 2026 год, включающую мониторинг качества воды и исследования биоразнообразия.'
      ]
    }
  }
];
for (const article of articles) {
  insert('articles', {
    id: article.id,
    slug: article.slug,
    category: article.category,
    cover_media_id: article.cover ?? null,
    status: 'published',
    published_at: article.publishedAt,
    legacy_id: article.legacyId,
    ...meta
  });
  for (const locale of ['ka', 'en', 'ru']) {
    insert('article_i18n', {
      article_id: article.id,
      title: article.titles[locale],
      excerpt: article.excerpts[locale],
      ...i18nBody(locale, article.bodies[locale])
    });
    fts('article', article.id, locale, article.titles[locale], textOf(...article.bodies[locale]));
  }
}

// --- procurements ---------------------------------------------------------------
const procurements = [
  {
    id: 'seed-proc-1',
    slug: 'transformatoris-shesyidva-2026',
    kind: 'tender',
    status: 'published',
    publishedAt: '2026-06-25T08:00:00.000Z',
    deadlineAt: '2026-07-25T14:00:00.000Z',
    tenderNumber: 'NAT260012662',
    tenderUrl: 'https://tenders.procurement.gov.ge/public/?go=324139&lang=ge',
    legacyId: 201,
    titles: {
      ka: 'ძალოვანი ტრანსფორმატორის შესყიდვა',
      en: 'Procurement of a power transformer',
      ru: 'Закупка силового трансформатора'
    },
    bodies: {
      ka: [
        'შპს „ენგურჰესი" აცხადებს ტენდერს 500 კვ ძალოვანი ტრანსფორმატორის შესყიდვაზე. წინადადებების მიღების ბოლო ვადაა 2026 წლის 25 ივლისი, 18:00 (თბილისის დროით).'
      ],
      en: [
        'Engurhesi Ltd announces a tender for the procurement of a 500 kV power transformer. The deadline for proposals is 25 July 2026, 18:00 Tbilisi time.'
      ],
      ru: [
        'ООО «Ингургэс» объявляет тендер на закупку силового трансформатора 500 кВ. Срок подачи предложений — 25 июля 2026 года, 18:00 по тбилисскому времени.'
      ]
    }
  },
  {
    id: 'seed-proc-2',
    slug: 'avtomankanebis-auqcioni-2026',
    kind: 'auction',
    status: 'closed',
    publishedAt: '2026-03-01T08:00:00.000Z',
    deadlineAt: '2026-04-01T14:00:00.000Z',
    legacyId: 202,
    titles: {
      ka: 'ჩამოწერილი ავტომანქანების აუქციონი',
      en: 'Auction of decommissioned vehicles',
      ru: 'Аукцион списанных автомобилей'
    },
    bodies: {
      ka: [
        'აუქციონი ჩამოწერილი სამსახურებრივი ავტომანქანების რეალიზაციაზე. აუქციონი დასრულებულია.'
      ],
      en: ['Auction for the sale of decommissioned service vehicles. The auction has closed.'],
      ru: ['Аукцион по продаже списанных служебных автомобилей. Аукцион завершён.']
    }
  }
];
for (const proc of procurements) {
  insert('procurements', {
    id: proc.id,
    slug: proc.slug,
    kind: proc.kind,
    status: proc.status,
    published_at: proc.publishedAt,
    deadline_at: proc.deadlineAt,
    tender_number: proc.tenderNumber ?? null,
    tender_url: proc.tenderUrl ?? null,
    legacy_id: proc.legacyId,
    ...meta
  });
  statements.push(
    `INSERT OR REPLACE INTO procurement_status_history (id, procurement_id, from_status, to_status, actor_id, reason, created_at) VALUES (${q(proc.id + '-h1')}, ${q(proc.id)}, 'draft', 'published', 'seed-admin', 'Initial publication', ${q(proc.publishedAt)});`
  );
  if (proc.status === 'closed') {
    statements.push(
      `INSERT OR REPLACE INTO procurement_status_history (id, procurement_id, from_status, to_status, actor_id, reason, created_at) VALUES (${q(proc.id + '-h2')}, ${q(proc.id)}, 'published', 'closed', 'seed-admin', 'Deadline passed, bids evaluated', ${q(proc.deadlineAt)});`
    );
  }
  for (const locale of ['ka', 'en', 'ru']) {
    insert('procurement_i18n', {
      procurement_id: proc.id,
      title: proc.titles[locale],
      ...i18nBody(locale, proc.bodies[locale])
    });
    fts('procurement', proc.id, locale, proc.titles[locale], textOf(...proc.bodies[locale]));
  }
}

// --- projects ---------------------------------------------------------------
const projects = [
  {
    id: 'seed-project-1',
    slug: 'reabilitacia-faza-3',
    sort: 1,
    cover: 'seed-media-operation',
    facts: [
      { label: 'ბიუჯეტი', value: '€45 მლნ' },
      { label: 'ვადა', value: '2024–2027' }
    ],
    titles: {
      ka: 'რეაბილიტაციის მესამე ფაზა',
      en: 'Rehabilitation Phase III',
      ru: 'Третья фаза реабилитации'
    },
    summaries: {
      ka: 'ჰიდროაგრეგატებისა და ინფრასტრუქტურის განახლების მასშტაბური პროგრამა.',
      en: 'A large-scale programme to modernise generating units and infrastructure.',
      ru: 'Масштабная программа модернизации гидроагрегатов и инфраструктуры.'
    },
    bodies: {
      ka: [
        'ევროპის რეკონსტრუქციისა და განვითარების ბანკის დაფინანსებით მიმდინარეობს ჰიდროაგრეგატების, წყალსაშვებისა და სადერივაციო გვირაბის განახლება.'
      ],
      en: [
        'With financing from the EBRD, the generating units, spillway and derivation tunnel are being modernised.'
      ],
      ru: [
        'При финансировании ЕБРР ведётся модернизация гидроагрегатов, водосброса и деривационного тоннеля.'
      ]
    }
  },
  {
    id: 'seed-project-2',
    slug: 'turistuli-infrastruktura',
    cover: 'seed-media-activity',
    sort: 2,
    facts: [{ label: 'სტატუსი', value: 'მიმდინარე' }],
    titles: {
      ka: 'ტურისტული ინფრასტრუქტურა',
      en: 'Tourism infrastructure',
      ru: 'Туристическая инфраструктура'
    },
    summaries: {
      ka: 'კაშხლის დათვალიერების ტურები და ვიზიტორთა ცენტრი.',
      en: 'Dam sightseeing tours and a visitor centre.',
      ru: 'Экскурсии на плотину и центр для посетителей.'
    },
    bodies: {
      ka: [
        'ენგურის კაშხალი ღიაა ვიზიტორებისთვის — ეწყობა ორგანიზებული ტურები კაშხლის თაღზე და მანქანათა დარბაზში.'
      ],
      en: [
        'The Enguri dam is open to visitors — organised tours run along the dam crest and to the machine hall.'
      ],
      ru: [
        'Ингурская плотина открыта для посетителей — организуются туры по гребню плотины и в машинный зал.'
      ]
    }
  }
];
for (const project of projects) {
  insert('projects', {
    id: project.id,
    slug: project.slug,
    sort: project.sort,
    cover_media_id: project.cover ?? null,
    status: 'published',
    facts_json: JSON.stringify(project.facts),
    ...meta
  });
  for (const locale of ['ka', 'en', 'ru']) {
    insert('project_i18n', {
      project_id: project.id,
      title: project.titles[locale],
      summary: project.summaries[locale],
      ...i18nBody(locale, project.bodies[locale])
    });
    fts('project', project.id, locale, project.titles[locale], textOf(...project.bodies[locale]));
  }
}

// --- partners ---------------------------------------------------------------
statements.push(`DELETE FROM partner_i18n;`, `DELETE FROM partners;`);
const partners = [
  {
    id: 'seed-partner-economy',
    url: 'http://www.economy.ge',
    logo: 'seed-media-logo-economy',
    names: {
      ka: 'ეკონომიკისა და მდგრადი განვითარების სამინისტრო',
      en: 'Ministry of Economy and Sustainable Development',
      ru: 'Министерство экономики и устойчивого развития'
    }
  },
  {
    id: 'seed-partner-gnerc',
    url: 'https://gnerc.org',
    logo: 'seed-media-logo-gnerc',
    names: { ka: 'სემეკი', en: 'GNERC', ru: 'GNERC' }
  },
  {
    id: 'seed-partner-gse',
    url: 'https://www.gse.com.ge',
    logo: 'seed-media-logo-gse',
    names: {
      ka: 'საქართველოს სახელმწიფო ელექტროსისტემა',
      en: 'Georgian State Electrosystem',
      ru: 'Государственная электросистема Грузии'
    }
  },
  {
    id: 'seed-partner-esco',
    url: 'https://esco.ge',
    logo: 'seed-media-logo-esco',
    names: { ka: 'ესკო', en: 'ESCO', ru: 'ESCO' }
  },
  {
    id: 'seed-partner-energo-pro',
    url: 'http://www.energo-pro.ge',
    logo: 'seed-media-logo-energo-pro',
    names: { ka: 'ენერგო-პრო ჯორჯია', en: 'Energo-Pro Georgia', ru: 'Энерго-Про Джорджия' }
  },
  {
    id: 'seed-partner-telasi',
    url: 'http://www.telasi.ge',
    logo: 'seed-media-logo-telasi',
    names: { ka: 'თელასი', en: 'Telasi', ru: 'Теласи' }
  },
  {
    id: 'seed-partner-gedf',
    url: 'https://www.gedf.com.ge',
    logo: 'seed-media-logo-gedf',
    names: {
      ka: 'ენერგეტიკის განვითარების ფონდი',
      en: 'Georgian Energy Development Fund',
      ru: 'Фонд развития энергетики Грузии'
    }
  },
  {
    id: 'seed-partner-genex',
    url: 'https://genex.ge',
    logo: 'seed-media-logo-genex',
    names: {
      ka: 'საქართველოს ენერგეტიკული ბირჟა',
      en: 'Georgian Energy Exchange',
      ru: 'Грузинская энергетическая биржа'
    }
  }
];
partners.forEach((partner, index) => {
  insert('partners', {
    id: partner.id,
    url: partner.url,
    logo_media_id: partner.logo,
    sort: index + 1,
    ...meta
  });
  for (const [locale, name] of Object.entries(partner.names)) {
    insert('partner_i18n', { partner_id: partner.id, locale, name });
  }
});

// --- gallery album -------------------------------------------------------------
const album = {
  id: 'seed-album-1',
  slug: 'enguri-dges',
  cover: 'seed-media-hero',
  titles: { ka: 'ენგურჰესი დღეს', en: 'Enguri HPP today', ru: 'Ингурская ГЭС сегодня' },
  descriptions: {
    ka: 'კაშხალი, სამანქანო დარბაზი და ენგურის ხეობა.',
    en: 'The dam, the turbine hall and the Enguri valley.',
    ru: 'Плотина, машинный зал и долина Ингури.'
  },
  items: [
    'seed-media-hero',
    'seed-media-operation',
    'seed-media-unit',
    'seed-media-activity',
    'seed-media-enviro',
    'seed-media-construction'
  ]
};
insert('albums', {
  id: album.id,
  slug: album.slug,
  cover_media_id: album.cover,
  sort: 1,
  status: 'published',
  published_at: NOW,
  ...meta
});
for (const locale of ['ka', 'en', 'ru']) {
  insert('album_i18n', {
    album_id: album.id,
    locale,
    title: album.titles[locale],
    description: album.descriptions[locale],
    review_status: locale === 'ka' ? 'reviewed' : 'machine',
    stale_source: 0,
    translation_model: locale === 'ka' ? null : 'seed',
    translation_provider: locale === 'ka' ? null : 'seed'
  });
}
album.items.forEach((mediaId, index) => {
  insert('album_items', { album_id: album.id, media_id: mediaId, sort: index + 1 });
});

// --- org units ---------------------------------------------------------------
const orgSeed = [
  {
    id: 'seed-org-director',
    parent: null,
    sort: 1,
    i18n: {
      ka: ['გენერალური დირექტორი', 'ლევან მებონია'],
      en: ['General Director', 'Levan Mebonia'],
      ru: ['Генеральный директор', 'Леван Мебония']
    }
  },
  {
    id: 'seed-org-tech',
    parent: 'seed-org-director',
    sort: 1,
    i18n: {
      ka: ['ტექნიკური დირექცია', null],
      en: ['Technical Directorate', null],
      ru: ['Техническая дирекция', null]
    }
  },
  {
    id: 'seed-org-finance',
    parent: 'seed-org-director',
    sort: 2,
    i18n: {
      ka: ['საფინანსო დირექცია', null],
      en: ['Finance Directorate', null],
      ru: ['Финансовая дирекция', null]
    }
  }
];
for (const unit of orgSeed) {
  insert('org_units', { id: unit.id, parent_id: unit.parent, sort: unit.sort, ...meta });
  for (const [locale, [title, person]] of Object.entries(unit.i18n)) {
    insert('org_unit_i18n', { org_unit_id: unit.id, locale, title, person_name: person });
  }
}

// --- glossary ---------------------------------------------------------------
const glossarySeed = [
  ['შპს „ენგურჰესი"', 'Engurhesi Ltd', 'ООО «Ингургэс»', 'Official company name'],
  ['ენგურის ჰიდროელექტროსადგური', 'Enguri Hydro Power Plant', 'Ингурская ГЭС', null],
  ['თაღოვანი კაშხალი', 'arch dam', 'арочная плотина', null],
  ['ჰიდროაგრეგატი', 'generating unit', 'гидроагрегат', null]
];
glossarySeed.forEach(([ka, en, ru, note], index) => {
  insert('glossary', {
    id: `seed-gloss-${index + 1}`,
    term_ka: ka,
    term_en: en,
    term_ru: ru,
    note,
    version: 1
  });
});

// --- legacy redirects ---------------------------------------------------------
insert('redirects', {
  old_path: '/ge/news',
  new_path: '/ka/news',
  status_code: 301,
  locale: 'ka',
  note: 'legacy section'
});

// -------------------------------------------------------------------------------
const sqlText = `-- Generated by scripts/seed.mjs at ${NOW} — do not edit by hand.\n${statements.join('\n')}\n`;
writeFileSync(OUT, sqlText);
console.log(`Wrote ${statements.length} statements to ${OUT}`);
console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
