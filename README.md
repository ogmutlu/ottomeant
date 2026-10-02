# Ottomeant

Türkçe arayüzlü Arapça–Türkçe kök atlası. 94 kök ailesinde 324 sözcük, Nişanyan Sözlük üzerinden kontrol edilmiştir. Her sözcüğün kaynak bağlantısı ve o sözcüğü aynı yazımla kullanan özgün bir Türkçe örneği vardır. Arapça örnek cümle gösterilmez; özgün sözcük yazımı isteğe bağlıdır.

## Çalıştırma

Node.js 22 veya üzeri, npm ve Python 3 gerekir:

```sh
npm install
./serve.sh
```

Betik başlatıldığında yazdırılan adresi açın. Varsayılan port 8000 doluysa sıradaki boş port seçilir; `./serve.sh 8080` gibi açıkça seçilen bir port doluysa anlaşılır bir hata verilir. Betik önce TypeScript derlemesini yapar; derleme başarısızsa sunucuyu başlatmaz. `Ctrl+C` ile durdurabilirsiniz.

Başka bir port veya npm üzerinden çalıştırma:

```sh
./serve.sh 8080
npm run serve -- 8080
```

`./serve.sh --help` kullanım bilgisini gösterir. Sunucu yalnızca yerel makineye bağlanır. NVM kullanıyorsanız önce `nvm use` ile Node.js ortamınızı etkinleştirin. Geliştirme sunucusu dosyaları otomatik derlemez; düzenleme sonrasında `npm run build` çalıştırın ve tarayıcıyı yenileyin.

## GitHub Pages

Hedef adres: https://ogmutlu.github.io/ottomeant/

GitHub üzerinde `ogmutlu/ottomeant` adlı boş, herkese açık bir depo oluşturun. Proje dosyalarını `main` dalına gönderin; `.github/workflows/pages.yml` dosyasını da ekleyin. Depoda **Settings → Pages → Build and deployment → Source → GitHub Actions** seçin.

Yerel klasör henüz Git deposu değilse ilk gönderim:

```sh
git init -b main
git add .
git commit -m "Publish Ottomeant"
git remote add origin https://github.com/ogmutlu/ottomeant.git
git push -u origin main
```

Actions sekmesindeki **Deploy Ottomeant to GitHub Pages** iş akışını çalıştırın. Sonraki `main` gönderimleri otomatik yayımlanır. İş akışı TypeScript denetimini ve testleri çalıştırır; yalnızca HTML, CSS ve derlenmiş JavaScript dosyalarını yayımlar. Bağlantılar göreli olduğu için `/ottomeant/` altında çalışır. Sunucu veya `serve.sh` GitHub Pages üzerinde gerekmez. Önerilen kökler ve kaydedilenler ziyaretçinin tarayıcısında kalır.

## Yapı

- `src/model.ts`: sözlük kaydı ile doğrulanmamış kalıbı ayıran `Entry` birleşim türü.
- `src/data.ts`: başlangıç kökleri ve sözlük koleksiyonunun birleştirilmesi.
- `src/expanded-data.ts`: 82 yeni kök ailesi ve 242 kaynaklı sözcük.
- `src/library.ts`: değiştirilmeyen sözlük koleksiyonu ve ayrı kullanıcı önerileri.
- `src/morphology.ts`: DOM ve depolamadan bağımsız kalıp üretimi ve kök çözümleme.
- `src/hypotheses.ts`: her rol için kökün anlamına dayanan öneri ve varsayımsal Türkçe örnek.
- `src/main.ts`: arayüz, kaynak bağlantıları ve yerel kaydetme.
- `serve.sh`: derleme ve yerel sunucu.
- `scripts/serve.py`: portu gerçekten bağladıktan sonra adresi duyuran, port çakışmasını yöneten sunucu.
- `tests/morphology.test.mjs`: bütün üçlü birleşimler, aynı roldeki birden fazla sözcük, kaynak alanları ve örneklerde tam sözcük eşleşmesi.

```sh
npm run check
npm test
npm run format
```

## Kaynak ve kanıt sınırı

Kaynak: [Nişanyan Sözlük, Sevan Nişanyan](https://www.nisanyansozluk.com/). Sözcük sayfaları 1 Ekim 2026 tarihinde kontrol edilmiştir. Alt madde olarak kaydedilen sözcükler ana madde adıyla birlikte gösterilir. Tanımlar ve örnekler burada yazılmıştır; Nişanyan’ın tarihsel tanıkları veya açıklamaları topluca kopyalanmamıştır. Kaynak bağlantısı sözcüğü ve köken ilişkisini destekler; burada yazılan örnek cümle sözlük alıntısı değildir.

`Entry = DictionaryEntry | UnverifiedForm`: kaydı henüz kontrol edilmeyen bir kalıp, “olmayan sözcük” diye etiketlenmez. Desteklenen her kalıp için eşleşen sözlük kaydı bulunmuyorsa varsayımsal kart gösterilir. Bu kartlar varsayılan olarak görünürdür; önerilen anlam ve tam biçimi kullanan kurgusal Türkçe örnek içerir. Örnekler gerçek kullanım kanıtı olarak sunulmaz. Bir sözlük kaydı aynı rolün başka türevlerini silmez. Örneğin `âlim`, `allame` ve `muallim` birlikte gösterilir.

Nişanyan’ın tanıksız olarak işaretlediği Arapça köken biçimleri, Türkçe sözcüğün kaydından ayrı açıklanır. `manzara` ve `nazariye` kartlarında bu ayrım görünür. Rol sınıflandırması anlamsal bir gezinti aracıdır; dilbilgisel kalıp ayrıca belirtilir.

Sözlük kökleri ile kullanıcı önerileri ayrı kütüphane sekmelerindedir. Öneriler tarayıcıda saklanır; yeni bir kök eklemek sözlük koleksiyonunu değiştirmez. Sözlükte zaten bulunan bir kök yeniden önerilirse mevcut kaydı açılır.

Sözlük verisi yerel bir seçkidir; sitedeki arama bütün Nişanyan veritabanını canlı taramaz. Her kökün yanında Nişanyan’ın kendi kök aramasına bağlantı vardır. Yeni kayıtlar eklenirken kaynak sayfası gerçekten okunmalı, doğru kök kontrol edilmeli ve örnek cümlede başlıktaki Türkçe sözcük aynen kullanılmalıdır.

## Kalıp üretimi

21.952 sıralı üç harfli birleşim, yedi isim şablonu ve ilk on fiil biçimi gezilebilir. Nadir fiil biçimleri, dört harfli kökler ve tüm çekim paradigmaları uygulanmamıştır. Zayıf, ikiz ve hemzeli köklerin çıktıları ham şablondur. Arapça biçim ile Türkçeye geçmiş sözcük arasındaki ses değişimleri genel bir algoritmayla üretilmez; sözlük kayıtlarında gerçek Türkçe biçim gösterilir.

Yeni kök girişinde Türkçe harfler aynen korunur; `ş` ile `s` ayrı değerlendirilir. Desteklenmeyen harfler başka harfe çevrilmeden reddedilir. Türkçe harflerle kök okunuşu, Arapça ses ayrımları bakımından kayıplıdır. Atlas menüsündeki numaralı harf seçicisi her Arapça harfi ayrı seçebilir. Arama ve kaydetme tarayıcıda çalışır. Google Fonts yüklenemezse sistem yazı tipleri kullanılır.
