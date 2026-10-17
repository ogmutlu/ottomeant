# Ottomeant

Bir Türkçe sözcük veya üç harfli Arapça kök girin; aynı kökün Nişanyan kayıtlarını ve kalıplardan üretilen adaylarını görün. Ana akış tek bir büyük arama alanıdır. Altındaki kök kütüphanesi, mevcut 94 kök ailesini ve 324 kaynaklı sözcüğü korur.

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
pipeline/morphology.py           Kökler, kalıplar, biçim kimliği, sözlük önceliği
pipeline/build.py                Bütün birleşimleri statik JSON'a dönüştürür
          |
public/data/                     Oluşturulan dosyalar; Git'e eklenmez
          |
src/model.ts + src/codec.ts       Readonly türler ve JSON sınır doğrulaması
src/data.ts                      Sürümlü, önbellekli, gerektiğinde dosya yükleme
src/lookup.ts                    Saf sözcük/kök çözümleme; DOM veya üretim yok
src/render.ts                    Sunum; kalıp üretmez, sözlük eşleştirmez
src/main.ts                      DOM olayları, gezinme ve görünüm durumu
```

Python motoru bağımlılıksız, açık kurallara dayanan bir başlangıç motorudur. CAMeL Tools veya başka bir haricî Arapça sözlük/model henüz eklenmemiştir; üretilen kayıtlar böyle bir araç tarafından doğrulanmış gibi sunulmaz. İleride dilbilimsel veri zenginleştirmesi Python derleme katmanına eklenebilir; tarayıcı ve statik barındırma sözleşmesi korunabilir.

## Bütün birleşimler

28 desteklenen Arapça harfin bütün sıralı üçlüleri hesaplanır: **28³ = 21.952 birleşim**. Her birleşim için **43 seçili kalıp** değerlendirilir: I–X fiil biçimleri, temel isim adayları ve türemiş fiillerin seçili mastar/ortaçları. IX. biçime edilgen ortaç uydurulmaz.

Her kökün dosyası `public/data/roots/XX/XX-YY-ZZ.json` yolundadır. Sayılar, manifestodaki harf sırasının sıfırdan başlayan indisleridir. Başlangıçta yalnızca `manifest.json` ve küçük sözcük arama dizini yüklenir; bir kök seçildiğinde onun dosyası indirilir. Kalıp açıklamaları manifestoda bir kez saklanır; dosyadaki kısa satırlar TypeScript sınırında adlandırılmış nesnelere dönüştürülür.

Veriler deterministiktir; değişmeyen dosyalar yeniden yazılmaz. İçerik sürümü sözlükten ve Python motorundan hesaplanır. Eski ve yeni sürümler karışırsa arayüz sessizce yanlış veri göstermek yerine yükleme hatası verir.

## Sözlük önceliği ve kanıt

- `data/lexicon.json`, önceki TypeScript seçkisinin kayıpsız taşınmış hâlidir. Kaynak URL’leri, kontrol tarihleri, alt madde bilgileri, özgün örnekler ve köken belirsizlikleri korunmuştur. Bu çalışma kaynak sayfalarını yeniden kontrol etmiş sayılmaz.
- **Aynı kök ve Arapça biçim** eşleşirse sözlük kaydı varsayımsal adayı kaldırır. Aynı biçimin birden çok Türkçe karşılığı korunur. `âlim`, `allame`, `muallim` gibi aynı anlamsal role sahip farklı biçimler birbirini silmez.
- Biçim eşleştirmesinde ünlü işaretleri kaldırılır; şedde harf ikizleşmesi olarak korunur. `مُعَلِّم` ve `مُعْلِم` aynı biçim sayılmaz. Ünlüsüz eş yazımlılık aynı anlam veya türetim geçmişini kanıtlamaz.
- Bir sözcüğün seçkide bulunmaması Nişanyan’da veya dilde bulunmadığı anlamına gelmez. Canlı Nişanyan taraması ve bütün sözlüğün içe aktarımı yapılmaz.
- Türkçe başlık araması `kâtip` / `katip` gibi düzeltme işaretli ünlüleri eşleştirir; `ş/s`, `ç/c`, `ö/o`, `ü/u` ayrımlarını korur. Kök okunuşu birden fazla Arapça köke denk gelirse seçim gösterilir. Tam kök seçimi için Arapça harfler kullanılabilir.
- Sözlükte bulunmayan Türkçe sözcüklerden etimoloji uydurulmaz. Ekli sözcüklerin Türkçe biçimbilimsel çözümlemesi henüz yoktur; sözlük başlığı veya kök girilmelidir.

## Dilbilimsel kapsam

Önhesaplama bütün desteklenen **harf birleşimlerini** kapsar; bütün Arapça sözcükleri veya çekimleri kapsadığı ileri sürülmez. Her kök her kalıbı kullanmaz. I. biçimin orta ünlüsü ve mastarı sözlükseldir; verilen biçimler yalnızca adaydır. IX. biçimin anlam alanı özellikle sınırlıdır.

Zayıf, ikiz ve hemzeli kökler ile belirli VIII. biçim benzeşmeleri **ham kalıp** olarak işaretlenir: gerekli ses ve yazım değişimleri uygulanmamıştır. Dört harfli kökler, düzensiz çoğullar ve bütün çekim paradigmaları kapsamda değildir.

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
