# انتشار نقشه روی هاست خودتان (cPanel / DirectAdmin / هر هاست استاتیک)

نقشه بعد از build فقط چند فایل ثابت است؛ PHP یا دیتابیس لازم ندارد.

## ۱. ساخت
```powershell
npm.cmd install
npm.cmd run build
```
پوشه‌ی `dist` ساخته می‌شود. همه‌ی مسیرها نسبی‌اند، پس در ریشه‌ی سایت، در یک پوشه (مثل `/map/`) یا روی زیردامنه کار می‌کند.

## ۲. آپلود
محتوای داخل `dist` (نه خود پوشه) را در مسیر دلخواه روی هاست آپلود کنید، مثلاً `public_html/map/`. بعد باز کنید:
`https://barzokhouse.com/map/`

## ۳. عکس و صدا روی همان هاست
- عکس‌ها: `public/images/barzok/` (پیش از build) یا مستقیم در `map/images/barzok/` روی هاست.
- صدا: فایل‌ها را در `map/audio/` بگذارید و در `src/data/audio.json` بنویسید:
  `{ "lodging-003": [{ "url": "audio/lodging-003.mp3", "titleFa": "قصه این مکان" }] }`
  بعد دوباره build کنید و آپلود کنید.
- فرمت پیشنهادی صدا: mp3 یا m4a، حدود ۶۴ تا ۹۶ کیلوبیت‌برثانیه تا حجم کم بماند.

## ۴. قرار دادن در وردپرس
- لینک مستقیم: دکمه یا منو به `https://barzokhouse.com/map/`.
- یا داخل صفحه با ویجت HTML المنتور:
```html
<iframe src="https://barzokhouse.com/map/?embed=1" width="100%" height="700" style="border:0" allow="geolocation" allowfullscreen loading="lazy"></iframe>
```
`allow="geolocation"` برای GPS راهنمای پیاده‌روی لازم است و سایت باید HTTPS باشد.

## ۵. آدرس مکان‌ها (برای QR و اشتراک‌گذاری)
هر مکان: `https://barzokhouse.com/map/?place=<شناسه>` (شناسه‌ها در `docs/places-index.csv`).
این آدرس‌ها نیاز به تنظیم سرور ندارند.

## نکته‌ی مهم درباره‌ی ویرایش
تا وقتی دیتابیس روی هاست نیست، ویرایش پنل مدیر فقط در همان مرورگر ذخیره می‌شود. برای تغییر داده‌ی عمومی، فایل‌های `src/data/seed` یا `audio.json` را عوض کنید و دوباره build و آپلود کنید.
