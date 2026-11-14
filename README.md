# Memorial — Yerel Medya Arşiv Yöneticisi

> **Memorial** is a local desktop application for macOS (primary) and Windows (secondary) that organises photos and videos from an external exFAT HDD into a structured, searchable archive.  
> Built with **Tauri v2 · React 18 · TypeScript · Tailwind CSS v4 · Rust**.

---

## 🗂️ Mimari Genel Bakış / Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Memorial Desktop App                     │
│                                                              │
│  ┌─────────────────────────────┐  ┌───────────────────────┐  │
│  │   React 18 + TypeScript UI  │  │    Rust Backend        │  │
│  │   Tailwind CSS v4           │  │    Tauri v2 Commands   │  │
│  │   Zustand state             │  │                        │  │
│  │   React Router v6           │  │  analyzer.rs           │  │
│  │   Archivo / IBM Plex Mono   │  │  classifier.rs         │  │
│  │   Lucide Icons              │  │  mover.rs              │  │
│  └──────────┬──────────────────┘  │  duplicate.rs          │  │
│             │ invoke()            │  zip_handler.rs         │  │
│             └────────────────────>│  manifest.rs           │  │
│                                   └──────────┬─────────────┘  │
│                                              │                 │
│                                   ┌──────────▼─────────────┐  │
│                                   │   exFAT HDD             │  │
│                                   │   INBOX / STAGING       │  │
│                                   │   ARCHIVE / REVIEW      │  │
│                                   │   EDITS / .logs         │  │
│                                   └────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 HDD Klasör Yapısı / HDD Folder Structure

```
ROOT/  (exFAT HDD)
├── INBOX/                          ← Yeni medya buraya düşer
├── STAGING/                        ← ZIP çıkarma alanı
├── REVIEW/                         ← Belirsiz / düşük güvenli dosyalar
├── ARCHIVE/
│   └── YYYY/
│       ├── EVERYDAY/
│       │   └── YYYY-MM/            ← Adaptif: YYYY-MM-W1 yüksek hacimde
│       │       ├── Photos/
│       │       │   ├── Sony_a6700/
│       │       │   ├── Canon_6D/
│       │       │   ├── Canon_60D/
│       │       │   ├── Samsung_Note8/
│       │       │   ├── iPhone/
│       │       │   └── Unknown_Device/
│       │       └── Videos/
│       │           ├── Sony_a6700/
│       │           ├── iPhone/
│       │           └── Unknown_Device/
│       └── YYYY-MM-DD_EventName/
│           ├── Photos/
│           │   ├── Sony_a6700/
│           │   └── iPhone/
│           └── Videos/
│               └── iPhone/
└── EDITS/
    └── YYYY/
        └── YYYY-MM-DD_EventName/
            ├── Photos/
            ├── Videos/
            └── _source.json
```

---

## 🏷️ İsimlendirme Kuralları / Naming Rules

| Durum | Format | Örnek |
|---|---|---|
| Giresun günlük | `EVERYDAY/YYYY-MM/` | `EVERYDAY/2024-06/` |
| Giresun özel yer/gezi | `YYYY-MM-DD_EventName/` | `2024-06-14_Kumbet-Yaylasi/` |
| Şehir dışı seyahat | `YYYY-MM-DD_Şehir-Etkinlik/` | `2024-08-14_Istanbul-Yemek-Festivali/` |
| Bilinmeyen konum | `REVIEW/` | — |

---

## 🖥️ Ekranlar / Screens

### 1. Genel bakış
- En üstte tek cümlelik durum: kaç dosyanın dosyalanmayı beklediği
- Arşiv özeti: fotoğraf ve video sayısı, klasör sayısı, kapladığı yer
- Son taramada bulunan oturumlar, küçük resim şeritleriyle

### 2. Gelen
- Disk bağlıysa açılışta INBOX kendiliğinden taranır
- Yıl şeridi: oturumların yıl içindeki yeri
- Her oturum için zaman şeridi: her çizgi bir dosyanın çekildiği an
- Önerilen hedef klasör satır içinde düzenlenir
- Onayla (ayara göre kopyalar ya da taşır), oturumu aç, reddet
- Yüksek güvenli oturumları toplu onaylama

### 3. Oturum
- Bütün karelerin küçük resimleri, sayfalı
- Cihaz dağılımı, konum bilgisi olan dosyalar
- Hedef klasörü düzenleme, kopyala ya da taşı seçimi

### 4. İnceleme
- Bir oturuma yerleştirilemeyen dosyalar
- Filtreler: tarihi olmayanlar, cihazı bilinmeyenler, kendi içinde kopyalar
- Seçili dosyaları elle bir klasöre taşıma ya da silme

### 5. Arşiv
- ARCHIVE/ yapısının ağaç görünümü ve klasör adında arama
- Seçilen klasörün dosya sayısı ve alt klasörleri

