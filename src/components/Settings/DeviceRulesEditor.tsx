export default function DeviceRulesEditor() {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
      <p className="text-sm font-semibold text-[#e8eaf0] mb-1">Cihaz Kuralları</p>
      <p className="text-xs text-[#8b92a9] mb-4">rules/devices.yaml içindeki cihaz tanımları</p>
      {/* TODO: Render YAML visual editor for devices.yaml */}
      <div className="bg-[#242736] rounded-lg p-4">
        <p className="text-xs text-[#8b92a9] font-mono">
          # devices.yaml editörü burada olacak
        </p>
      </div>
    </div>
  );
}
