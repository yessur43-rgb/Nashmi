# تعليمات بناء تطبيق APK للأندرويد

## المتطلبات الأساسية

قبل بناء التطبيق، تأكد من توفر التالي على جهازك:

### 1. تثبيت Android Studio
- حمّل Android Studio من: https://developer.android.com/studio
- قم بتثبيته واتبع التعليمات
- افتح Android Studio وانتظر حتى يتم تحميل جميع المكونات

### 2. تثبيت Android SDK
Android SDK يأتي مع Android Studio، ولكن تأكد من:
- افتح Android Studio > Settings > Appearance & Behavior > System Settings > Android SDK
- تأكد من تثبيت:
  - Android SDK Platform (API 34 أو أحدث)
  - Android SDK Build-Tools
  - Android SDK Command-line Tools
  - Android SDK Platform-Tools

### 3. تثبيت JDK
- تحتاج إلى Java Development Kit (JDK) 17 أو أحدث
- يمكنك تثبيته من: https://www.oracle.com/java/technologies/downloads/

---

## خطوات بناء APK

### الطريقة 1: باستخدام Android Studio (مستحسن للمبتدئين)

1. **افتح المشروع في Android Studio:**
   ```bash
   cd ~/Nashmi/android
   ```
   - افتح Android Studio
   - اختر "Open an Existing Project"
   - اختر مجلد `android` من مشروع Nashmi

2. **بناء APK:**
   - من القائمة: Build > Build Bundle(s) / APK(s) > Build APK(s)
   - انتظر حتى ينتهي البناء
   - ستظهر رسالة تحتوي على رابط لموقع ملف APK

3. **موقع ملف APK:**
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### الطريقة 2: باستخدام سطر الأوامر

1. **تأكد من إعداد متغيرات البيئة:**
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

2. **انتقل إلى مجلد المشروع:**
   ```bash
   cd ~/Nashmi
   ```

3. **بناء APK للتطوير (Debug):**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

4. **بناء APK للإنتاج (Release) - موقّع:**

   أولاً، أنشئ keystore للتوقيع:
   ```bash
   keytool -genkey -v -keystore nashmi-release-key.keystore -alias nashmi -keyalg RSA -keysize 2048 -validity 10000
   ```

   ثم أنشئ ملف `android/key.properties`:
   ```properties
   storePassword=كلمة_السر_التي_اخترتها
   keyPassword=كلمة_السر_التي_اخترتها
   keyAlias=nashmi
   storeFile=../nashmi-release-key.keystore
   ```

   الآن قم ببناء APK موقّع:
   ```bash
   ./gradlew assembleRelease
   ```

5. **موقع ملفات APK:**
   - Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Release: `android/app/build/outputs/apk/release/app-release.apk`

---

## تثبيت APK على الهاتف

### عبر USB:

1. **تفعيل Developer Options على الهاتف:**
   - الإعدادات > حول الهاتف > اضغط على "Build Number" 7 مرات

2. **تفعيل USB Debugging:**
   - الإعدادات > Developer Options > USB Debugging

3. **توصيل الهاتف وتثبيت APK:**
   ```bash
   cd ~/Nashmi
   npx cap run android --target your-device-id
   ```
   أو:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### عبر ملف APK مباشرة:

1. انقل ملف APK إلى هاتفك (عبر USB، Bluetooth، أو البريد الإلكتروني)
2. افتح ملف APK على الهاتف
3. قد تحتاج لتفعيل "Install from Unknown Sources" في الإعدادات

---

## استكشاف الأخطاء

### خطأ "SDK not found"
- تأكد من تثبيت Android SDK بشكل صحيح
- تأكد من إعداد متغير البيئة `ANDROID_HOME`

### خطأ "Java version"
- تأكد من تثبيت JDK 17 أو أحدث
- تحقق من الإصدار: `java -version`

### خطأ "Gradle build failed"
- نظف المشروع: `cd android && ./gradlew clean`
- حاول مرة أخرى

### التطبيق لا يعمل على الهاتف
- تأكد من أن الهاتف يدعم Android 7.0 (API 24) أو أحدث
- تحقق من الصلاحيات (الكاميرا، الموقع، الميكروفون)

---

## ملاحظات مهمة

1. **الصلاحيات:** التطبيق يطلب الصلاحيات التالية:
   - الكاميرا (لتصوير المنتجات)
   - الموقع (لتحديد الأماكن القريبة)
   - الميكروفون (للتسجيل الصوتي)
   - التخزين (لحفظ الصور والبيانات)

2. **API Key:** ستحتاج لإدخال Google Gemini API Key عند أول تشغيل للتطبيق

3. **الاتجاه:** التطبيق يدعم اللغة العربية (RTL) بشكل كامل

4. **الميزات:** جميع ميزات التطبيق الموجودة في نسخة الويب متوفرة في التطبيق

---

## التحديثات المستقبلية

لتحديث التطبيق بعد إجراء تغييرات على الكود:

```bash
cd ~/Nashmi

# بناء تطبيق الويب
npm run build

# مزامنة مع الأندرويد
npx cap sync android

# بناء APK جديد
cd android
./gradlew assembleDebug
```

---

## للمزيد من المعلومات

- Capacitor Documentation: https://capacitorjs.com/docs
- Android Developer Guide: https://developer.android.com/guide
