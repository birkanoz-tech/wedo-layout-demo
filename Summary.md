# ProposalApp - Progress & Summary

## 1. Summary
Bu proje, XML tabanlı teklif/proposal verilerinin yapısını anlamaya ve mevcuttaki 3D yerleşim/konveyör mantığını doğru şekilde yüklemeye odaklanır.

### Ana hedefler
- XML veri yapısını anlamak
- Ürün ve assembly düzenini çözmek
- Konum/yönelim bilgilerini yorumlamak
- Benzer ürün gruplarını tanımlamak
- 3D modelleri kütüphaneden doğru kural ve parametrelerle yüklemek

---

## 2. Progress
### Başlangıç aşaması
- Proje klasörü tanımlandı.
- Çalışma alanı hazırlandı.
- Ana veri dosyası olarak `OPP-0106989-1-R1.xml` incelenmeye başlandı.
- Conveyor ürün yapısı ve `position` alanlarının işlevi araştırıldı.

### Gözlemlenenler
- Her `assembly`, bir conveyor sistemini temsil eder.
- `products` ana ürünleri içerir.
- `miscproducts` ek destek/yardımcı parçaları içerir.
- `chain` ve `sliderails` mekanik altyapıyı tanımlar.
- `position` alanları ürünün yerini ve oryantasyonunu verir.
- `productgroup`, `producttype`, `productno`, `length`, `angle`, `radius` alanları sistematik şekilde kullanılır.

---

## 3. Current Findings
- XML yapısı net bir şekilde okunuyor.
- Ürünler ve yardımcı parçalar organize bir şekilde ayrılmış durumda.
- Konum ve yönelim bilgileri 3D sahnede tam matris ile işleniyor.

---

## 5. Date
- 2026-08-16

---

## 6. End Drive yerleşimleri (Madde 7)

