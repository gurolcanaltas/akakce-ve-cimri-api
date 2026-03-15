# Unofficial API Denemesi

Bu proje `Akakce` ve `Cimri` icin unofficial API denemesidir.

API sunar:

- arama
- urun detay
- tum teklifler
- sade satis listesi
- direkt urun URL'sinden analiz
- provider health kontrolu

## Kurulum

```bash
pnpm install
pnpm exec playwright install chromium
```

Python yardimcisi icin:

```bash
..\tools\python311\python.exe -m pip install curl_cffi
```

## Calistirma

```bash
pnpm start
```

Cursor icinde hizli gelistirme icin:

```bash
pnpm dev
```

## Cursor Icindeki Kullanim

1. Cursor terminalini `Unofficial API Denemesi` klasorunde ac.
2. Ilk kurulum icin sirasiyla su komutlari calistir:

```bash
pnpm install
pnpm exec playwright install chromium
..\tools\python311\python.exe -m pip install curl_cffi
```

3. Sunucuyu baslat:

```bash
pnpm start
```

4. Elle test etmek icin `cursor-test.http` dosyasini ac.
5. Dosyadaki istekleri tek tek calistir veya URL'leri browser ya da terminalden cagir.

## Hizli Test

Tek komutla gecici sunucu ayaga kalksin ve ana endpointler dogrulansin istiyorsan:

```bash
pnpm smoke
```

Bu komut:

- API'yi gecici olarak `3457` portunda baslatir
- `health`, `search`, `detail`, `offers`, `sales` ve `by-url` endpointlerini kontrol eder
- `redirectUrl` gibi yeni alanlarin geldigini test eder
- sonucu terminale ozet olarak yazar

## Endpointler

- `GET /api/unofficial/search?q=iphone 15`
- `GET /api/unofficial/products/akakce/:productKey`
- `GET /api/unofficial/products/akakce/:productKey/offers`
- `GET /api/unofficial/products/akakce/:productKey/sales`
- `GET /api/unofficial/products/cimri/:productKey`
- `GET /api/unofficial/products/cimri/:productKey/offers`
- `GET /api/unofficial/products/cimri/:productKey/sales`
- `GET /api/unofficial/by-url?url=https://www.akakce.com/...`
- `GET /api/unofficial/by-url/offers?url=https://www.akakce.com/...`
- `GET /api/unofficial/by-url/sales?url=https://www.akakce.com/...`
- `GET /api/unofficial/health/providers`

## Ornek Kullanim

Akakce urun URL'sinden tum teklifler:

```text
GET /api/unofficial/by-url/offers?url=https://www.akakce.com/turk-kahve-makinesi/en-ucuz-arcelik-tkm-9961-s-telve-siyah-ikili-fiyati,490406523.html
```

Cimri urun URL'sinden sade satis listesi:

```text
GET /api/unofficial/by-url/sales?url=https://www.cimri.com/cep-telefonlari/en-ucuz-apple-iphone-15-5g-128gb-akilli-cep-telefonu-fiyatlari,a2231112273
```

## Veri Alanlari

`offers` ciktisinda tipik olarak su alanlar bulunur:

- `id`
- `merchantPlatform`
- `seller`
- `price`
- `priceCurrency`
- `availability`
- `sellerUrl`
- `url`
- `redirectUrl`
- `targetUrl`
- `title`
- `description`
- `shipping`
- `updatedAt`

`sales` ciktisi sade bir liste doner:

- `id`
- `merchantPlatform`
- `seller`
- `sellerDisplayName`
- `price`
- `priceCurrency`
- `stockStatus`
- `stockText`
- `inStock`
- `sellerUrl`
- `offerUrl`
- `redirectUrl`
- `targetUrl`

Alan anlami:

- `url`: offer nesnesindeki ana baglanti alani
- `redirectUrl`: Akakce veya Cimri yonlendirme linki
- `targetUrl`: son magaza linki biliniyorsa burada doner

## Notlar

- `productKey`, arama sonucundan donen degerdir.
- Direkt urun linki kullanmak istersen `by-url` endpointlerini kullanabilirsin.
- `by-url` endpointi su anda sadece `Akakce` ve `Cimri` urun linklerini kabul eder.
- En sade fiyat, satici ve stok listesi icin `sales` endpointlerini kullan.
- `Akakce` tarafinda urun detaylari agirlikli olarak `JSON-LD` ve ic teklif endpointi uzerinden okunur.
- `Cimri` tarafinda tam teklif listesi agirlikli olarak tarayici icindeki hydrate state yani `window.__NEXT_DATA__` uzerinden cikartilir.
- `Akakce` icin `redirectUrl` genelde Akakce tracking linkidir.
- `Cimri` icin `redirectUrl` genelde `https://www.cimri.com/offer/...` formatinda doner.
- `targetUrl` alani su an garanti degildir. Ozellikle `Cimri` tarafinda Cloudflare nedeniyle cogunlukla `null` kalir.
- `cursor-test.http` dosyasindaki `productKey` degerleri ornek degerlerdir. Arama sonucundan gelen yeni key'lerle degistirebilirsin.
