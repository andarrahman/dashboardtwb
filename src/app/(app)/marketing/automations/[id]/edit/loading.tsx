export default function BuilderLoading() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh", background: "#FFFFFF",
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      {/* Skeleton top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingInline: 20, paddingBlock: 12, borderBottom: "1px solid #DEE8E8", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "#EAEEF0" }} />
          <div style={{ width: 110, height: 13, borderRadius: 4, background: "#EAEEF0" }} />
          <div style={{ width: 120, height: 13, borderRadius: 4, background: "#EAEEF0" }} />
          <div style={{ width: 54, height: 22, borderRadius: 999, background: "#EAEEF0" }} />
        </div>
        <div style={{ width: 340, height: 38, borderRadius: 999, background: "#F0F7F7" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 90, height: 34, borderRadius: 999, background: "#EAEEF0" }} />
          <div style={{ width: 110, height: 34, borderRadius: 999, background: "#16DAC133" }} />
        </div>
      </div>
    </div>
  );
}
