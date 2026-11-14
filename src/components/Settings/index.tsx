import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";
import Button from "../ui/Button";
import { PageHeader, Segmented, Toggle, inputClass } from "../ui/Page";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-x-8 gap-y-2 py-7 border-b border-edge last:border-b-0">
      <h2 className="display text-xl m-0">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5 border-b border-edge/60 last:border-b-0 first:pt-0">
      <div className="min-w-0">
        <p className="m-0">{label}</p>
        {hint && <p className="text-xs text-dim m-0 mt-0.5 max-w-[48ch]">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">{children}</div>
    </div>
  );
}

type InitStatus = { ok: boolean; text: string } | null;

export default function Settings() {
  const { settings, setSettings } = useAppStore();
  const [initStatus, setInitStatus] = useState<InitStatus>(null);

  const pickFolder = async (apply: (path: string) => void) => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") apply(selected);
    } catch (err) {
      console.error(err);
    }
  };

  const createFolders = async () => {
    try {
      const dirs = [
        settings.inbox_dir.startsWith("/") ? "" : settings.inbox_dir,
        settings.archive_dir,
        settings.edits_dir,
        settings.review_dir,
        settings.staging_dir,
      ].filter(Boolean);
      const created = await invoke<string[]>("init_folder_structure", {
        hddRoot: settings.hdd_root,
        dirs,
      });
      setInitStatus({
        ok: true,
        text: created.length > 0 ? `${created.length} klasör oluşturuldu.` : "Klasörlerin hepsi zaten var.",
      });
      setTimeout(() => setInitStatus(null), 4000);
    } catch (err) {
      setInitStatus({ ok: false, text: `Klasörler oluşturulamadı: ${err}` });
    }
  };

  return (
    <div className="max-w-[820px]">
      <PageHeader title="Ayarlar" status="Değişiklikler kendiliğinden kaydedilir." />

      <Section title="Disk">
        <Row label="Arşiv diski">
          <span className="font-mono text-[13px] text-dim truncate max-w-[240px]" title={settings.hdd_root}>
            {settings.hdd_root || "Seçilmedi"}
          </span>
          <Button onClick={() => void pickFolder((p) => setSettings({ hdd_root: p }))}>
            {settings.hdd_root ? "Değiştir" : "Disk seç"}
          </Button>
        </Row>
        <Row label="Gelen klasörü" hint="Yeni fotoğraf ve videoların bırakıldığı, taramanın baktığı klasör.">
          <span className="font-mono text-[13px] text-dim truncate max-w-[240px]" title={settings.inbox_dir}>
            {settings.inbox_dir || "Seçilmedi"}
          </span>
          <Button onClick={() => void pickFolder((p) => setSettings({ inbox_dir: p }))}>Değiştir</Button>
        </Row>
        <Row label="Arşiv klasörü">
          <input
            aria-label="Arşiv klasörü"
            value={settings.archive_dir}
            onChange={(e) => setSettings({ archive_dir: e.target.value })}
            className={`${inputClass} w-36 font-mono`}
          />
        </Row>
        <Row label="İnceleme klasörü">
          <input
            aria-label="İnceleme klasörü"
            value={settings.review_dir}
            onChange={(e) => setSettings({ review_dir: e.target.value })}
            className={`${inputClass} w-36 font-mono`}
          />
        </Row>
        <Row
          label="Klasör yapısı"
          hint="Gelen, arşiv, düzenleme, inceleme ve geçici klasörleri diskin kökünde oluşturur. Var olanlara dokunmaz."
        >
          <Button disabled={!settings.hdd_root} onClick={() => void createFolders()}>
            Klasörleri oluştur
          </Button>
        </Row>
        {initStatus && (
          <p role="status" className={`text-[13px] m-0 mt-2 ${initStatus.ok ? "text-done" : "text-stop"}`}>
            {initStatus.text}
          </p>
        )}
      </Section>

      <Section title="Dosya işlemleri">
        <Row label="Varsayılan işlem">
          <Segmented
            label="Varsayılan işlem"
            value={settings.operations.default_mode}
            onChange={(mode) => setSettings({ operations: { ...settings.operations, default_mode: mode } })}
            options={[
              { value: "copy", label: "Kopyala" },
              { value: "move", label: "Taşı" },
            ]}
          />
        </Row>
        <Row label="Önce ön kontrol yap" hint="Gerçek işlemden önce aynı işlemi dosyalara dokunmadan dener; sorun çıkarsa durur.">
          <Toggle
            label="Önce ön kontrol yap"
            checked={settings.operations.dry_run_first}
            onChange={(v) => setSettings({ operations: { ...settings.operations, dry_run_first: v } })}
          />
        </Row>
        <Row
          label="Oturum aralığı"
          hint="İki çekim arasında bundan uzun boşluk varsa yeni bir oturum başlar."
        >
          <input
            type="range"
            aria-label="Oturum aralığı, saat"
            min={1}
            max={12}
            value={settings.operations.session_gap_hours}
            onChange={(e) =>
              setSettings({ operations: { ...settings.operations, session_gap_hours: Number(e.target.value) } })
            }
            className="w-28 accent-[var(--paper)]"
          />
          <span className="condensed text-[13px] w-14 text-right whitespace-nowrap">{settings.operations.session_gap_hours} saat</span>
        </Row>
      </Section>

      <Section title="Konum">
        <Row label="Giresun enlem aralığı">
          <span className="font-mono text-[13px] text-dim">40,85 – 41,15</span>
        </Row>
        <Row label="Giresun boylam aralığı">
          <span className="font-mono text-[13px] text-dim">38,25 – 38,55</span>
        </Row>
        <Row label="Konum eşleştirme penceresi" hint="Konumu olmayan bir kare, bu süre içinde çekilmiş konumlu bir kareden konum alır.">
          <span className="font-mono text-[13px] text-dim">±30 dakika</span>
        </Row>
        <p className="text-xs text-dim m-0 mt-2">
          Bu değerler <span className="font-mono">rules/locations.yaml</span> dosyasında tanımlıdır ve uygulama
          derlenirken içine gömülür.
        </p>
      </Section>

      <Section title="Kopya tespiti">
        <Row label="Birebir aynı dosyaları bul" hint="Dosya içeriğinin SHA-256 özetini karşılaştırır.">
          <Toggle
            label="Birebir aynı dosyaları bul"
            checked={settings.duplicates.sha256_check}
            onChange={(v) => setSettings({ duplicates: { ...settings.duplicates, sha256_check: v } })}
          />
        </Row>
        <Row label="Benzer görüntüleri bul" hint="Yeniden boyutlandırılmış veya sıkıştırılmış kopyaları yakalar.">
          <Toggle
            label="Benzer görüntüleri bul"
            checked={settings.duplicates.phash_check}
            onChange={(v) => setSettings({ duplicates: { ...settings.duplicates, phash_check: v } })}
          />
        </Row>
        <Row label="Benzerlik toleransı" hint="Değer büyüdükçe daha farklı görüntüler de kopya sayılır.">
          <input
            type="range"
            aria-label="Benzerlik toleransı"
            min={0}
            max={20}
            value={settings.duplicates.phash_threshold}
            onChange={(e) =>
              setSettings({ duplicates: { ...settings.duplicates, phash_threshold: Number(e.target.value) } })
            }
            className="w-28 accent-[var(--paper)]"
          />
          <span className="condensed text-[13px] w-12 text-right">{settings.duplicates.phash_threshold}</span>
        </Row>
      </Section>

      <Section title="Görünüm">
        <Row label="Tema">
          <Segmented
            label="Tema"
            value={settings.ui.theme}
            onChange={(theme) => setSettings({ ui: { ...settings.ui, theme } })}
            options={[
              { value: "dark", label: "Karanlık oda" },
              { value: "light", label: "Işık masası" },
            ]}
          />
        </Row>
        <Row label="Kayıt klasörü">
          <span className="font-mono text-[13px] text-dim">{settings.log_dir}</span>
        </Row>
      </Section>
    </div>
  );
}
