export default function LocationEditor() {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
      <p className="text-sm font-semibold text-[#e8eaf0] mb-1">Konum Kuralları</p>
      <p className="text-xs text-[#8b92a9] mb-4">
        EVERYDAY konum sınır kutularını ve korelasyon ayarlarını yapılandırın
      </p>
      {/* TODO: Map-based bbox editor + locations.yaml fields */}
      <div className="bg-[#242736] rounded-lg p-4">
        <p className="text-xs text-[#8b92a9] font-mono">
          # Giresun bbox: lat [40.85, 41.15], lon [38.25, 38.55]
        </p>
      </div>
    </div>
  );
}
