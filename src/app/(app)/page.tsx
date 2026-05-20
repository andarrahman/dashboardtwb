const manrope = '"Manrope", system-ui, sans-serif';

export default function Dashboard() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #F0FDFB 0%, #F8FAFB 50%, #EEF2FF 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: manrope,
        padding: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 520,
          width: "100%",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: "linear-gradient(135deg, #16DAC1 0%, #0EA5E9 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            boxShadow: "0 16px 40px rgba(22,218,193,0.30)",
          }}
        >
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            {/* Grid/dashboard icon */}
            <rect x="5" y="5" width="11" height="11" rx="3" fill="white" fillOpacity="0.95"/>
            <rect x="22" y="5" width="11" height="11" rx="3" fill="white" fillOpacity="0.65"/>
            <rect x="5" y="22" width="11" height="11" rx="3" fill="white" fillOpacity="0.65"/>
            <rect x="22" y="22" width="11" height="11" rx="3" fill="white" fillOpacity="0.40"/>
            {/* Sparkle dot */}
            <circle cx="30" cy="10" r="3.5" fill="#FDE68A"/>
          </svg>
        </div>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#ECFDF9",
            border: "1px solid #A7F3E4",
            borderRadius: 999,
            paddingBlock: 5,
            paddingInline: 14,
            marginBottom: 20,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16DAC1", display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F9D8A", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            In Development
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: "#0F2A37",
            lineHeight: "48px",
            margin: "0 0 16px",
            letterSpacing: "-0.02em",
          }}
        >
          Dashboard
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #16DAC1, #6366F1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Coming Soon
          </span>
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 15,
            color: "#7A8A93",
            lineHeight: "24px",
            margin: "0 0 40px",
            maxWidth: 400,
          }}
        >
          We&rsquo;re building a powerful workspace dashboard with real-time analytics,
          team activity feed, and KPI tracking — all in one place.
        </p>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 48 }}>
          {[
            { icon: "📊", label: "Analytics" },
            { icon: "🎯", label: "KPI Tracking" },
            { icon: "📋", label: "Project Overview" },
            { icon: "👥", label: "Team Activity" },
            { icon: "🔔", label: "Smart Alerts" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: "#FFFFFF",
                border: "1px solid #E8EDEF",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: "#4A5C66",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span>{icon}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>Build progress</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#16DAC1" }}>40%</span>
          </div>
          <div
            style={{
              height: 8,
              background: "#E8EDEF",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "40%",
                background: "linear-gradient(90deg, #16DAC1, #6366F1)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        {/* Footer note */}
        <p style={{ fontSize: 12, color: "#B0BFC8", marginTop: 32 }}>
          Twibbonize CRM · Internal Workspace
        </p>
      </div>
    </main>
  );
}
