# Ottomeant

Bir Türkçe sözcük, Arapça kök veya Türkçe alfabeden üç harf girin; kökün kaynaklı sözcüklerini ve varsayımsal biçimlerini sabit gruplarda görün. Ana akış tek bir büyük arama alanıdır. Altındaki kök kütüphanesinde 114 kök ailesi ve 391 Nişanyan kaynaklı sözcük bulunur.

Site tamamen statiktir. Python yalnızca geliştirme ve derleme sırasında çalışır. Ziyaretçinin Python’a, bir API’ye veya uygulama sunucusuna ihtiyacı yoktur.

## Çalıştırma

Node.js 22+, npm ve [uv](https://docs.astral.sh/uv/) gerekir. `.python-version` Python 3.13 seçer; uv ortamı ve Python geliştirme araçlarını yönetir.

```sh
npm ci
uv sync --locked
npm run dev
```

`npm run dev` önce bütün verileri ve TypeScript’i derler, ardından yerel önizlemeyi başlatır. Varsayılan adres `http://127.0.0.1:8000`; port doluysa sonraki boş port kullanılır. Belirli bir port için `./serve.sh 8080` çalıştırın. Değişiklikten sonra yeniden derleyip tarayıcıyı yenileyin.

```sh
npm run build        # Python önhesaplama + TypeScript
npm run data:build   # yalnızca JSON verileri
npm run build:ts     # yalnızca arayüz kodu
npm run check       # strict TypeScript, Ruff ve Python tür denetimi
uv run ty check pipeline tests/python
uv run ruff check pipeline tests/python
npm test            # derleme + Python ve TypeScript/JavaScript regresyonları
```

## Alan mantığı ve arayüz

```text
data/lexicon.json                 Düzenlenebilir kaynaklı sözlük
          |
pipeline/model.py                TypedDict sözleşmeleri ve giriş doğrulaması
pipeline/morphology.py           Arapça ve deneysel Türkçe kalıp uygulaması
pipeline/catalog.py              Grup sırası, kalıp kimliği ve sözlük önceliği
pipeline/build.py                Bütün birleşimleri statik JSON'a dönüştürür
          |
public/data/                     Oluşturulan dosyalar; Git'e eklenmez
          |
src/model.ts + src/codec.ts       Readonly türler ve JSON sınır doğrulaması
src/data.ts                      Sürümlü, önbellekli, gerektiğinde dosya yükleme
src/lookup.ts                    Saf sözcük/kök çözümleme; DOM veya üretim yok
src/families.ts                  Aynı okunuşlu adayları tek görünüme yansıtır
src/grouping.ts                  Kanıttan bağımsız sabit kalıp sırası
src/render.ts                    Sunum; kalıp üretmez, sözlük eşleştirmez
src/main.ts                      DOM olayları, gezinme ve görünüm durumu
```

Python motoru bağımlılıksız, açık kurallara dayanan bir başlangıç motorudur. CAMeL Tools veya başka bir haricî Arapça sözlük/model henüz eklenmemiştir; üretilen kayıtlar böyle bir araç tarafından doğrulanmış gibi sunulmaz. İleride dilbilimsel veri zenginleştirmesi Python derleme katmanına eklenebilir; tarayıcı ve statik barındırma sözleşmesi korunabilir.

## Bütün birleşimler

İki ayrı kimlik alanının bütün sıralı üçlüleri hesaplanır:

- **Arapça: 28³ = 21.952 birleşim.** Tam Arapça harf kimliği korunur; kaynaklı sözlük bu alana bağlıdır.
- **Deneysel Türkçe: 18.557 birleşim.** 29³ = 24.389 Türkçe üçlüden Arapça okunuş karşılığı olan 18³ = 5.832 üçlü çıkarılır. `j-k-l`, `p-ç-ğ`, `ı-ö-ü` gibi kalan üçlülerin harfleri aynen korunur; Arapça yazım veya sözlük kanıtı uydurulmaz. Ünlüler de kabul edilir.

İki alanda da aynı **43 seçili kalıp** değerlendirilir: I–X fiil biçimleri, temel isim adayları ve türemiş fiillerin seçili mastar/ortaçları. IX. biçime edilgen ortaç uydurulmaz. Bu iki kimlik alanı tek bir kök koleksiyonu gibi birleştirilmez.

`k-t-b` araması bilinen Arapça `كتب` ailesini açar; ayrıca Türkçe kopya sunulmaz. `k-l-m` gibi birden fazla bilinen eşleşme varsa sözcükleri ve kök anlamlarını gösteren seçim sunulur. Bilinen kök yoksa bütün Arapça harf eşleşmelerinin verileri yüklenir. Kalıp kimlikleri ve Türkçe okunuşları aynıysa, örneğin `ş-k-z` için, tek biçim listesi gösterilir. Ayrı Arapça kök kimlikleri açılır bir ayrıntıda; her biçimin Arapça yazım seçenekleri de isteğe bağlı Arapça sütununda korunur. Yazımlardan herhangi biri ham kalıpsa ortak satır uyarılır. Kaynaklı aileler birleştirilmez; ileride üretim farklı okunuşlar verirse seçim korunur. Bu adaylar için de Türkçe kopya üretilmez. Yalnızca Arapça karşılığı olmayan üçlüler deneysel alanda açılır. Sözcük aramasında Nişanyan başlıkları önceliklidir. Eski `mode=turkish` bağlantıları da aynı önceliğe uyar. Her derlemede artık kullanılmayan deneysel kopya dosyaları temizlenir.

Arapça kök dosyaları `public/data/roots/XX/XX-YY-ZZ.json`, deneysel Türkçe dosyalar `public/data/turkish-roots/XX/XX-YY-ZZ.json` yolundadır. Sayılar, ilgili alfabenin manifestodaki sırasının sıfırdan başlayan indisleridir. Başlangıçta yalnızca `manifest.json` ve küçük sözcük arama dizini yüklenir; bir kök seçildiğinde onun dosyası indirilir. Kalıp açıklamaları manifestoda bir kez saklanır; dosyadaki kısa satırlar TypeScript sınırında adlandırılmış nesnelere dönüştürülür. Deneysel adayın Arapça alanı `null` olur.

## Sabit grup ve kalıp sırası

Her kökte aynı sekme sırası kullanılır: **Yapan → Etkilenen → Eylem / süreç → Yer → Araç → Nitelik / durum → Diğer isimler → Fiiller**. Bir defada yalnızca seçilen kategorinin tablosu görünür; seçili sekme kök değiştirirken korunur. Sekmelerde kayıt sayısı gösterilir. Klavyede sağ/sol oklar, Home ve End ile gezinilebilir. Mevcut 43 üretim kalıbının dağılımı sırasıyla **10, 9, 10, 1, 1, 1, 1, 10** şeklindedir. Bunlar gezinme gruplarıdır; kalıbın gerçek anlamı veya kullanımını garanti etmez.

Grupların içinde temel kalıplar I–X sırasında görünür. Kaynaklı kayıt kendi kalıp yuvasına yerleşir ve yeşil kalır; diğer yuvalarda aday gösterilir. Kaynaklılar ve adaylar ayrı listelere ayrılmaz. Üretim kapsamı dışındaki sözlük kalıpları grubun sonunda, bütün kökler için ortak bir kayıt sırasıyla gösterilir. Bir kalıbın birden çok kaynaklı Türkçe karşılığı aynı yuvada korunur.

Veriler deterministiktir; değişmeyen dosyalar yeniden yazılmaz. İçerik sürümü sözlükten ve Python motorundan hesaplanır. Eski ve yeni sürümler karışırsa arayüz sessizce yanlış veri göstermek yerine yükleme hatası verir.

## Sözlük önceliği ve kanıt

- `data/lexicon.json`, önceki TypeScript seçkisindeki 94 kök ve 324 kaydı korur. Bu kayıtların kaynak URL’leri, kontrol tarihleri, alt madde bilgileri, özgün örnekleri ve köken belirsizlikleri değiştirilmemiştir; yeniden kontrol edilmiş sayılmazlar.
- 18 Ekim 2026 genişletmesi 20 kök ve 67 sözcük ekler. Eklerin kökleri, Arapça yazımları ve kalıp açıklamaları Nişanyan’ın resmî madde sayfalarından kontrol edilmiştir. Tek sözlük kaynağı Nişanyan’dır. Ayrıntılar ve yeni sözcükler [veri notlarında](data/README.md) yer alır.
- **Aynı Arapça kök ve tanımlanmış kalıp kimliği** eşleşirse sözlük kaydı o adayı kaldırır. Aynı kalıbın birden çok Türkçe karşılığı korunur. `âlim`, `allame`, `muallim` gibi aynı gruptaki farklı biçimler birbirini silmez. Deneysel Türkçe köklere Arapça sözlük kanıtı taşınmaz.
- Sözlük kalıpları muhafazakâr biçimde eşlenir: editörce verilen isteğe bağlı `formId` ya da tek anlamlı rol/yazım eşleşmesi kullanılır. Ünlüsüz yazım tek başına yeterli değildir; şedde korunur. Örneğin `ilim` kaydı `fa‘l` veya fiil adayını silmez. Kalıbı kesin eşlenemeyen kayıtlar kaybolmaz; ayrı, sabit sözlük kalıbı kimliği alır. Ham sözlük kalıbı etiketi de korunur; bu sınıflandırma kaynak sayfalarının yeniden dilbilimsel incelemesi değildir.
- Bir sözcüğün seçkide bulunmaması Nişanyan’da veya dilde bulunmadığı anlamına gelmez. Canlı Nişanyan taraması ve bütün sözlüğün içe aktarımı yapılmaz.
- Türkçe başlık araması `kâtip` / `katip` gibi düzeltme işaretli ünlüleri eşleştirir; `ş/s`, `ç/c`, `ö/o`, `ü/u` ayrımlarını korur. Kök okunuşu farklı sözlük ailelerine denk gelirse seçim gösterilir; aynı hipotetik Türkçe çıktılar tek listede görünür. Tam kök seçimi için Arapça harfler kullanılabilir.
- Sözlükte bulunmayan Türkçe sözcüklerden etimoloji uydurulmaz. Üç Türkçe harf deneysel giriş olabilir; daha uzun ekli sözcüklerin Türkçe biçimbilimsel çözümlemesi henüz yoktur. Deneysel üçlüler için `â/î/û` gibi harfler başka harfe katlanmaz; 29 harfli Türkçe alfabe esas alınır.

## Sözcükten köke arama

Kök harflerinden biçim üretmek ile rastgele bir Türkçe sözcüğün tarihsel kökünü bulmak ayrı işlemlerdir. Arama şu anda kaynaklı başlıkları ve doğrudan üç harfli kök girişlerini çözer. Örneğin `teftiş` ve `müfettiş` aynı `فتش` ailesine gider; bu eşleme sözlük kaydından gelir.

Sonraki katman, Türkçe ekli biçimleri sözlük başlıklarına çözümlemek ve ardından mevcut kök bağlantısını kullanmaktır. [Zemberek](https://github.com/ahmetaa/zemberek-nlp) Türkçe biçimbilimsel çözümleme sağlar; Arapça etimolojik kök bağlantısı yine Nişanyan’dan gelmelidir. Sözlük dışı girdiler için kalıpları tersine eşlemek birden fazla **varsayımsal kök** verebilir. Türkçedeki ses değişimleri ve Arapça harf ayrımlarının kaybı nedeniyle bunlar sözlük kanıtı sayılamaz. Ters eşleme ve Türkçe ek çözümlemesi henüz uygulanmamıştır. Sözlük/kök dizini Python’da önceden hazırlanıp TypeScript’te aranarak statik barındırma korunabilir.

## Dilbilimsel kapsam

Önhesaplama bütün desteklenen **harf birleşimlerini** kapsar; bütün Arapça sözcükleri veya çekimleri kapsadığı ileri sürülmez. Her kök her kalıbı kullanmaz. I. biçimin orta ünlüsü ve mastarı sözlükseldir; verilen biçimler yalnızca adaydır. IX. biçimin anlam alanı özellikle sınırlıdır.

Zayıf, ikiz ve hemzeli kökler ile belirli VIII. biçim benzeşmeleri **ham kalıp** olarak işaretlenir: harfler doğrudan şablona yerleştirilir; bu motorun henüz uygulamadığı özel ses ve yazım kuralları vardır. Bu, değişiklik uygulanmamasının dilbilimsel olarak doğru olduğu anlamına gelmez. Kök sınıfına dayalı işaretleme ihtiyatlıdır; belirli bir biçim zaten doğru olabilir. Dört harfli kökler, düzensiz çoğullar ve bütün çekim paradigmaları kapsamda değildir.

Üretilen okunuşlar Türkçe harflerle yaklaşık Arapça okunuşlardır. Tarihsel Türkçe alıntı sözcüklerin yazımı ancak kaynaklı kayıttan gösterilir. Yeni bir kökün anlamı bilinmiyorsa ona sözlük anlamı veya kurgusal kullanım cümlesi atanmaz.

## Statik yayımlama

GitHub Pages iş akışı uv ve npm ortamlarını kurar, Python/TypeScript denetimlerini ve testleri çalıştırır, sonra şu dosyaları yayımlar:

```text
index.html
style.css
dist/
public/data/
```

Elle barındırmada da `npm run build` sonrasında bu dosyaları aynı göreli yapıyla kopyalayın. Bağlantılar hem alan adı kökünde hem `/ottomeant/` gibi bir alt yolda çalışır. Ziyaretçilere kaynak sözlük dosyasını veya Python ortamını yayımlamak gerekmez. `public/data/` Git tarafından yok sayılır ve her derlemede yeniden üretilebilir.

Kaynak: [Nişanyan Sözlük](https://www.nisanyansozluk.com/). Tanımlar ve mevcut Türkçe örnekler özgün editör metinleridir; sözlükten toplu alıntı değildir.
