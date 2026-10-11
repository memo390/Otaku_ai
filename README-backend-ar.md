# إضافة الخادم لمشروع Otaku AI

هذه الملفات تضيف كود Worker للمحادثة وإنشاء الصور. احتفظ بملفات الواجهة الحالية (`index.html` و`logo.svg` و`memo-logo.png`) في جذر المستودع كما هي.

## الملفات التي يجب إضافتها إلى جذر مستودع GitHub
- `worker.js`
- `wrangler.jsonc`
- `.assetsignore`

بعد إضافة الملفات، سيعيد إعداد Cloudflare بناء المشروع باستخدام أمر النشر الموجود `npx wrangler deploy`.

## إضافة المفتاح بأمان
في إعدادات Worker على Cloudflare، افتح Variables and Secrets ثم أضف **Secret** باسم `GEMINI_API_KEY` والصق المفتاح في خانة القيمة. لا تضع المفتاح في GitHub أو داخل `index.html`.

نموذج المحادثة: `gemini-2.5-flash`.
نموذج الصور الافتراضي: `gemini-3.1-flash-image`؛ إنشاء الصور قد يتطلب توافر النموذج في حساب Google AI وحدود/فوترة مناسبة. يمكن تغييره بإضافة Secret/Variable باسم `GEMINI_IMAGE_MODEL`.

بعد نجاح النشر، اختبر `/api/health` على نطاق الموقع. إذا كانت الاستجابة `{"configured":true}` فالمفتاح موجود في بيئة Worker. لا تعرض قيمة المفتاح لأي شخص.
