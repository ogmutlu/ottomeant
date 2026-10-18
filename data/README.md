# Nişanyan seçkisinin bakımı

`lexicon.json` kaynaklı Türkçe sözcükleri saklar. Tek sözlük kaynağı [Nişanyan Sözlük](https://www.nisanyansozluk.com/)'tür. Varsayımsal biçimler bu dosyaya alınmaz; Python motoru tarafından ayrı üretilir. Her kayıtta doğrudan madde bağlantısı, madde başlığı ve kontrol tarihi bulunur. Tanımlar ve kullanım örnekleri bu site için yazılmıştır; sözlük açıklamaları topluca kopyalanmaz.

18 Ekim 2026 genişletmesinde, resmî sayfaların açıklama meta verileri okunarak 67 sözcüğün Arapça kökü, yazımı ve kalıp ilişkisi kontrol edildi. Önceki 94 kök ve 324 kayda dokunulmadı; toplam 114 kök ve 391 sözcük oldu.

| Kök okunuşu | Eklenen sözcükler                   |
| ----------- | ----------------------------------- |
| f-t-ş       | teftiş, müfettiş                    |
| ş-k-l       | şekil, teşkil, teşekkül             |
| s-b-t       | tespit, sabit, sebat, sübut         |
| m-s-l       | temsil, misal, misil, mümessil      |
| d-v-m       | devam, daim, idame, müdavim         |
| a-k-b       | takip, akıbet, müteakip             |
| h-r-r       | hür, hürriyet, tahrir, muharrir     |
| ’-m-r       | emir, memur, amir                   |
| h-b-b       | muhabbet, mahbup, habip             |
| h-d-m       | hizmet, istihdam, müstahdem         |
| d-b-t       | zabıt, zabıta, mazbut, inzibat      |
| c-h-l       | cehalet, cahil, meçhul              |
| a-r-f       | arif, irfan, marifet, tarif, itiraf |
| f-r-k       | fark, fırka, tefrik                 |
| ş-r-h       | şerh, teşrih                        |
| n-ş-r       | neşir, naşir, intişar               |
| k-ş-f       | keşif, kâşif, inkişaf               |
| t-m-m       | tamam, tam, itmam, mütemmim         |
| n-k-d       | nakit, tenkit, münekkit             |
| h-s-s       | husus, tahsis, mahsus, ihtisas      |

Kökün kimliği her zaman JSON'daki Arapça harflerdir; tablo arayüzdeki Türkçe okunuşu gösterir. Aynı okunuş farklı Arapça köklere karşılık gelebilir.

## Resmî madde inceleme aracı

```sh
uv run --locked python -m scripts.inspect_nisanyan teftiş müfettiş temsil
```

Araç yalnızca `www.nisanyansozluk.com/kelime/` sayfalarını okur ve `.cache/nisanyan-review.json` dosyasına inceleme çıktısı yazar. Başlık eşleşmezse veya açıklama yoksa hata kaydeder. İstekleri sırayla yapar; 429 yanıtında durur. Sayfalardaki JavaScript çalıştırılmaz. Bu komut sözlüğü değiştirmez; normal derleme ağ erişimine ihtiyaç duymaz.

`nisanyan-cli` izole uv ortamında indirilip denendi. Bu ortamda eski API çağrısı sözlük JSON'u döndürmediği için yardımcı araç resmî madde sayfalarını okur.

Yeni kayıt eklerken:

1. Türkçe başlığı, Arapça yazımı ve kökü resmî maddeden doğrulayın. Boş veya erişilemeyen sayfaları doğrulama saymayın. Yalnızca Nişanyan kullanın.
2. Kaynağın biçim açıklaması kesin bir üretim kalıbıyla eşleşiyorsa `formId` verin. Bu kimlik aynı kök ve kalıp için varsayımsal biçimi kaldırır. Farklı veya belirsiz kalıpları zorla eşlemeyin.
3. Tanıksız ara biçimleri veya kaynak içindeki uyuşmazlıkları `originNote` ile koruyun. Tenkit ve münekkit maddeleri Arapça ara biçimi tanıksız gösterir. Tahsis maddesinde Latin kök notu ile Arapça fiil uyuşmadığından, kullanılan Arapça kök ve gerekçesi kayıtta açıklanır.
4. Bir sözlük kaydı kökün diğer varsayımsal biçimlerini doğrulamaz. Kaynağı bu biçimlere taşımayın.
5. `npm run check` ve `npm test` çalıştırın. Sayılar, arama dizini ve kök dosyaları derlemede güncellenir.