### 6. Kopyalar
- Arşivde birebir aynı dosyalar (SHA-256) ve benzer görüntüler
- Çiftler küçük resimleriyle yan yana; kopyayı sil ya da ikisini de tut

### 7. Ayarlar
- Arşiv diski ve klasör adları, klasör yapısını oluşturma
- Varsayılan işlem (kopyala / taşı), ön kontrol, oturum aralığı
- Kopya tespiti seçenekleri, tema (ışık masası / karanlık oda)

Sürücü şeridi her ekranın üstünde durur: disk adı, doluluk ve bekleyen dosya sayısı.

---

## 🧠 Temel Mantık / Core Logic

### Çok Sinyalli Tespit
```
Katman 1 → Kendi EXIF meta verisi
Katman 2 → Klasör adı ayrıştırma
Katman 3 → Komşu dosya GPS'i (aynı oturumdan iPhone fotoğrafı)
Katman 4 → Zaman korelasyonu (±30 dk içindeki dosyalardan GPS)
Katman 5 → Cihaz davranış örüntüsü (iPhone GPS taşır, Sony taşımaz → ödünç al)
```

### Güven Skoru
| Sinyal Kombinasyonu | Güven | Eylem |
|---|---|---|
| EXIF GPS + klasör adı eşleşmesi | Yüksek | Otomatik taşı |
| EXIF GPS var, klasör yok | Yüksek | Otomatik taşı |
| Klasör adı + iPhone GPS korelasyonu | Orta | Otomatik taşı + kaydet |
| Sadece iPhone GPS korelasyonu | Orta | Otomatik taşı + kaydet |
| Sadece klasör adı | Düşük | Kullanıcıya sor |
| Sinyal yok | Yok | → REVIEW/ |

### Adaptif EVERYDAY Bölünmesi
- < 200 dosya/ay → `EVERYDAY/YYYY-MM/`
- 200-500 dosya/ay → `EVERYDAY/YYYY-MM/` (aylık)
- > 500 dosya/ay → `EVERYDAY/YYYY-MM-W1/`, `EVERYDAY/YYYY-MM-W2/` vb.

---

## 📦 Tech Stack

| Katman | Teknoloji |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React 18, TypeScript, Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v6 |
| Icons | Lucide React |
| Fonts | Archivo, IBM Plex Mono (uygulamaya gömülü) |
| Animations | Framer Motion |
| Backend | Rust |
| EXIF | kamadak-exif |
| Hashing | sha2, image (aHash) |
| Archive | zip crate |
| Config | serde_yaml |
| Time | chrono |
| File walking | walkdir |
| Thumbnails | EXIF önizlemesi, image, macOS Quick Look |

---

## ⬇️ İndirme / Download

Hazır sürümler [Releases](https://github.com/serdarsoylu06/memorial-/releases) sayfasındadır. macOS için `.dmg` dosyası Apple Silicon (M serisi) içindir.

Uygulama henüz Apple tarafından imzalanmadı. İlk açılışta macOS uyarı verir; açmak için **Sistem Ayarları › Gizlilik ve Güvenlik** bölümünün altındaki **Yine de Aç** düğmesini kullanın.

---

## 🚀 Geliştirme Kurulumu / Development Setup

### Gereksinimler / Prerequisites

**macOS:**
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Node.js (v20+)
brew install node
# Tauri CLI
cargo install tauri-cli --version "^2"
```

**Windows:**
```powershell
# Rust — https://rustup.rs
# Node.js — https://nodejs.org
# Microsoft C++ Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools
# Tauri CLI
cargo install tauri-cli --version "^2"
```

### Geliştirme / Development

```bash
# Depoyu klonla
git clone https://github.com/serdarsoylu06/memorial-.git
cd memorial-

# Bağımlılıkları kur
npm install

# Geliştirme modunda başlat
npm run tauri dev

# Arayüzü disk olmadan, örnek verilerle tarayıcıda aç
npm run dev:demo
```

### Derleme / Build

```bash
# macOS / Windows için üret
npm run tauri build
```

Çıktı: `src-tauri/target/release/bundle/`

---

## ⚙️ Yapılandırma / Configuration

### config.yaml

```yaml
hdd_root: "/Volumes/MyHDD"   # HDD bağlama noktası
operations:
  default_mode: copy           # copy | move
  dry_run_first: true          # her zaman önizle
  session_gap_hours: 2         # oturum bölünme eşiği
```

### rules/devices.yaml

Her cihaz için EXIF model/make, dosya adı önekleri ve video codec tanımlamaları.

### rules/locations.yaml

Giresun GPS sınır kutusu ve korelasyon penceresi ayarları.

---

## 🤝 Katkıda Bulunma / Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Commit Conventions
- `feat:` yeni özellik
- `fix:` hata düzeltme
- `docs:` dokümantasyon değişikliği
- `refactor:` yeniden yapılandırma
- `test:` test ekleme/değiştirme

---

## 📄 Lisans / License

MIT © serdarsoylu06
