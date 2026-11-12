import { asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activities,
  contributions,
  events,
  layers,
  media,
  people,
  placePeople,
  places,
  placeStories,
  routes,
  routeStops,
  stories,
  users,
} from './schema.ts';

// User registration / upsert helper (Step 4.5 of cloudsql-setup)
export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        role: 'admin',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database operation failed. Please try again later.', { cause: error });
  }
}

// Seed initial clearly-labeled Demo Layers & Demo Locations ONLY if the database is completely empty
export async function ensureInitialDemoDataSeeded() {
  try {
    const existingLayers = await db.select().from(layers);
    if (existingLayers.length > 0) {
      return;
    }

    // Create initial thematic layers (dynamic, editable, and removable by administrators)
    const insertedLayers = await db
      .insert(layers)
      .values([
        {
          slug: 'heritage-architecture',
          nameFa: 'میراث و معماری',
          nameEn: 'Heritage & Architecture',
          descriptionFa: 'بافت تاریخی، ابنیه سنتی، آسیاب‌ها و سازه‌های آبی برزک (لایه نمونه قابل ویرایش در پنل مدیریت)',
          descriptionEn: 'Historic fabric, traditional structures, watermills, and hydraulic heritage of Barzok.',
          icon: 'landmark',
          color: '#254B36',
          isVisible: true,
          isActive: true,
          displayOrder: 1,
          isDemo: true,
        },
        {
          slug: 'people-occupations',
          nameFa: 'مردم و مشاغل',
          nameEn: 'People & Occupations',
          descriptionFa: 'کارگاه‌های سنتی، نساجی، گلاب‌گیری و پیشه‌های بومی برزک (لایه نمونه قابل ویرایش در پنل مدیریت)',
          descriptionEn: 'Traditional workshops, weaving, rosewater distillation, and local livelihoods.',
          icon: 'users',
          color: '#806B50',
          isVisible: true,
          isActive: true,
          displayOrder: 2,
          isDemo: true,
        },
        {
          slug: 'culture-rituals',
          nameFa: 'فرهنگ و آیین‌ها',
          nameEn: 'Culture & Rituals',
          descriptionFa: 'آیین‌های فصلی، سنت‌های شفاهی و رویدادهای فرهنگی برزک (لایه نمونه قابل ویرایش در پنل مدیریت)',
          descriptionEn: 'Seasonal ceremonies, oral traditions, and cultural gatherings in Barzok.',
          icon: 'sparkles',
          color: '#D6A83F',
          isVisible: true,
          isActive: true,
          displayOrder: 3,
          isDemo: true,
        },
        {
          slug: 'nature-environment',
          nameFa: 'طبیعت و محیط‌زیست',
          nameEn: 'Nature & Environment',
          descriptionFa: 'باغستان‌های گردو، گلستان‌های محمدی، چشمه‌ها و مسیرهای کوهستانی برزک (لایه نمونه قابل ویرایش)',
          descriptionEn: 'Walnut orchards, Damask rose gardens, springs, and mountain trails of Barzok.',
          icon: 'trees',
          color: '#71866A',
          isVisible: true,
          isActive: true,
          displayOrder: 4,
          isDemo: true,
        },
        {
          slug: 'memories-documents',
          nameFa: 'خاطرات و اسناد',
          nameEn: 'Memories & Documents',
          descriptionFa: 'تاریخ شفاهی، عکس‌های قدیمی و اسناد محلی ثبت‌شده توسط اهالی و پژوهشگران',
          descriptionEn: 'Oral histories, archival photographs, and community-contributed documents.',
          icon: 'book-open',
          color: '#5C4B3B',
          isVisible: true,
          isActive: true,
          displayOrder: 5,
          isDemo: true,
        },
        {
          slug: 'story-routes',
          nameFa: 'مسیرهای داستانی',
          nameEn: 'Story Routes',
          descriptionFa: 'مسیرهای پیاده‌روی روایت‌محور در کوچه‌باغ‌ها و محله‌های برزک',
          descriptionEn: 'Narrative walking routes through garden alleys and historic neighborhoods of Barzok.',
          icon: 'route',
          color: '#9A3412',
          isVisible: true,
          isActive: true,
          displayOrder: 6,
          isDemo: true,
        },
      ])
      .returning();

    const layerMap: Record<string, string> = {};
    for (const l of insertedLayers) {
      layerMap[l.slug] = l.id;
    }

    // Insert clearly-labeled Demo Places using real Barzok coordinates (33.7925, 51.2292 area)
    const insertedPlaces = await db
      .insert(places)
      .values([
        {
          slug: 'barzok-historic-center-demo',
          layerId: layerMap['heritage-architecture'],
          additionalLayerIds: JSON.stringify([layerMap['memories-documents']]),
          nameFa: 'بافت پلکانی و هسته تاریخی برزک (رکورد نمونه آزمایشی)',
          nameEn: 'Barzok Historic Stepped Fabric (Demo Sample Record)',
          category: 'میراث و معماری',
          shortIntroFa: '[داده نمونه آزمایشی جهت نمایش رابط کاربری] نمایی از معماری پلکانی و خشتی-سنگی برزک در دامنه کوهستان کرکس.',
          shortIntroEn: '[Demo Sample Record for UI Demonstration] Stepped adobe and stone hillside architecture in Barzok.',
          fullDescriptionFa:
            'این رکورد به صورت آزمایشی (Demo) برای نمایش امکانات سامانه «مردمنگار برزک» ایجاد شده است و نباید به عنوان سند تاریخی قطعی تلقی شود. شهر تاریخی برزک در شهرستان کاشان و در دامنه کوهستان واقع شده و معماری آن هماهنگ با شیب زمین و باغستان‌های پیرامون شکل گرفته است. مدیران سامانه می‌توانند از بخش مدیریت (/admin) این مکان را ویرایش یا حذف کرده و اطلاعات مستند میدانی را جایگزین نمایند.',
          fullDescriptionEn:
            'This record is a clearly labeled demonstration sample created to showcase the Barzok People Map interface and is not presented as verified historical documentation. Administrators can edit or replace this record in the /admin dashboard.',
          latitude: 33.7925,
          longitude: 51.2292,
          historicalInfoFa: 'رکورد نمایشی: جایگاه درج پیشینه معماری، قدمت محله و تحولات کالبدی بر اساس اسناد و پژوهش‌های میدانی.',
          historicalInfoEn: 'Demo placeholder for verified architectural history and archival field notes.',
          currentStatusFa: 'نمونه نمایشی فعال در نقشه — آماده جایگزینی با داده‌های مستند پژوهشی',
          currentStatusEn: 'Active demo entry — ready for verified field data replacement',
          historicalPhotos: JSON.stringify([
            {
              url: '/src/assets/images/barzok_historic_architecture_1794421049133.jpg',
              captionFa: 'تصویر نمایشی از بافت پلکانی کوهستانی و باغستان‌های پیرامون (نمونه آزمایشی)',
              captionEn: 'Illustrative view of stepped hillside architecture and orchards (Demo Sample)',
              year: 'نمونه آرشیوی',
            },
          ]),
          recentPhotos: JSON.stringify([
            {
              url: '/src/assets/images/barzok_historic_architecture_1794421049133.jpg',
              captionFa: 'چشم‌انداز معاصر بافت و کوهستان (تصویر نمونه)',
              captionEn: 'Contemporary hillside perspective (Demo Sample)',
              year: '۱۴۰۵',
            },
          ]),
          audioRecordings: JSON.stringify([]),
          videoLinks: JSON.stringify([]),
          sourceReference: 'داده آزمایشی سیستم (Demo Mode) — نیازمند جایگزینی با منابع مستند محلی',
          documentationDate: '۱۴۰۵/۰۸/۲۰',
          contributorName: 'تیم فنی مردمنگار برزک (نمونه آزمایشی)',
          contributorApproved: true,
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
        {
          slug: 'barzok-rosewater-workshop-demo',
          layerId: layerMap['people-occupations'],
          additionalLayerIds: JSON.stringify([layerMap['culture-rituals']]),
          nameFa: 'کارگاه سنتی گلاب‌گیری و عرقیات گیاهی (رکورد نمونه آزمایشی)',
          nameEn: 'Traditional Rosewater Distillation Workshop (Demo Sample Record)',
          category: 'مردم و مشاغل',
          shortIntroFa: '[داده نمونه آزمایشی] نمایش نحوه ثبت کارگاه‌های گلاب‌گیری سنتی، ابزارهای مسی و دانش بومی در فصل گل‌چینی.',
          shortIntroEn: '[Demo Sample Record] Illustrating how traditional rosewater workshops and seasonal craft knowledge are documented.',
          fullDescriptionFa:
            'این رکورد یک نمونه آزمایشی (Demo) است. در فصل بهار و اردیبهشت‌ماه، گلستان‌های گل محمدی در برزک و پیرامون آن برداشت شده و در کارگاه‌های سنتی با دیگ‌های مسی تقطیر می‌شوند. در نسخه عملیاتی، نام دقیق کارگاه، روایت استادکاران محلی و فایل‌های صوتی مصاحبه‌های مردم‌نگاری در این بخش ثبت می‌شود.',
          fullDescriptionEn:
            'This is a clearly labeled demonstration record showing how local occupations, seasonal rose harvesting, and copper-still distillation traditions are cataloged on the map.',
          latitude: 33.7941,
          longitude: 51.2318,
          historicalInfoFa: 'رکورد نمایشی: محل درج پیشینه کشت گل محمدی و تحول ابزارهای تقطیر سنتی در برزک.',
          historicalInfoEn: 'Demo placeholder for historical notes on Damask rose cultivation and distillation.',
          currentStatusFa: 'رکورد نمونه آزمایشی (Demo)',
          currentStatusEn: 'Demo Sample Record',
          historicalPhotos: JSON.stringify([]),
          recentPhotos: JSON.stringify([
            {
              url: '/src/assets/images/barzok_rosewater_tradition_1794421051440.jpg',
              captionFa: 'دیگ‌های مسی سنتی و گل‌های محمدی (تصویر نمونه آزمایشی)',
              captionEn: 'Traditional copper stills and Damask roses (Demo Sample)',
              year: '۱۴۰۵',
            },
          ]),
          audioRecordings: JSON.stringify([]),
          videoLinks: JSON.stringify([]),
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          documentationDate: '۱۴۰۵/۰۸/۲۰',
          contributorName: 'نگارش آزمایشی سامانه',
          contributorApproved: true,
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
        {
          slug: 'barzok-weaving-craft-demo',
          layerId: layerMap['people-occupations'],
          additionalLayerIds: JSON.stringify([layerMap['heritage-architecture']]),
          nameFa: 'کارگاه نساجی سنتی و جاجیم‌بافی (رکورد نمونه آزمایشی)',
          nameEn: 'Traditional Handloom & Textile Workshop (Demo Sample Record)',
          category: 'مردم و مشاغل',
          shortIntroFa: '[داده نمونه آزمایشی] الگوی ثبت هنرهای دستی، دارهای چوبی نساجی و روایت بافندگان محلی برزک.',
          shortIntroEn: '[Demo Sample Record] Template for documenting handloom weaving, textile crafts, and local artisans.',
          fullDescriptionFa:
            'این مکان یک نمونه آزمایشی (Demo) جهت نمایش ساختار چندرسانه‌ای و ارتباط مکان با «افراد» و «داستان‌ها» در سامانه مردمنگار برزک است. صنایع دستی و بافته‌های سنتی بخشی مهم از حافظه زیسته و اقتصاد خانگی منطقه کاشان و برزک را تشکیل می‌دهند.',
          fullDescriptionEn:
            'A demonstration record illustrating how traditional textile workshops connect to oral history stories and artisan profiles in the database.',
          latitude: 33.7912,
          longitude: 51.2271,
          historicalInfoFa: 'رکورد نمایشی: محل درج تاریخچه نساجی خانگی، رنگرزی گیاهی و نقش‌مایه‌های بومی.',
          historicalInfoEn: 'Demo placeholder for history of domestic handloom weaving and natural dyeing.',
          currentStatusFa: 'رکورد نمونه آزمایشی (Demo)',
          currentStatusEn: 'Demo Sample Record',
          historicalPhotos: JSON.stringify([
            {
              url: '/src/assets/images/barzok_textile_weaving_1794421051123.jpg',
              captionFa: 'دار چوبی سنتی نساجی و نخ‌های رنگرزی‌شده (تصویر نمونه آزمایشی)',
              captionEn: 'Traditional wooden handloom and dyed threads (Demo Sample)',
              year: 'نمونه',
            },
          ]),
          recentPhotos: JSON.stringify([]),
          audioRecordings: JSON.stringify([]),
          videoLinks: JSON.stringify([]),
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          documentationDate: '۱۴۰۵/۰۸/۲۰',
          contributorName: 'نگارش آزمایشی سامانه',
          contributorApproved: true,
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
        {
          slug: 'barzok-walnut-orchards-path-demo',
          layerId: layerMap['nature-environment'],
          additionalLayerIds: JSON.stringify([layerMap['story-routes']]),
          nameFa: 'کوچه‌باغ‌های گردو و جویبارهای سنتی (رکورد نمونه آزمایشی)',
          nameEn: 'Terraced Walnut Gardens & Water Channels (Demo Sample Record)',
          category: 'طبیعت و محیط‌زیست',
          shortIntroFa: '[داده نمونه آزمایشی] نمایش نحوه مستندسازی باغستان‌ها، درختان کهنسال، قنات‌ها و مسیرهای پیاده‌روی طبیعی برزک.',
          shortIntroEn: '[Demo Sample Record] Template for mapping terraced orchards, water channels, and walking trails.',
          fullDescriptionFa:
            'این رکورد به صورت آزمایشی (Demo) ثبت شده است. کوچه‌باغ‌ها و نظام تقسیم آب سنتی در برزک پیوند میان زیست‌بوم طبیعی کوهستان و زندگی روزمره ساکنان را نشان می‌دهند. در این بخش می‌توان مسیرهای پیاده‌روی گردشگری مسئولانه و نکات حفاظت از محیط‌زیست محلی را ثبت کرد.',
          fullDescriptionEn:
            'Demonstration record showing how natural heritage, terraced walnut gardens, and water distribution channels are mapped for visitors and researchers.',
          latitude: 33.7898,
          longitude: 51.2335,
          historicalInfoFa: 'رکورد نمایشی: محل درج پیشینه نظام آبیاری سنتی و باغداری کوهستانی.',
          historicalInfoEn: 'Demo placeholder for traditional irrigation systems and mountain orchard stewardship.',
          currentStatusFa: 'رکورد نمونه آزمایشی (Demo)',
          currentStatusEn: 'Demo Sample Record',
          historicalPhotos: JSON.stringify([]),
          recentPhotos: JSON.stringify([
            {
              url: '/src/assets/images/barzok_walnut_gardens_1794421053291.jpg',
              captionFa: 'جویبار و باغستان‌های پلکانی برزک (تصویر نمونه آزمایشی)',
              captionEn: 'Stream and terraced mountain orchards (Demo Sample)',
              year: '۱۴۰۵',
            },
          ]),
          audioRecordings: JSON.stringify([]),
          videoLinks: JSON.stringify([]),
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          documentationDate: '۱۴۰۵/۰۸/۲۰',
          contributorName: 'نگارش آزمایشی سامانه',
          contributorApproved: true,
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
      ])
      .returning();

    // Seed 2 clearly labeled Demo People (generic archetype templates, never inventing real people)
    const insertedPeople = await db
      .insert(people)
      .values([
        {
          nameFa: '[پرونده نمونه آزمایشی] استادکار نساجی و بافنده سنتی',
          nameEn: '[Demo Sample Profile] Traditional Master Weaver Archetype',
          occupationFa: 'نساجی سنتی، جاجیم‌بافی و رنگرزی طبیعی (نمونه نمایشی)',
          occupationEn: 'Traditional Handloom Weaving & Natural Dyeing (Demo Template)',
          bioFa: 'این پرونده یک نمونه آزمایشی (Demo) برای نمایش ساختار ثبت «مردم و مشاغل» است و به هیچ شخص حقیقی اشاره ندارد. مدیران سامانه می‌توانند از پنل مدیریت، زندگی‌نامه مستند استادکاران و پیشه‌وران واقعی برزک را با رضایت ایشان ثبت نمایند.',
          bioEn: 'This is a clearly labeled demonstration template showing how local artisans and occupations are documented in the database. It does not represent a fabricated historical person.',
          era: 'الگوی نمایشی معاصر',
          avatarUrl: '/src/assets/images/barzok_textile_weaving_1794421051123.jpg',
          sourceReference: 'الگوی آزمایشی سیستم (Demo Mode)',
          contributorName: 'سیستم مردمنگار برزک',
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
        {
          nameFa: '[پرونده نمونه آزمایشی] باغدار و گلاب‌گیر سنتی',
          nameEn: '[Demo Sample Profile] Traditional Orchardist & Rosewater Distiller Archetype',
          occupationFa: 'باغداری کوهستانی و تقطیر سنتی گل محمدی (نمونه نمایشی)',
          occupationEn: 'Mountain Orchard Stewardship & Rosewater Distillation (Demo Template)',
          bioFa: 'این پرونده یک نمونه آزمایشی (Demo) جهت نمایش پیوند میان مکان‌ها، مشاغل بومی و روایت‌های شفاهی در پایگاه داده است و نباید به عنوان اطلاعات تاریخی تلقی شود.',
          bioEn: 'Demonstration template showing how local agricultural and distillation knowledge holders are linked to places and stories.',
          era: 'الگوی نمایشی معاصر',
          avatarUrl: '/src/assets/images/barzok_rosewater_tradition_1794421051440.jpg',
          sourceReference: 'الگوی آزمایشی سیستم (Demo Mode)',
          contributorName: 'سیستم مردمنگار برزک',
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
      ])
      .returning();

    // Seed 2 clearly labeled Demo Stories
    const insertedStories = await db
      .insert(stories)
      .values([
        {
          slug: 'spring-rose-harvest-demo-story',
          titleFa: '[داستان نمونه آزمایشی] روایت بهار و آیین گل‌چینی در باغستان‌های برزک',
          titleEn: '[Demo Sample Story] Narrative Template: Spring Rose Harvest in Barzok',
          summaryFa: 'نمونه آزمایشی برای نمایش چگونگی ثبت تاریخ شفاهی، خاطرات اهالی و پیوند داستان‌ها با مکان‌های روی نقشه.',
          summaryEn: 'Demonstration sample showing how oral histories and seasonal memories are formatted and linked to map locations.',
          contentFa:
            'توجه: این متن یک نمونه آزمایشی (Demo) برای نمایش امکانات صفحه‌آرایی و ارتباط داده‌ها در سامانه «مردمنگار برزک» است.\n\nدر این بخش، روایت‌های شفاهی ضبط‌شده از اهالی برزک درباره آیین‌های فصلی، شیوه‌های سنتی آبیاری باغستان‌ها، همکاری خانواده‌ها در فصل گل‌چینی و خاطرات محله‌های قدیمی به همراه فایل صوتی راوی و تصاویر آرشیوی منتشر می‌شود. پژوهشگران و مدیران سامانه می‌توانند از طریق پنل مدیریت، داستان‌های مستند را ثبت و به یک یا چند مکان و شخص روی نقشه متصل کنند.',
          contentEn:
            'Note: This entry is a clearly labeled demonstration template illustrating the editorial layout for oral histories in Barzok People Map. Administrators can add verified interviews, audio recordings, and archival photographs via the Admin Dashboard.',
          narratorName: 'راوی نمونه (داده آزمایشی سیستم)',
          imageUrl: '/src/assets/images/barzok_rosewater_tradition_1794421051440.jpg',
          recordedDate: 'بهار ۱۴۰۵ (نمونه)',
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          contributorName: 'تیم مردمنگار برزک',
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
        {
          slug: 'mountain-alleys-memory-demo-story',
          titleFa: '[داستان نمونه آزمایشی] الگوی ثبت خاطرات کوچه‌باغ‌ها و معماری پلکانی',
          titleEn: '[Demo Sample Story] Narrative Template: Memories of Garden Alleys & Stepped Roofs',
          summaryFa: 'نمونه آزمایشی جهت نمایش ارتباط متقابل میان لایه «خاطرات و اسناد»، «میراث و معماری» و «مسیرهای داستانی».',
          summaryEn: 'Demonstration template illustrating cross-layer connections between architecture, oral memory, and walking routes.',
          contentFa:
            'توجه: این متن یک نمونه آزمایشی (Demo) است و حاوی ادعای تاریخی مستند نیست.\n\nدر ساختار پایگاه داده مردمنگار برزک، هر داستان یا خاطره می‌تواند به چندین مکان جغرافیایی و چندین فرد مرتبط متصل شود. بازدیدکنندگان هنگام کلیک بر روی هر مکان در نقشه، داستان‌های مرتبط با آن نقطه را مطالعه کرده و می‌توانند مکان‌های نزدیک را نیز کاوش نمایند.',
          contentEn:
            'Note: This is a demonstration record. In Barzok People Map, each oral history story can be linked to multiple geographic locations and local people profiles.',
          narratorName: 'راوی نمونه (داده آزمایشی سیستم)',
          imageUrl: '/src/assets/images/barzok_historic_architecture_1794421049133.jpg',
          recordedDate: '۱۴۰۵ (نمونه)',
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          contributorName: 'تیم مردمنگار برزک',
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
      ])
      .returning();

    // Link Demo Places <-> Demo People & Demo Stories
    if (insertedPlaces.length >= 3 && insertedPeople.length >= 2 && insertedStories.length >= 2) {
      await db.insert(placePeople).values([
        {
          placeId: insertedPlaces[2].id,
          personId: insertedPeople[0].id,
          relationshipRoleFa: 'الگوی استادکار مرتبط با کارگاه (نمونه آزمایشی)',
        },
        {
          placeId: insertedPlaces[1].id,
          personId: insertedPeople[1].id,
          relationshipRoleFa: 'الگوی گلاب‌گیر سنتی مرتبط با کارگاه (نمونه آزمایشی)',
        },
      ]);

      await db.insert(placeStories).values([
        {
          placeId: insertedPlaces[0].id,
          storyId: insertedStories[1].id,
        },
        {
          placeId: insertedPlaces[1].id,
          storyId: insertedStories[0].id,
        },
        {
          placeId: insertedPlaces[3].id,
          storyId: insertedStories[1].id,
        },
      ]);

      // Seed 1 Demo Event
      await db.insert(events).values([
        {
          placeId: insertedPlaces[1].id,
          titleFa: '[رویداد نمونه آزمایشی] فصل گل‌چینی و گلاب‌گیری بهاره برزک',
          titleEn: '[Demo Event] Spring Rose Harvest & Distillation Season',
          descriptionFa: 'رکورد آزمایشی جهت نمایش رویدادهای فصلی و آیین‌های مرتبط با مکان‌ها در پنل جزئیات مکان.',
          descriptionEn: 'Demonstration record showing seasonal cultural events linked to map locations.',
          seasonOrDateFa: 'اردیبهشت و خرداد (نمونه آزمایشی)',
          seasonOrDateEn: 'May - June (Demo Sample)',
          eventType: 'seasonal_tradition',
          sourceReference: 'داده آزمایشی سیستم (Demo Mode)',
          publicationStatus: 'published',
          verificationStatus: 'demo',
          isDemo: true,
        },
      ]);

      // Seed 1 Demo Walking Route with stops
      const [demoRoute] = await db
        .insert(routes)
        .values([
          {
            slug: 'barzok-garden-to-historic-core-demo',
            titleFa: '[مسیر نمونه آزمایشی] گذر از کوچه‌باغ‌ها به بافت تاریخی برزک',
            titleEn: '[Demo Route] From Terraced Orchards to Historic Core',
            descriptionFa: 'مسیر پیاده‌روی آزمایشی برای نمایش قابلیت «مسیرهای داستانی» و توقفگاه‌های ترتیبی روی نقشه برزک.',
            descriptionEn: 'Demonstration walking route showcasing sequential storytelling stops across Barzok.',
            durationMinutes: 75,
            distanceKm: 1.8,
            difficulty: 'easy',
            color: '#D6A83F',
            publicationStatus: 'published',
            verificationStatus: 'demo',
            isDemo: true,
          },
        ])
        .returning();

      if (demoRoute) {
        await db.insert(routeStops).values([
          {
            routeId: demoRoute.id,
            placeId: insertedPlaces[3].id,
            stopOrder: 1,
            noteFa: 'ایستگاه اول (نمونه): آغاز مسیر از جویبار و کوچه‌باغ‌های گردو',
            noteEn: 'Stop 1 (Demo): Starting at the terraced walnut orchards stream',
          },
          {
            routeId: demoRoute.id,
            placeId: insertedPlaces[1].id,
            stopOrder: 2,
            noteFa: 'ایستگاه دوم (نمونه): بازدید از کارگاه سنتی گلاب‌گیری',
            noteEn: 'Stop 2 (Demo): Visiting the traditional rosewater workshop',
          },
          {
            routeId: demoRoute.id,
            placeId: insertedPlaces[2].id,
            stopOrder: 3,
            noteFa: 'ایستگاه سوم (نمونه): کارگاه نساجی و صنایع دستی',
            noteEn: 'Stop 3 (Demo): Traditional handloom weaving workshop',
          },
          {
            routeId: demoRoute.id,
            placeId: insertedPlaces[0].id,
            stopOrder: 4,
            noteFa: 'ایستگاه چهارم (نمونه): بافت پلکانی و چشم‌انداز هسته تاریخی برزک',
            noteEn: 'Stop 4 (Demo): Historic stepped hillside architecture overlook',
          },
        ]);
      }
    }

    // Seed 1 sample pending community contribution so admins can test moderation queue
    await db.insert(contributions).values([
      {
        submissionType: 'personal_memory',
        title: '[مشارکت نمونه آزمایشی] خاطره جمع‌آوری گردو در پاییز برزک',
        description:
          'این یک مشارکت نمونه در صف بررسی (Pending Review) است تا مدیر سامانه بتواند فرآیند تایید، رد یا درخواست اطلاعات بیشتر را در بخش «مدیریت مشارکت‌های مردمی» آزمایش کند.',
        latitude: 33.7905,
        longitude: 51.231,
        contributorName: 'شركت‌كننده آزمایشی (Demo Contributor)',
        contactInfo: 'demo-private-contact@example.com',
        consentToPublish: true,
        moderationStatus: 'pending_review',
        adminNotes: 'رکورد آزمایشی اولیه جهت تست صف بررسی مدیریت',
      },
    ]);
  } catch (error) {
    console.error('Database query failed in ensureInitialDemoDataSeeded:', error);
    throw new Error('Failed to initialize database records.', { cause: error });
  }
}

// Automatically sync approved community contributions into places (and stories/people)
export async function syncApprovedContributionsToPlaces() {
  try {
    const allContribs = await db.select().from(contributions);
    if (allContribs.length === 0) return;

    const allLayers = await db.select().from(layers).orderBy(asc(layers.displayOrder));
    const existingPlaces = await db.select().from(places);
    const existingStories = await db.select().from(stories);

    const layerBySlug: Record<string, string> = {};
    for (const l of allLayers) {
      layerBySlug[l.slug] = l.id;
    }
    const defaultLayerId = allLayers[0]?.id || null;

    const placeBySlug: Record<string, (typeof existingPlaces)[number]> = {};
    for (const p of existingPlaces) {
      placeBySlug[p.slug] = p;
    }

    const storyBySlug: Record<string, (typeof existingStories)[number]> = {};
    for (const s of existingStories) {
      storyBySlug[s.slug] = s;
    }

    for (const c of allContribs) {
      const placeSlug = `contrib-place-${c.id}`;
      const existingPlace = placeBySlug[placeSlug];

      if (c.moderationStatus === 'approved') {
        let targetLayerId = defaultLayerId;
        let targetCategory = 'میراث و معماری';

        if (c.submissionType === 'historical_location') {
          targetLayerId = layerBySlug['heritage-architecture'] || defaultLayerId;
          targetCategory = 'میراث و معماری';
        } else if (c.submissionType === 'old_photograph' || c.submissionType === 'personal_memory') {
          targetLayerId = layerBySlug['memories-documents'] || defaultLayerId;
          targetCategory = 'خاطرات و اسناد';
        } else if (c.submissionType === 'local_person') {
          targetLayerId = layerBySlug['people-occupations'] || defaultLayerId;
          targetCategory = 'مردم و مشاغل';
        } else if (c.submissionType === 'traditional_custom') {
          targetLayerId = layerBySlug['culture-rituals'] || defaultLayerId;
          targetCategory = 'فرهنگ و آیین‌ها';
        } else if (c.submissionType === 'environmental_cultural') {
          targetLayerId = layerBySlug['nature-environment'] || defaultLayerId;
          targetCategory = 'طبیعت و محیط‌زیست';
        }

        let ensuredPlaceId = existingPlace?.id;

        if (!existingPlace) {
          const [insertedPlace] = await db
            .insert(places)
            .values({
              slug: placeSlug,
              layerId: targetLayerId,
              additionalLayerIds: JSON.stringify([]),
              nameFa: c.title,
              nameEn: null,
              category: targetCategory,
              shortIntroFa: c.description,
              shortIntroEn: null,
              fullDescriptionFa: c.description,
              fullDescriptionEn: null,
              latitude: c.latitude ?? 33.7925,
              longitude: c.longitude ?? 51.2292,
              historicalInfoFa: null,
              historicalInfoEn: null,
              currentStatusFa: 'ثبت‌شده از طریق مشارکت مردمی',
              currentStatusEn: 'Community Contributed Record',
              historicalPhotos: JSON.stringify([]),
              recentPhotos: c.mediaUrl
                ? JSON.stringify([
                    {
                      url: c.mediaUrl,
                      captionFa: c.title,
                      year: 'مشارکت مردمی',
                    },
                  ])
                : JSON.stringify([]),
              audioRecordings: JSON.stringify([]),
              videoLinks: JSON.stringify([]),
              sourceReference: `مشارکت مردمی (${c.contributorName})`,
              documentationDate: '۱۴۰۵',
              contributorName: c.contributorName,
              contributorApproved: true,
              publicationStatus: 'published',
              verificationStatus: 'community',
              isDemo: false,
            })
            .returning();
          ensuredPlaceId = insertedPlace?.id;
        } else if (existingPlace.publicationStatus !== 'published') {
          await db
            .update(places)
            .set({ publicationStatus: 'published', updatedAt: new Date() })
            .where(eq(places.id, existingPlace.id));
        }

        // If submissionType is personal_memory, also ensure a Story record exists and is linked
        if (c.submissionType === 'personal_memory' && ensuredPlaceId) {
          const storySlug = `contrib-story-${c.id}`;
          if (!storyBySlug[storySlug]) {
            const [insertedStory] = await db
              .insert(stories)
              .values({
                slug: storySlug,
                titleFa: c.title,
                titleEn: null,
                summaryFa: c.description.slice(0, 180),
                summaryEn: null,
                contentFa: c.description,
                contentEn: null,
                narratorName: c.contributorName,
                imageUrl: c.mediaUrl || null,
                sourceReference: `مشارکت مردمی (${c.contributorName})`,
                contributorName: c.contributorName,
                publicationStatus: 'published',
                verificationStatus: 'community',
                isDemo: false,
              })
              .returning();
            if (insertedStory) {
              await db.insert(placeStories).values({
                placeId: ensuredPlaceId,
                storyId: insertedStory.id,
              });
            }
          }
        }
      } else if (existingPlace && existingPlace.publicationStatus === 'published') {
        // If contribution was unapproved or rejected, hide the corresponding place from public view
        await db
          .update(places)
          .set({ publicationStatus: 'draft', updatedAt: new Date() })
          .where(eq(places.id, existingPlace.id));
      }
    }
  } catch (error) {
    console.error('Error in syncApprovedContributionsToPlaces:', error);
  }
}

// Fetch public map bundle (only active layers & published places/stories/people/routes)
export async function getPublicMapBundle() {
  try {
    await ensureInitialDemoDataSeeded();
    await syncApprovedContributionsToPlaces();

    const allLayers = await db
      .select()
      .from(layers)
      .where(eq(layers.isActive, true))
      .orderBy(asc(layers.displayOrder));

    const publishedPlaces = await db
      .select()
      .from(places)
      .where(eq(places.publicationStatus, 'published'))
      .orderBy(desc(places.createdAt));

    const publishedPeople = await db
      .select()
      .from(people)
      .where(eq(people.publicationStatus, 'published'))
      .orderBy(desc(people.createdAt));

    const publishedStories = await db
      .select()
      .from(stories)
      .where(eq(stories.publicationStatus, 'published'))
      .orderBy(desc(stories.createdAt));

    const publishedEvents = await db
      .select()
      .from(events)
      .where(eq(events.publicationStatus, 'published'))
      .orderBy(desc(events.createdAt));

    const publishedRoutes = await db
      .select()
      .from(routes)
      .where(eq(routes.publicationStatus, 'published'))
      .orderBy(asc(routes.createdAt));

    const allRouteStops = await db
      .select()
      .from(routeStops)
      .orderBy(asc(routeStops.stopOrder));

    const allPlacePeople = await db.select().from(placePeople);
    const allPlaceStories = await db.select().from(placeStories);

    return {
      layers: allLayers,
      places: publishedPlaces,
      people: publishedPeople,
      stories: publishedStories,
      events: publishedEvents,
      routes: publishedRoutes.map((r) => ({
        ...r,
        stops: allRouteStops.filter((s) => s.routeId === r.id),
      })),
      placePeople: allPlacePeople,
      placeStories: allPlaceStories,
    };
  } catch (error) {
    console.error('Database query failed in getPublicMapBundle:', error);
    throw new Error('Unable to load map data from database.', { cause: error });
  }
}

// Fetch full admin bundle (all records regardless of status + moderation queue)
export async function getAdminBundle() {
  try {
    await ensureInitialDemoDataSeeded();
    await syncApprovedContributionsToPlaces();

    const allLayers = await db.select().from(layers).orderBy(asc(layers.displayOrder));
    const allPlaces = await db.select().from(places).orderBy(desc(places.createdAt));
    const allPeople = await db.select().from(people).orderBy(desc(people.createdAt));
    const allStories = await db.select().from(stories).orderBy(desc(stories.createdAt));
    const allMedia = await db.select().from(media).orderBy(desc(media.createdAt));
    const allEvents = await db.select().from(events).orderBy(desc(events.createdAt));
    const allActivities = await db.select().from(activities).orderBy(desc(activities.createdAt));
    const allRoutes = await db.select().from(routes).orderBy(desc(routes.createdAt));
    const allRouteStops = await db.select().from(routeStops).orderBy(asc(routeStops.stopOrder));
    const allContributions = await db
      .select()
      .from(contributions)
      .orderBy(desc(contributions.createdAt));
    const allPlacePeople = await db.select().from(placePeople);
    const allPlaceStories = await db.select().from(placeStories);

    return {
      layers: allLayers,
      places: allPlaces,
      people: allPeople,
      stories: allStories,
      media: allMedia,
      events: allEvents,
      activities: allActivities,
      routes: allRoutes.map((r) => ({
        ...r,
        stops: allRouteStops.filter((s) => s.routeId === r.id),
      })),
      contributions: allContributions,
      placePeople: allPlacePeople,
      placeStories: allPlaceStories,
    };
  } catch (error) {
    console.error('Database query failed in getAdminBundle:', error);
    throw new Error('Unable to load administration data from database.', { cause: error });
  }
}

// Public Contribution Submission
export async function createPublicContribution(payload: {
  submissionType: string;
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  mediaUrl?: string | null;
  contributorName: string;
  contactInfo: string;
  consentToPublish: boolean;
}) {
  try {
    const [created] = await db
      .insert(contributions)
      .values({
        submissionType: payload.submissionType,
        title: payload.title,
        description: payload.description,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        mediaUrl: payload.mediaUrl ?? null,
        contributorName: payload.contributorName,
        contactInfo: payload.contactInfo,
        consentToPublish: payload.consentToPublish,
        moderationStatus: 'pending_review',
      })
      .returning({
        id: contributions.id,
        submissionType: contributions.submissionType,
        title: contributions.title,
        moderationStatus: contributions.moderationStatus,
        createdAt: contributions.createdAt,
      });

    return created;
  } catch (error) {
    console.error('Database query failed in createPublicContribution:', error);
    throw new Error('Unable to submit contribution at this time.', { cause: error });
  }
}

// Layer CRUD
export async function createLayerRecord(data: typeof layers.$inferInsert) {
  try {
    const [created] = await db.insert(layers).values(data).returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createLayerRecord:', error);
    throw new Error('Failed to create layer.', { cause: error });
  }
}

export async function updateLayerRecord(id: string, data: Partial<typeof layers.$inferInsert>) {
  try {
    const [updated] = await db
      .update(layers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(layers.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateLayerRecord:', error);
    throw new Error('Failed to update layer.', { cause: error });
  }
}

export async function deleteLayerRecord(id: string) {
  try {
    await db.delete(layers).where(eq(layers.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deleteLayerRecord:', error);
    throw new Error('Failed to delete layer.', { cause: error });
  }
}

// Place CRUD + Relations
export async function createPlaceRecord(
  data: typeof places.$inferInsert,
  personIds: string[] = [],
  storyIds: string[] = []
) {
  try {
    let validLayerId: string | null = data.layerId || null;
    if (validLayerId) {
      const allLayers = await db.select({ id: layers.id }).from(layers);
      const exists = allLayers.some((l) => l.id === validLayerId);
      if (!exists) {
        validLayerId = allLayers[0]?.id || null;
      }
    } else {
      const allLayers = await db.select({ id: layers.id }).from(layers);
      validLayerId = allLayers[0]?.id || null;
    }

    const [created] = await db
      .insert(places)
      .values({
        ...data,
        layerId: validLayerId,
      })
      .returning();

    if (created && personIds.length > 0) {
      const validPeople = await db.select({ id: people.id }).from(people);
      const validPersonSet = new Set(validPeople.map((p) => p.id));
      const filteredPersonIds = personIds.filter((id) => validPersonSet.has(id));
      if (filteredPersonIds.length > 0) {
        await db.insert(placePeople).values(
          filteredPersonIds.map((personId) => ({
            placeId: created.id,
            personId,
          }))
        );
      }
    }
    if (created && storyIds.length > 0) {
      const validStories = await db.select({ id: stories.id }).from(stories);
      const validStorySet = new Set(validStories.map((s) => s.id));
      const filteredStoryIds = storyIds.filter((id) => validStorySet.has(id));
      if (filteredStoryIds.length > 0) {
        await db.insert(placeStories).values(
          filteredStoryIds.map((storyId) => ({
            placeId: created.id,
            storyId,
          }))
        );
      }
    }
    return created;
  } catch (error) {
    console.error('Database query failed in createPlaceRecord:', error);
    throw new Error('خطا در ذخیره مکان در پایگاه داده. لطفاً مقادیر واردشده را بررسی کنید.', {
      cause: error,
    });
  }
}

export async function updatePlaceRecord(
  id: string,
  data: Partial<typeof places.$inferInsert>,
  personIds?: string[],
  storyIds?: string[]
) {
  try {
    const cleanData = { ...data };
    if (cleanData.layerId !== undefined) {
      const allLayers = await db.select({ id: layers.id }).from(layers);
      const exists = allLayers.some((l) => l.id === cleanData.layerId);
      if (!exists) {
        cleanData.layerId = allLayers[0]?.id || null;
      }
    }

    const [updated] = await db
      .update(places)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(places.id, id))
      .returning();

    if (personIds !== undefined) {
      await db.delete(placePeople).where(eq(placePeople.placeId, id));
      if (personIds.length > 0) {
        const validPeople = await db.select({ id: people.id }).from(people);
        const validPersonSet = new Set(validPeople.map((p) => p.id));
        const filteredPersonIds = personIds.filter((pid) => validPersonSet.has(pid));
        if (filteredPersonIds.length > 0) {
          await db.insert(placePeople).values(
            filteredPersonIds.map((personId) => ({
              placeId: id,
              personId,
            }))
          );
        }
      }
    }

    if (storyIds !== undefined) {
      await db.delete(placeStories).where(eq(placeStories.placeId, id));
      if (storyIds.length > 0) {
        const validStories = await db.select({ id: stories.id }).from(stories);
        const validStorySet = new Set(validStories.map((s) => s.id));
        const filteredStoryIds = storyIds.filter((sid) => validStorySet.has(sid));
        if (filteredStoryIds.length > 0) {
          await db.insert(placeStories).values(
            filteredStoryIds.map((storyId) => ({
              placeId: id,
              storyId,
            }))
          );
        }
      }
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in updatePlaceRecord:', error);
    throw new Error('Failed to update location.', { cause: error });
  }
}

export async function deletePlaceRecord(id: string) {
  try {
    await db.delete(places).where(eq(places.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deletePlaceRecord:', error);
    throw new Error('Failed to delete location.', { cause: error });
  }
}

// People CRUD
export async function createPersonRecord(data: typeof people.$inferInsert) {
  try {
    const [created] = await db.insert(people).values(data).returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createPersonRecord:', error);
    throw new Error('Failed to create person record.', { cause: error });
  }
}

export async function updatePersonRecord(id: string, data: Partial<typeof people.$inferInsert>) {
  try {
    const [updated] = await db
      .update(people)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updatePersonRecord:', error);
    throw new Error('Failed to update person record.', { cause: error });
  }
}

export async function deletePersonRecord(id: string) {
  try {
    await db.delete(people).where(eq(people.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deletePersonRecord:', error);
    throw new Error('Failed to delete person record.', { cause: error });
  }
}

// Story CRUD
export async function createStoryRecord(data: typeof stories.$inferInsert, placeIds: string[] = []) {
  try {
    const [created] = await db.insert(stories).values(data).returning();
    if (created && placeIds.length > 0) {
      await db.insert(placeStories).values(
        placeIds.map((placeId) => ({
          placeId,
          storyId: created.id,
        }))
      );
    }
    return created;
  } catch (error) {
    console.error('Database query failed in createStoryRecord:', error);
    throw new Error('Failed to create story record.', { cause: error });
  }
}

export async function updateStoryRecord(
  id: string,
  data: Partial<typeof stories.$inferInsert>,
  placeIds?: string[]
) {
  try {
    const [updated] = await db
      .update(stories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stories.id, id))
      .returning();

    if (placeIds !== undefined) {
      await db.delete(placeStories).where(eq(placeStories.storyId, id));
      if (placeIds.length > 0) {
        await db.insert(placeStories).values(
          placeIds.map((placeId) => ({
            placeId,
            storyId: id,
          }))
        );
      }
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in updateStoryRecord:', error);
    throw new Error('Failed to update story record.', { cause: error });
  }
}

export async function deleteStoryRecord(id: string) {
  try {
    await db.delete(stories).where(eq(stories.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deleteStoryRecord:', error);
    throw new Error('Failed to delete story record.', { cause: error });
  }
}

// Event CRUD
export async function createEventRecord(data: typeof events.$inferInsert) {
  try {
    const [created] = await db.insert(events).values(data).returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createEventRecord:', error);
    throw new Error('Failed to create event record.', { cause: error });
  }
}

export async function updateEventRecord(id: string, data: Partial<typeof events.$inferInsert>) {
  try {
    const [updated] = await db
      .update(events)
      .set(data)
      .where(eq(events.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateEventRecord:', error);
    throw new Error('Failed to update event record.', { cause: error });
  }
}

export async function deleteEventRecord(id: string) {
  try {
    await db.delete(events).where(eq(events.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deleteEventRecord:', error);
    throw new Error('Failed to delete event record.', { cause: error });
  }
}

// Route CRUD
export async function createRouteRecord(
  data: typeof routes.$inferInsert,
  stopsPayload: { placeId: string; stopOrder: number; noteFa?: string; noteEn?: string }[] = []
) {
  try {
    const [created] = await db.insert(routes).values(data).returning();
    if (created && stopsPayload.length > 0) {
      await db.insert(routeStops).values(
        stopsPayload.map((s, idx) => ({
          routeId: created.id,
          placeId: s.placeId,
          stopOrder: s.stopOrder || idx + 1,
          noteFa: s.noteFa || null,
          noteEn: s.noteEn || null,
        }))
      );
    }
    return created;
  } catch (error) {
    console.error('Database query failed in createRouteRecord:', error);
    throw new Error('Failed to create walking route.', { cause: error });
  }
}

export async function updateRouteRecord(
  id: string,
  data: Partial<typeof routes.$inferInsert>,
  stopsPayload?: { placeId: string; stopOrder: number; noteFa?: string; noteEn?: string }[]
) {
  try {
    const [updated] = await db
      .update(routes)
      .set(data)
      .where(eq(routes.id, id))
      .returning();

    if (stopsPayload !== undefined) {
      await db.delete(routeStops).where(eq(routeStops.routeId, id));
      if (stopsPayload.length > 0) {
        const validPlaces = await db.select({ id: places.id }).from(places);
        const validPlaceSet = new Set(validPlaces.map((p) => p.id));
        const filteredStops = stopsPayload.filter((s) => validPlaceSet.has(s.placeId));
        if (filteredStops.length > 0) {
          await db.insert(routeStops).values(
            filteredStops.map((s, idx) => ({
              routeId: id,
              placeId: s.placeId,
              stopOrder: s.stopOrder || idx + 1,
              noteFa: s.noteFa || null,
              noteEn: s.noteEn || null,
            }))
          );
        }
      }
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in updateRouteRecord:', error);
    throw new Error('Failed to update walking route.', { cause: error });
  }
}

export async function deleteRouteRecord(id: string) {
  try {
    await db.delete(routes).where(eq(routes.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deleteRouteRecord:', error);
    throw new Error('Failed to delete walking route.', { cause: error });
  }
}

// Media CRUD
export async function createMediaRecord(data: typeof media.$inferInsert) {
  try {
    const [created] = await db.insert(media).values(data).returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createMediaRecord:', error);
    throw new Error('Failed to create media record.', { cause: error });
  }
}

export async function updateMediaRecord(id: string, data: Partial<typeof media.$inferInsert>) {
  try {
    const [updated] = await db
      .update(media)
      .set(data)
      .where(eq(media.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateMediaRecord:', error);
    throw new Error('Failed to update media record.', { cause: error });
  }
}

export async function deleteMediaRecord(id: string) {
  try {
    await db.delete(media).where(eq(media.id, id));
    return { success: true };
  } catch (error) {
    console.error('Database query failed in deleteMediaRecord:', error);
    throw new Error('Failed to delete media record.', { cause: error });
  }
}

// Moderation update (Pending review, Approved, Rejected, Needs more information)
export async function updateContributionStatus(
  id: string,
  moderationStatus: string,
  adminNotes?: string
) {
  try {
    const [updated] = await db
      .update(contributions)
      .set({
        moderationStatus,
        adminNotes: adminNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contributions.id, id))
      .returning();

    // Immediately sync approved contribution to places/stories (or unpublish if unapproved)
    await syncApprovedContributionsToPlaces();

    return updated;
  } catch (error) {
    console.error('Database query failed in updateContributionStatus:', error);
    throw new Error('Failed to update contribution status.', { cause: error });
  }
}