**Koddaki Konum**: [`index.html: L1271-L1310`](index.html#L1271-L1310) (`getDriveModelFileForTemplate` fonksiyonu)

Motor'un Genel Kodları:

        <productno>XBEB A180</productno>
        <zeropackageproductno>XBEB 0A180HNRP</zeropackageproductno>

        <productno>XHEB</productno>
        <zeropackageproductno>XHEB 0 HNRP</zeropackageproductno>

HTML dosyasında öncelikle `<producttemplate>` tanımlanır. Template içerisinden <productno> <zeropackageproductno> parametreleri okunup motor olduğu teyt edilir.

<inventorparameters> içerisinden `motor_position` parametresi okunur.

Bu aşamada modeli doğru platformdan çekmemiz ve "L/R" motor position u doğru göstermemiz yeterli:

- **`Right`**: 
`Library/XBEBA180HNRP.glb` çağrılır. ([`index.html: L1299`](index.html#L1299))
'Library/XHEB0HNRP.glb' çağrılır.



- **`Left`**: 
`Library/XBEBA180HNLP.glb` çağrılır. ([`index.html: L1299`](index.html#L1299))
'Library/XHEB0HNLP.glb' çağrılır.
---

## 7. Conveyor Bends / Dönüş Parçaları (Madde 8)

**Koddaki Konum**: [`index.html: L1350-L1437`](index.html#L1350-L1437) (`getModelAssetPath` bend eşleştirmeleri), `library_assets.js` (`EMBEDDED_GLB_ASSETS`) ve [`index.html: L2017-L2045`](index.html#L2017-L2045) (`isBendProduct` ve `createProductMesh` rotasyon bloğu)

Conveyor bend (kıvrım) parçaları, doğrusal taşıyıcı parçalarının yönünü değiştiren ve açı/yarıçap bilgisiyle tanımlanan ürünlerdir.
`<XBBP>` ve `<XHBP>` ile başlayan tüm ürün kodları bend ürünleridir. Bunlar için kütüphanedeki eşleşen modeller yüklenir.

### Kütüphanedeki Tüm Bend Modelleri & Gömülü Varlıklar:

1. **`XBBP` Platformu (X180) Bends (12 Adet Model)**:
   - XML `<productno>` formatı: `XBBP {Açı}A180R{Yarıçap}` (Örn: `XBBP 90A180R7`, `XBBP 90A180R5`, `XBBP 30A180R10`, vb.)
   - Kütüphanedeki GLB dosyaları: `Library/FlexLink XBBP {Açı}A180R{Yarıçap}.glb`
   - **`library_assets.js` içerisine gömülen varlıklar**: 12 adet `XBBP` GLB modelinin tamamı base64 formatında `window.EMBEDDED_GLB_ASSETS` nesnesine aktarılmıştır.
   - Desteklenen Kombinasyonlar:
     - **30° Bends**: `FlexLink XBBP 30A180R5.glb`, `FlexLink XBBP 30A180R7.glb`, `FlexLink XBBP 30A180R10.glb`
     - **45° Bends**: `FlexLink XBBP 45A180R5.glb`, `FlexLink XBBP 45A180R7.glb`, `FlexLink XBBP 45A180R10.glb`
     - **60° Bends**: `FlexLink XBBP 60A180R5.glb`, `FlexLink XBBP 60A180R7.glb`, `FlexLink XBBP 60A180R10.glb`
     - **90° Bends**: `FlexLink XBBP 90A180R5.glb`, `FlexLink XBBP 90A180R7.glb`, `FlexLink XBBP 90A180R10.glb`

2. **`XHBP` Platformu (XH) Bends**:
   - XML `<productno>` formatı: `XHBP {Açı}R{Yarıçap}` (Örn: `XHBP 30R500`, `XHBP 60R500`, `XHBP 90R500`)
   - **`library_assets.js` ve Kütüphane Dönüşümleri**: `PARTcommunityBriefcase` içerisindeki CAD modellerinden `FlexLink XHBP 30R500.glb`, `FlexLink XHBP 60R500.glb` ve diğer tüm açılardaki GLB modelleri oluşturulmuş ve `library_assets.js` dosyasına base64 olarak gömülmüştür.
   - Her ürün kendi açısına tam karşılık gelen GLB modelini yükler (30° için `XHBP 30R500.glb`, 60° için `XHBP 60R500.glb`, 90° için `XHBP90R500.glb`).

### Yönelim & Rotasyon Mantığı:
Bend yerleşimlerini yaparken XML'deki `<benddirection>` detayına bakılır:
- **`Right`**: Standart açı ve matris pozisyonunda yerleştirilir.
- **`Left`**: X ekseni etrafında 180 derece döndürülerek (`partModel.rotateX(Math.PI)`) yerleştirilir. ([`index.html: L2036-L2041`](index.html#L2036-L2041))

---

## 8. Beam Yerleşimleri / Profil Uzunluk Ölçekleme & Koordinat Yerleşimi (Madde 9)

### 📌 Uzunluk (`<length>`) İçeren Model Kodları Listesi (XML İncelemesi):
XML dosyasında (`OPP-0106989-1-R1.xml`) `<length>` veya `<lengthasdouble>` parametresi içeren profil modelleri şunlardır:
1. **`XHCB L` / `XHCB`** (Platform: `XH` | Ürün Tipi: `CB01` | **96 Adet**) -> `Library/XHCB L.glb`
2. **`XBCB LA180` / `XBCB`** (Platform: `X180` | Ürün Tipi: `CB01` | **53 Adet**) -> `Library/XBCB LA180.glb`

*Yazılım Mantığı: Kod tarafında `product.length` değeri tanımlı ve sıfırdan büyük olan tüm modeller (`desiredLengthMm > 0`) otomatik olarak tespit edilip aşağıdaki ölçekleme mantığına tabi tutulur.*

**Koddaki Konum**:
- Eksen Ölçekleme: [`index.html: L1880-L1906`](index.html#L1880-L1906) (`loadPartModel` fonksiyonu)
- Konum & Matris Ayrıştırma: [`index.html: L1099-L1133`](index.html#L1099-L1133) (`parsePosition` fonksiyonu)
- 3D Sahnede Konumlandırma: [`index.html: L1936-L1940`](index.html#L1936-L1940) (`createProductMesh` fonksiyonu)

### A. Uzunluk Ölçekleme Mantığı
1. Kütüphanedeki `Library/XHCB L.glb` (veya ilgili profil) modeli çağrılır. ([`index.html: L1317-L1318`](index.html#L1317-L1318))
2. Modelin 1mm boyutundaki profil uzunluk ekseni tespit edilir (`lengthAxis`). ([`index.html: L1886-L1896`](index.html#L1886-L1896))
3. Yalnızca 1mm gelen bu eksen XML `<length>` veya `<lengthasdouble>` değeri (Örn: 180mm, 3000mm) ile çarpılarak (`MODEL_SCALE * (desiredLength / axisSize)`) boylamasına uzatılır. ([`index.html: L1898-L1902`](index.html#L1898-L1902))
4. Profilin kesit boyutları (genişlik/yükseklik) bozulmadan orijinal 1/1000 oranında muhafaza edilir.

### B. Profilin Hangi Koordinatlara ve Yönelime Yerleştirileceği

Profil parçalarının sahnede nereye ve hangi açıyla yerleştirileceği XML `<position>` etiketinden okunur:

1. **Konum Koordinatları (`px, py, pz`)**:
   * XML `<position>` etiketindeki `px`, `py`, `pz` milimetre cinsinden dünya koordinatlarıdır.
   * Three.js metre ölçeğine uymak için 1000'e bölünerek pozisyon vektörü oluşturulur:
     * `x = px / 1000`
     * `y = py / 1000`
     * `z = pz / 1000` ([`index.html: L1123-L1127`](index.html#L1123-L1127))

2. **Yönelim Vektörleri ve Rotasyon Matrisi (`nx,ny,nz`, `ox,oy,oz`, `ax,ay,az`)**:
   * Profilin uzaydaki oryantasyonunu belirlemek için XML'den gelen 3 dik taban vektörü oluşturulur:
     * `basisX = Vector3(nx, ny, nz).normalize()` (Profilin X ekseni doğrultusu)
     * `basisY = Vector3(ox, oy, oz).normalize()` (Profilin Y ekseni doğrultusu)
     * `basisZ = Vector3(ax, ay, az).normalize()` (Profilin Z ekseni doğrultusu) ([`index.html: L1118-L1120`](index.html#L1118-L1120))
   * Bu taban vektörleri ile 4x4 rotasyon matrisi oluşturulur (`Matrix4().makeBasis(basisX, basisY, basisZ)`).
   * Matristen 3D rotasyon `Quaternion` nesnesi hesaplanır. ([`index.html: L1119-L1120`](index.html#L1119-L1120))

3. **3D Sahnede Uygulama**:
   * Profil nesnesine hesaplanan koordinat ve rotasyon atanır:
     `group.position.set(product.position.x, product.position.y, product.position.z);`
     `group.quaternion.copy(product.position.quaternion);` ([`index.html: L1938-L1939`](index.html#L1938-L1939))

---

## 9. Conveyor Vertical Bends / Düşey Dönüş Parçaları (Madde 10)

**Koddaki Konum**:
- XML `<productcode>` & `<productno>` Ayrıştırma: [`index.html: L1143 - L1185`](index.html#L1143-L1185) (`collectProductsFromContainer` fonksiyonu)
- Birebir Model Haritası & Dinamik Eşleştirme: [`index.html: L1395 - L1475`](index.html#L1395-L1475) (`EXACT_LIBRARY_MODEL_MAP` ve `getModelAssetPath` fonksiyonu)
- Yönelim & Rotasyon (`benddirection` down): [`index.html: L2090 - L2115`](index.html#L2090-L2115) (`createProductMesh` fonksiyonu)
- Gömülü Varlıklar: `library_assets.js` (`window.EMBEDDED_GLB_ASSETS`)

Vertical bendler, conveyor sisteminde yüksekliği değiştiren dikey dönüş parçalarıdır. XML içindeki `<productno>` veya `<productcode>` etiketinden okunarak ilgili GLB modeli yüklenir.

### Kütüphanedeki Dikey Bend Modelleri & Gömülü Varlıklar:

1. **`XBBV` Platformu (X180) Bends**:
   - XML etiket formatı: `XBBV {Açı}A180R{Yarıçap}` (Örn: `XBBV 15A180R750`, `XBBV 45A180R750`, `XBBV 5A180R750`)
   - Kütüphanedeki GLB dosyaları: `Library/FlexLink XBBV {Açı}A180R{Yarıçap}.glb`
   - `library_assets.js` dosyasına Base64 formatında tam olarak gömülmüştür.

2. **`XHBV` Platformu (XH) Bends**:
   - XML etiket formatı: `XHBV {Açı}R{Yarıçap}` (Örn: `XHBV 5R400`, `XHBV 7R400`, `XHBV 15R400`, `XHBV 30R400`, `XHBV 45R400`, `XHBV 60R400`, `XHBV 90R400`, `XHBV 45R1000`, `XHBV 90R1000`)
   - Kütüphanedeki GLB dosyaları: `Library/FlexLink XHBV {Açı}R{Yarıçap}.glb`
   - `library_assets.js` dosyasına Base64 formatında aktarılmıştır.

### Yönelim & Rotasyon Mantığı (`<benddirection>`):
XML etiketinden okunan `<benddirection>` bilgisine göre:
- **`Up`**: Standart oryantasyon ve dünya koordinat matrisinde yerleştirilir.
- **`Down`**: X ekseni etrafında 180 derece döndürülerek (`partModel.rotateX(Math.PI)`) yerleştirilir. ([`index.html: L2111-L2113`](index.html#L2111-L2113))

---

## 11. Ceiling Support / Tavan Askı Destekleri & `top_of_chain` Origin Yüksekliği (Madde 11)

**Koddaki Konum**:
- Template & `top_of_chain` Ayrıştırma: [`index.html: L1067 - L1085`](index.html#L1067-L1085) (`parseProductTemplates` fonksiyonu)
- Nesne Ağacı İsimlendirmesi ("Ceiling Support"): [`index.html: L1158 - L1175`](index.html#L1158-L1175) (`collectProductsFromContainer` fonksiyonu)
- `top_of_chain` Z Koordinatı Atama: [`index.html: L1165 - L1171`](index.html#L1165-L1171) (`collectProductsFromContainer` içinde Z yüksekliği güncellemesi)
- 3D Model Origin & Yerleşim: [`index.html: L2025 - L2053`](index.html#L2025-L2053) (`createCeilingSupportProceduralMesh` & `loadPartModel`)

XML dosyasında `<producttemplate>` etiketleri altında `<cadblockname>Ceiling support</cadblockname>` olarak tanımlanan ve montajlar içinde `<templateguid>` ile çağrılan parçalar için:

### Yapılan Geliştirmeler & İşleyiş:
1. **Nesne Ağacı İsimlendirmesi (Viewport Object Tree)**:
   - Şablon (`template`) veya ürün tanımında `cadblockname` içerisinde `ceiling support` geçen tüm 205 parça tespit edildi.
   - Nesne Ağacında (Tree View) ham GUID numaraları (`44d1dd75-7666-4054-8b6f-8e05f8ac3ec6` vb.) gösterimi yerine bu ürünlerin adı doğrudan **`Ceiling Support`** olarak düzenlendi.
2. **`top_of_chain` Z Koordinatı & Origin Yüksekliği (Top_of_chain - 46.5 mm)**:
   - XML şablonları ve ürün parametrelerindeki `<inventorparameter name="top_of_chain" value="..." />` parametresi okundu.
   - Konveyör dikey iniş (down vertical bend) yaptıktan sonra konveyör yüksekliği düştüğünde, bağlı Ceiling Support parçalarının Z yüksekliğinin sabit kalması önlendi.
   - Her Ceiling Support nesnesi, kendi attribüt/parametresinde bulunan `Top_of_chain` değerinin **46,5 mm aşağısına** denk gelecek şekilde Three.js metre ölçeğinde Z yüksekliğine yerleştirildi:
     `position.z = (topOfChain - 46.5) / 1000` (Metre cinsinden).
   - Böylece dikey dönüşlerden sonra alt seviyeye inen konveyörlerdeki tüm Ceiling Support modelleri (örneğin 28.8m'den 24.7m veya 18.0m'ye inen hatlarda) kendi zincir tepe noktasının tam 46.5 mm altındaki doğru Z yüksekliklerine konumlandırıldı.
3. **3D Model Bağlantısı & Sahnede Yerleşim**:
   - Modelin orijin noktası (0, 0, 0) alt bağlantı braketi (konveyör bağlantı noktası) olarak ayarlandı; destek çubuğu orijinden yukarıya (tavan yönüne) doğru uzatıldı.
   - Her 205 Ceiling Support modeli sahnede ilgili konveyörün bağlandığı tam Z yüksekliğinde gösterildi.

4. **Parametrik Model Tasarım Ekranı (`<Ceiling Support Tasarla>`) & `BeamCenterToRod` Ekstrüzyonu**:
   - Sol menü paneline **`🏗️ Ceiling Support Tasarla`** parametrik tasarım butonu eklendi.
   - Kütüphanedeki 1 mm boyutlu **`FlexLink XCBL 1X44X88.glb`** profil modeli `library_assets.js` içerisine Base64 olarak gömüldü.
   - **Simetrik Ekstrüzyon Mantığı (`BeamCenterToRod`)**:
     - `BeamCenterToRod` değeri profilin her iki yöne doğru uzama mesafesini ifade eder. Örn: `BeamCenterToRod = 300` ise profil merkezden hem **+X yönünde 300 mm**, hem de **-X yönünde 300 mm** ekstrüde edilerek toplam **600 mm** profil uzunluğu elde edilir.
     - Çok hatlı konveyörlerde toplam profil boyu `(hat_sayısı - 1) * cc_distance + 2 * BeamCenterToRod` olarak simetrik hesaplanır.
   - Modal içerisinde canlı 3D tuval (`#cs-preview-container`) ile anlık parametrik önizleme oluşturuldu.

5. **Model Kütüphanesi (`Model Library`) & Sağ Tık İle Parametrik Ceiling Support Ekleme**:
   - Viewport üzerindeki **Model Kütüphanesi** paneline (`Wall` modelinin altına) **`Ceiling Support (Parametric)`** eklendi.
   - Kütüphane kartı üzerinde **sağ tık > Ekle** yapıldığında sahnede bakılan hedef koordinata (ve tanımlı `top_of_chain` Z yüksekliğine) yeni bir parametrik Ceiling Support nesnesi yerleştirilir.
   - Gerek model kütüphanesinden eklenen gerekse XML dosyasından içeri aktarılan (205 adet) tüm Ceiling Support modelleri tam parametrik yapıya kavuşturuldu. Dikey askı mili (Rod) seçenekleri ve çizim kodları Ceiling Support modelinden tamamen kaldırıldı (Rod'lar daha sonra ayrı askı modelinde parametrik yapılacaktır). 3D sahnede herhangi bir Ceiling Support tıklandığında sağ panelde dinamik **Parametric Ceiling Support Ayarları** editörü açılır; Hat sayısı, profil tipi, C-C mesafesi, BeamToRod ve Z yüksekliği (`top_of_chain`) değiştirildiği anda 3D sahnede canlı ve anlık olarak güncellenir.

6. **Ceiling Support Eksen Hizalaması (+Z -> -Y ve +Y -> +X Rotasyonu)**:
   - Tüm Ceiling Support modellerinin (`XML` dosyasından yüklenen 205 adet parça, Model Kütüphanesinden eklenen yeni modeller ve parametrik güncellemeler) local +Z ekseninin -Y yönüne, +Y ekseninin +X yönüne bakmasını sağlamak amacıyla `generateParametricCeilingSupportMesh` ana mesh üretim fonksiyonuna **X ekseninde -90° (`rotateX(-Math.PI / 2)`)** ve **Y ekseninde -90° (`rotateY(-Math.PI / 2)`)** rotasyonu kalıcı kural olarak uygulandı.

7. **Ceiling Support Konveyör Profil Z Konum Hizalaması, XLCT Braket Yerleşimi & Tekil Model İzolasyonu**:
   - **Tekil Model Güncelleme İzolasyonu**: Sahnede belirli bir Ceiling Support seçilip detaylı tasarım modalı (`modal-ceiling-support-designer`) açıldığında, form verileri doğrudan o seçili modelin parametreleriyle dolar ve "Uygula" butonuna basıldığında değişiklikler toplu olarak tüm parçalara değil, **yalnızca seçilmiş olan tekil Ceiling Support modeline** uygulanır.
   - **Origin Z Konum Hizalaması**: XML dosyasından proje aktarılırken Ceiling Support elemanlarının pozisyonu `Z=0`'a düşmemesi için, montaj grubunda (`assembly`) yer alan bağlı konveyör profillerinin gerçek dikey Z yüksekliği (`position.z`) otomatik tespit edilerek Ceiling Support nesnelerinin dikey Z konumuna birebir eşitlendi.
   - Parametre ayarlarında braket yüksekliği için 3 seçenek sunuldu:
     - `100 mm` -> **`XLCT 11X100 C`**
     - `135 mm` -> **`XLCT 21X135 B`**
     - `158 mm` -> **`XLCT 21X158 R`**
   - Her konveyör hattı için **2 adet braket modeli** yerleştirilir ve taban kısımlarının ön yüzleri birbirine bakacak şekilde (yalnızca Z rotasyonu ile) konumlandırılır.
   - **Doğal +Z Yönü Hizalaması**: Ana Ceiling Support grubunun en sonda uyguladığı (-90° X, -90° Y) grup rotasyonunu tam olarak nötralize etmek için braket kapsayıcı grubuna ters rotasyon (`rotateY(Math.PI / 2)` ve `rotateX(Math.PI / 2)`) uygulanır. Böylece braketler sahnede tek başına eklendiklerindeki doğal dik **+Z** yönü ile birebir aynı konumda dururlar.
   - 2 braket arasındaki mesafe `platformType` değerine göre dinamik belirlenir:
     - **XH**: 105 mm
     - **X180**: 180 mm
     - **X300**: 300 mm

8. **Parametrik Elektrik & PLC Kontrol Panosu (Sabit Sol Özellikler Paneli & Çizim Motoru)**:
   - **Sabit Sol Özellikler Paneli (`#fixed-left-properties-panel`)**: Otomatik açılır modal rahatsız ediciliği kaldırıldı. Ana sol menüdeki kalabalığı tamamen önlemek amacıyla **tüm parametre editörleri (`#parametric-editor`: Duvar, Ceiling Support, Pano)** ve nesne özellikleri tek bir sabit **⚙️ Model Özellikleri (Properties)** paneli içine taşındı. Sahnede herhangi bir model seçildiğinde tüm özellikleri ve canlı parametre girdileri bu panelde görüntülenip anında 3D sahnede güncellenir.
   - Model Kütüphanesine (`MANUAL_LIBRARY_MODELS` ve Model Kütüphanesi panosuna) **`Parametrik PLC Kontrol Panosu`** seçeneği eklendi.
   - **Eksen Rotasyonu (+Y -> +Z)**: Modelin dik durma dikey ekseni X etrafında +90° (`group.rotateX(Math.PI / 2)`) döndürülerek sahne dikey ekseni olan **+Z** eksenine hizalandı.
   - **Çizim & Parametre Motoru (`generateParametricPanelMesh`)**:
     - **Gövde Boyutları**: Genişlik, Yükseklik, Derinlik ve Baza Yüksekliği mm cinsinden dinamik boyutlandırılır.
     - **Pano Rengi**: RAL 7035 Endüstriyel Gri, RAL 7016 Antrasit veya RAL 5012 Mavi renk seçenekleri.
     - **Kapak Seçenekleri**: Tek Kapaklı, Çift Kapaklı veya Cam Pencereli Kapak.
     - **Çatı Tipi Parametresi (`roofType`)**: Gıda ve hijyenik tesis standartlarına uygun olarak **Eğimli Çatı (`sloped` / Angled Top)** seçeneği eklendi (Arka duvarda yüksek, ön kapağa doğru eğimli inen 3D kama çatı, toz ve sıvı birikmesini engeller). İkaz lambası arka tepe noktasına otomatik adapte edilir.
     - **Detay ve Aksesuarlar**:
        - **HMI Ekranı Hizalaması**: Tek kapak seçeneğinde kapak yatay ortasında (`X = 0`); çift kapak seçeneğinde birleşim çizgisi üzerine denk gelmemesi için **sol kapak yatay ortasında (`X = -widthM / 4`)** konumlandırılır.
        - **Acil Stop Butonu Hizalaması**: Ekranın hemen altında (`estopY`), kapak yatay ortasında (`doorCenterX`) hizalanır.

9. **Transform Gizmosu Rotasyon Modu, Manuel Açı Girdisi & Kısayollar**:
   - Sahnede herhangi bir model seçildiğinde sabit **Özellikler (Properties)** panelinde **`📍 Taşı (W)`**, **`🔄 Döndür (E/R)`** ve **`Açı Adımı`** kontrolleri görüntülenir.
   - **Rotasyon Gizmosu (`setTransformMode('rotate')`)**: 3D sahne üzerinde seçili model etrafında X, Y, Z eksenli 3D rotasyon halkaları belirir; halkalar sürüklenerek model serbestçe 3D uzayda döndürülebilir.
   - **Kademeli Açı Snap (`setRotationSnapStep`)**: Model döndürülürken hassas ve sabit açılarda kilitlenme sağlamak için **`5°`**, **`10°`**, **`15°` (varsayılan)**, **`30°`**, **`45°`**, **`90°`** veya **`Serbest (0°)`** açı adımı (snap step) seçenekleri eklendi.
   - **Manuel Canlı Açı Girdisi (`World Rotation (°)`)**: Sahnenin sağ üst köşesindeki **World Position** paneli altına **Açı X (°)**, **Açı Y (°)** ve **Açı Z (°)** kutuları eklendi. Butona gerek olmadan rakamlar değiştirildiği anda veya klavyeden yazıldığı anda model 3D sahnede anlık (real-time) olarak döndürülür (`applySelectedWorldRotation`).
   - **Klavye Kısayolları**: `W` tuşu ile **Taşıma**, `E` veya `R` tuşu ile **Rotasyon** gizmosu moduna anında geçiş sağlanır.

---

## 10. Koda Tek Tıklama İle Yönlendirme Haritası


| İşlev / Kural | Tıklanabilir Bağlantı (İlgili Satır) | Açıklama |
| :--- | :--- | :--- |
| **Birebir Model Haritası** | [`index.html: L1365 - L1408`](index.html#L1365-L1408) | `EXACT_LIBRARY_MODEL_MAP` sözlüğü (GLB eşleştirme) |
| **Motor L/R Seçimi (Madde 7)** | [`index.html: L1318 - L1360`](index.html#L1318-L1360) | `getDriveModelFileForTemplate` (HNLP vs HNRP GLB seçimi) |
| **Horizontal Bend Rotasyonu (Madde 8)** | [`index.html: L2108 - L2114`](index.html#L2108-L2114) | `createProductMesh` içinde `benddirection === 'left'` için 180° rotasyon |
| **Vertical Bend Modelleri (Madde 10)** | [`index.html: L1395 - L1475`](index.html#L1475-L1475) | `EXACT_LIBRARY_MODEL_MAP` & `getModelAssetPath` (`XBBV` & `XHBV`) |
| **Vertical Bend Rotasyonu (Madde 10)** | [`index.html: L2108 - L2114`](index.html#L2108-L2114) | `createProductMesh` içinde `benddirection === 'down'` için 180° rotasyon |
| **Profil Koordinat Ayrıştırma (Madde 9)** | [`index.html: L1099 - L1133`](index.html#L1099-L1133) | `parsePosition` (px,py,pz ve nx,ny,nz matris çözümü) |
| **Profil Uzunluk Ölçekleme (Madde 9)** | [`index.html: L2069 - L2075`](index.html#L2069-L2075) | `loadPartModel` içinde 1mm uzunluk ekseninin `<length>` ile ölçeklenmesi |
| **Ceiling Support Şablon Tespiti (Madde 11)** | [`index.html: L1067 - L1080`](index.html#L1067-L1080) | `parseProductTemplates` içinde `<cadblockname>` Ceiling Support kontrolü |
| **Ceiling Support Nesne Ağacı İsmi (Madde 11)** | [`index.html: L1158 - L1175`](index.html#L1158-L1175) | `collectProductsFromContainer` içinde GUID yerine "Ceiling Support" atanması |
| **Ceiling Support `top_of_chain` Z Yüksekliği (Madde 11)** | [`index.html: L1165 - L1171`](index.html#L1165-L1171) | `top_of_chain` parametresi ile Z yüksekliğinin (`position.z`) güncellenmesi |
| **Ceiling Support `XCBL 1X44X88` Simetrik Ekstrüzyon (Madde 11)** | [`index.html: L2030 - L2090`](index.html#L2030-L2090) | `generateParametricCeilingSupportMesh` içinde `FlexLink XCBL 1X44X88.glb` modelinin +X / -X ekstrüzyonu |
| **Ceiling Support Eksen Hizalaması (+Z -> -Y, +Y -> +X)** | [`index.html: L2320 - L2325`](index.html#L2320-L2325) | `generateParametricCeilingSupportMesh` içinde `rotateX(-Math.PI/2)` ve `rotateY(-Math.PI/2)` |
| **Ceiling Support XLCT Braket (100/135/158 mm)** | [`index.html: L1370 - L1395`](index.html#L1370-L1395) | `MANUAL_LIBRARY_MODELS` listesinde yerelleştirilmiş 3 adet braket modeli (100mm, 135mm, 158mm) |
| **Ceiling Support Kütüphanesi & Sağ Tık Ekle** | [`index.html: L175 - L185`](index.html#L175-L185) | Model Kütüphanesinde `Ceiling Support` kartı, Sağ Tık > Ekle ve Parametrik Editör |
| **Ceiling Support Parametrik Tasarım Modalı (Madde 11)** | [`index.html: L3490 - L3600`](index.html#L3490-L3600) | `<Ceiling Support Tasarla>` butonu, Dropdown parametreler & Canlı 3D Önizleme |
| **`file://` Otomatik XML Yükleme** | [`index.html: L3019 - L3040`](index.html#L3019-L3040) | `loadDefaultXmlProject` içinde `EMBEDDED_DEFAULT_XML` yedeklemesi |

---

## 11. Sürümlendirme ve Yedekleme (Versioning)

- **Versiyon 1.0.0 (Yedek - Baseline)**:
  - Ürün kütüphanesi, build path dinamikleri, ceiling support desteği, motor L/R yönlendirmeleri, 3D rotasyon gizmosu ve açı snap özellikleri tamamlandı.
  - Baseline Yedek Dosyası: [`index_v1.0.0.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index_v1.0.0.html)

- **Versiyon 1.0.1 (Aktif Geliştirme Sürümü)**:
  - Ana Çalışma Dosyası: [`index.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index.html)
  - Versiyon Dosyası: [`index_v1.0.1.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index_v1.0.1.html)

---

## 🚀 Versiyon 1.0.1 - Değişiklik Günlüğü (Release Notes)

Bu başlık altındaki tüm maddeler **v1.0.1** sürümü kapsamında gerçekleştirilmiş ve gerçekleştirilecek olan değişiklikleri temsil eder:

1. **Sürüm Altyapısı ve Dosya Ayrıştırma**:
   - `v1.0.0` durumu dondurularak [`index_v1.0.0.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index_v1.0.0.html) olarak yedeklendi.
   - `v1.0.1` geliştirmeleri için hem [`index_v1.0.1.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index_v1.0.1.html) yeni sürüm dosyası oluşturuldu hem de ana [`index.html`](file:///c:/Users/Birkan/OneDrive/_Home%20PC%20Shared/Training_Phyton/ProposalApp/index.html) dosyası güncellendi.

2. **Arayüz (UI) Rozeti ve Başlık Güncellemesi**:
   - Doküman başlığı (`<title>`) **`3D FlexLink Yerleşim & Otomatik Teklif Uygulaması v1.0.1`** olarak güncellendi.
   - Sol üst araç çubuğundaki ana başlığa **`v1.0.1`** stilize rozeti (badge) entegre edildi.

3. **Manuel Path Çiziminin Kaldırılması & Otomatik Konveyör Takip Sistemine Geçiş**:
   - Kullanıcı talebi doğrultusunda manuel polyline path çizim aracı temizlendi.
   - Yerine doğrudan konveyör hattındaki modüllerin (giriş/çıkış uçlarının) topolojisini kullanan **Otomatik Akıllı Kablo Güzergahı Altyapısı (`buildSequentialConveyorCableRoute`)** geliştirildi.

4. **Otomatik Konveyör Sıralı Kablo Güzergahı Algoritması (`drawCableRoutesFromPanel`)**:
   - **Pano Yükselmesi (+Z)**: Elektrik panosu eklendiğinde panonun Origin noktasından en yakın konveyör yüksekliğine dik `+Z` yönünde çıkılır.
   - **En Yakın Giriş Modülüne Bağlantı**: Panoya en yakın konveyör modülü tespit edilerek yükseltilen kablo hattı bu modüle kilitlenir.
   - **Sıralı Konveyör Takibi (İleri/Geri Yönde Traversal)**: Kablo hattı, konveyör hattını olustatran modülleri (düz, dönüş, tahrik vb.) dizilim sırasına göre (giriş modülünden hedef motor modülüne kadar ileri veya geri yönde) **birebir takip ederek** 3D uzayda çizilir.
   - **Gerçekçi Metraj & Terminal İndikasyonları**: Panodan Motora giden kablo kanalının gerçek 3D mesafesi hassas olarak hesaplanır (%10 bolluk marjı ile) ve metraj panelinde dinamik gösterilir.

5. **Spesifik Pano Kodlama & Motor Eşleştirme (Panel Tagging & Cable Pairing Modal)**:
   - **Model Kütüphanesi İle Tam Entegrasyon (`registerPlacedPanelMesh`)**: Sahnede Pano ekleme işlemi halihazırda mevcut olan Model Kütüphanesi (GLB / Parametrik Pano Tasarımcısı) ile tam entegre çalışır. Kütüphaneden eklenen her Pano modeli otomatik olarak algılanır.
   - **Otomatik Pano Kodlama (`PANO-01`, `PANO-02`)**: Sahnede oluşturulan her elektrik panosuna benzersiz ve spesifik bir model ID etiketi atanır.
   - **Yüzen 3D Pano Etiketi (`create3DPanoLabelSprite`)**: Panoların üzerinde 3D uzayda süzülen şık `⚡ PANO-01` etiket rozeti belirir.
   - **Eşleştirme Penceresi (`openCableLinkCreationDialog`)**: Kütüphaneden pano eklendiğinde veya "Kablo Bağlantısı" butonuna tıklandığında açılan pencereden kaynak Pano (`⚡ PANO-01`) ve hedef Motor (`🎯 Motor 01`) seçilerek eşleştirme tamamlanır.
   - **Kablo Link Listesi ve Metraj Tablosu (`updateCableLinksTableUI`)**: Tüm pano-motor bağlantıları listede gösterilir, bağımsız kablo uzunlukları ve toplam proje metrajı dinamik olarak hesaplanır.

6. **Konveyör Hat Bazlı Detaylı Motor Tanımlaması & 3D Koordinat Etiketlemesi**:
   - **FlexLink XHEB / XBEB End Drive Unit Algılama**: Konveyör hatlarındaki gerçek motor üniteleri olan `XHEB` (XH End Drive Unit) ve `XBEB` (X180 End Drive Unit) modelleri 3D sahne ve XML ürün kataloğundan hassas olarak tespit edilir.
   - **Konveyör No & Model Kodu**: Eşleştirme penceresindeki hedef motor seçeneklerinde ilgili konveyör montaj hattı ve parça kodu bir arada gösterilir (örn: `🎯 [Conveyor_14] XHEBHNRP (Tahrik Ünitesi Motoru)`).
   - **3D Uzamsal Konum Etiketi**: Motorların sahnedeki hassas konum bilgileri `(X: 92.0m, Y: 14.1m, Z: 17.5m)` seçenekte gösterilerek sahnedeki doğru motor ünitesinin tereddütsüz seçilmesi sağlanır.
   - **Seçim Bildirimi**: Menüden motor seçildiğinde ekran üzerinde hangi konveyör motorunun seçildiği anlık olarak gösterilir.