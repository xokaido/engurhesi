export const LOCALES = ['ka', 'en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ka';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ka: 'ქა',
  en: 'EN',
  ru: 'РУ'
};

type Dict = Record<string, { ka: string; en: string; ru: string }>;

const dict = {
  siteName: {
    ka: 'შპს „ენგურჰესი"',
    en: 'Engurhesi LLC',
    ru: 'ООО «Ингури ГЭС»'
  },
  siteTagline: {
    ka: 'ენგურის ჰიდროელექტროსადგური — კავკასიის უდიდესი ჰესი',
    en: 'Enguri Hydro Power Plant — the largest HPP in the Caucasus',
    ru: 'Ингурская ГЭС — крупнейшая гидроэлектростанция Кавказа'
  },
  navHome: { ka: 'მთავარი', en: 'Home', ru: 'Главная' },
  navAbout: { ka: 'ჩვენ შესახებ', en: 'About', ru: 'О нас' },
  navNews: { ka: 'სიახლეები', en: 'News', ru: 'Новости' },
  navProcurement: { ka: 'შესყიდვები', en: 'Procurement', ru: 'Закупки' },
  navProjects: { ka: 'პროექტები', en: 'Projects', ru: 'Проекты' },
  navMedia: { ka: 'მედია', en: 'Media', ru: 'Медиа' },
  navContact: { ka: 'კონტაქტი', en: 'Contact', ru: 'Контакты' },
  search: { ka: 'ძიება', en: 'Search', ru: 'Поиск' },
  searchPlaceholder: { ka: 'საძიებო სიტყვა…', en: 'Search the site…', ru: 'Поиск по сайту…' },
  searchResults: { ka: 'ძიების შედეგები', en: 'Search results', ru: 'Результаты поиска' },
  searchNoResults: {
    ka: 'შედეგები ვერ მოიძებნა',
    en: 'No results found',
    ru: 'Ничего не найдено'
  },
  // Home
  heroCtaAbout: { ka: 'სადგურის შესახებ', en: 'About the plant', ru: 'О станции' },
  heroCtaProcurement: { ka: 'შესყიდვები', en: 'Procurement', ru: 'Закупки' },
  latestNews: { ka: 'ბოლო სიახლეები', en: 'Latest news', ru: 'Последние новости' },
  allNews: { ka: 'ყველა სიახლე', en: 'All news', ru: 'Все новости' },
  activeProcurement: {
    ka: 'მიმდინარე შესყიდვები',
    en: 'Active procurement',
    ru: 'Текущие закупки'
  },
  allProcurement: { ka: 'ყველა შესყიდვა', en: 'All procurement', ru: 'Все закупки' },
  ourProjects: { ka: 'ჩვენი პროექტები', en: 'Our projects', ru: 'Наши проекты' },
  allProjects: { ka: 'ყველა პროექტი', en: 'All projects', ru: 'Все проекты' },
  partners: { ka: 'პარტნიორები', en: 'Partners', ru: 'Партнёры' },
  aboutTeaserKicker: { ka: 'სადგურის შესახებ', en: 'About the plant', ru: 'О станции' },
  aboutTeaserTitle: {
    ka: 'კავკასიის უდიდესი ჰიდროელექტროსადგური',
    en: 'The largest hydro power plant in the Caucasus',
    ru: 'Крупнейшая гидроэлектростанция Кавказа'
  },
  aboutTeaserBody: {
    ka: 'ენგურის 271.5-მეტრიანი თაღოვანი კაშხალი მსოფლიოში ერთ-ერთი ყველაზე მაღალია. სადგური საქართველოს ელექტროენერგიის მნიშვნელოვან ნაწილს გამოიმუშავებს და ქვეყნის ენერგოსისტემის საყრდენია.',
    en: 'The 271.5-metre Enguri arch dam is among the tallest in the world. The plant generates a substantial share of Georgia’s electricity and anchors the national power system.',
    ru: 'Арочная плотина Ингури высотой 271,5 м — одна из самых высоких в мире. Станция вырабатывает значительную долю электроэнергии Грузии и является опорой энергосистемы страны.'
  },
  learnMore: { ka: 'გაიგეთ მეტი', en: 'Learn more', ru: 'Узнать больше' },
  quickLinks: { ka: 'ნავიგაცია', en: 'Navigation', ru: 'Навигация' },
  // News
  categoryAll: { ka: 'ყველა', en: 'All', ru: 'Все' },
  categoryNews: { ka: 'სიახლე', en: 'News', ru: 'Новости' },
  categoryAnnouncement: { ka: 'განცხადება', en: 'Announcements', ru: 'Объявления' },
  categoryPublication: { ka: 'პუბლიკაცია', en: 'Publications', ru: 'Публикации' },
  moreNews: { ka: 'სხვა სიახლეები', en: 'More news', ru: 'Другие новости' },
  prevPage: { ka: 'წინა', en: 'Previous', ru: 'Назад' },
  nextPage: { ka: 'შემდეგი', en: 'Next', ru: 'Далее' },
  // Procurement
  tenders: { ka: 'ტენდერები', en: 'Tenders', ru: 'Тендеры' },
  auctions: { ka: 'აუქციონები', en: 'Auctions', ru: 'Аукционы' },
  statusOpen: { ka: 'მიმდინარე', en: 'Open', ru: 'Открытые' },
  statusClosed: { ka: 'დასრულებული', en: 'Closed', ru: 'Завершённые' },
  deadline: { ka: 'ბოლო ვადა', en: 'Deadline', ru: 'Срок подачи' },
  deadlinePassed: { ka: 'ვადა გასულია', en: 'Deadline passed', ru: 'Срок истёк' },
  daysLeft: { ka: 'დღე დარჩა', en: 'days left', ru: 'дн. осталось' },
  published: { ka: 'გამოქვეყნდა', en: 'Published', ru: 'Опубликовано' },
  documentsAttached: {
    ka: 'თანდართული დოკუმენტები',
    en: 'Attached documents',
    ru: 'Прилагаемые документы'
  },
  amendment: { ka: 'ცვლილება', en: 'Amendment', ru: 'Изменение' },
  previousDeadline: { ka: 'ძველი ვადა', en: 'Previous deadline', ru: 'Прежний срок' },
  procStatusPublished: { ka: 'მიმდინარე', en: 'Open', ru: 'Открыт' },
  procStatusClosed: { ka: 'დახურული', en: 'Closed', ru: 'Закрыт' },
  procStatusAmended: { ka: 'შეცვლილი', en: 'Amended', ru: 'Изменён' },
  procStatusCanceled: { ka: 'გაუქმებული', en: 'Canceled', ru: 'Отменён' },
  procStatusAwarded: {
    ka: 'გამარჯვებული გამოვლენილია',
    en: 'Awarded',
    ru: 'Завершён (победитель определён)'
  },
  procStatusArchived: { ka: 'არქივი', en: 'Archived', ru: 'Архив' },
  georgianControlling: {
    ka: 'იურიდიული ძალა აქვს მხოლოდ ქართულ ვერსიას.',
    en: 'The Georgian version of this notice is the legally controlling one.',
    ru: 'Юридическую силу имеет только грузинская версия документа.'
  },
  // Media
  photos: { ka: 'ფოტო', en: 'Photos', ru: 'Фото' },
  videos: { ka: 'ვიდეო', en: 'Videos', ru: 'Видео' },
  photosCount: { ka: 'ფოტო', en: 'photos', ru: 'фото' },
  playVideo: { ka: 'დაკვრა', en: 'Play video', ru: 'Смотреть видео' },
  // About
  aboutTitle: { ka: 'ჩვენ შესახებ', en: 'About us', ru: 'О нас' },
  // Contact
  contactTitle: { ka: 'კონტაქტი', en: 'Contact', ru: 'Контакты' },
  writeToUs: { ka: 'მოგვწერეთ', en: 'Write to us', ru: 'Напишите нам' },
  formName: { ka: 'სახელი', en: 'Name', ru: 'Имя' },
  formEmail: { ka: 'ელ.ფოსტა', en: 'Email', ru: 'Эл. почта' },
  formSubject: { ka: 'თემა', en: 'Subject', ru: 'Тема' },
  formMessage: { ka: 'შეტყობინება', en: 'Message', ru: 'Сообщение' },
  formSend: { ka: 'გაგზავნა', en: 'Send', ru: 'Отправить' },
  formSuccess: {
    ka: 'შეტყობინება გაიგზავნა. მადლობა!',
    en: 'Your message has been sent. Thank you!',
    ru: 'Ваше сообщение отправлено. Спасибо!'
  },
  formError: {
    ka: 'შეტყობინების გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.',
    en: 'Could not send the message. Please try again.',
    ru: 'Не удалось отправить сообщение. Попробуйте ещё раз.'
  },
  address: { ka: 'მისამართი', en: 'Address', ru: 'Адрес' },
  phone: { ka: 'ტელეფონი', en: 'Phone', ru: 'Телефон' },
  openInMaps: { ka: 'რუკაზე ნახვა', en: 'Open in Google Maps', ru: 'Открыть на карте' },
  // i18n honesty
  fallbackNotice: {
    ka: 'ეს გვერდი ხელმისაწვდომია მხოლოდ ქართულ ენაზე.',
    en: 'This content is currently available in Georgian only.',
    ru: 'Этот материал пока доступен только на грузинском языке.'
  },
  machineTranslated: {
    ka: 'ავტომატური თარგმანი',
    en: 'Automatic translation',
    ru: 'Автоматический перевод'
  },
  // Misc
  readMore: { ka: 'ვრცლად', en: 'Read more', ru: 'Подробнее' },
  download: { ka: 'ჩამოტვირთვა', en: 'Download', ru: 'Скачать' },
  notFoundTitle: { ka: 'გვერდი ვერ მოიძებნა', en: 'Page not found', ru: 'Страница не найдена' },
  notFoundBody: {
    ka: 'მოთხოვნილი გვერდი არ არსებობს ან წაშლილია.',
    en: 'The page you requested does not exist or has been removed.',
    ru: 'Запрошенная страница не существует или была удалена.'
  },
  backHome: { ka: 'მთავარ გვერდზე დაბრუნება', en: 'Back to home', ru: 'На главную' },
  footerRights: {
    ka: 'ყველა უფლება დაცულია',
    en: 'All rights reserved',
    ru: 'Все права защищены'
  },
  skipToContent: { ka: 'შინაარსზე გადასვლა', en: 'Skip to content', ru: 'Перейти к содержанию' },
  menu: { ka: 'მენიუ', en: 'Menu', ru: 'Меню' },
  subsidiaries: { ka: 'შვილობილი კომპანიები', en: 'Subsidiaries', ru: 'Дочерние компании' },
  operatingSince: { ka: 'მუშაობს', en: 'Operating since', ru: 'Работает с' },
  emptyList: { ka: 'ჩანაწერები არ მოიძებნა', en: 'Nothing here yet', ru: 'Записей пока нет' }
} satisfies Dict;

export type StringKey = keyof typeof dict;

export function t(locale: Locale, key: StringKey): string {
  return dict[key][locale];
}

/** Returns a bound translator for templates: s('navHome') */
export function translator(locale: Locale) {
  return (key: StringKey) => t(locale, key);
}

const DATE_LOCALE: Record<Locale, string> = { ka: 'ka-GE', en: 'en-GB', ru: 'ru-RU' };

export function formatDate(locale: Locale, iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Tbilisi'
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(locale: Locale, iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tbilisi'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Days until a UTC deadline, in Tbilisi terms (>=1 means still open today). */
export function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '' : clean}`;
}
