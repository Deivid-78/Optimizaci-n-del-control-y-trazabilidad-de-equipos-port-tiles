import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutGrid, PackagePlus, ListChecks, History, Search,
  ChevronRight, X, Trash2, AlertCircle, CheckCircle2, Circle,
  Loader2, Laptop, Clock, Download
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   Tokens
---------------------------------------------------------------- */
const C = {
  bg: "#12151A",
  surface: "#1B2028",
  surfaceAlt: "#20262F",
  raised: "#262D38",
  border: "#2C333E",
  borderLight: "#3A4250",
  amber: "#F2A93B",
  amberDim: "#8A6320",
  green: "#4FAE7E",
  greenDim: "#2C4A3B",
  red: "#E2665A",
  redDim: "#4A2D2A",
  text: "#EBEDF1",
  textMuted: "#8B93A1",
  textFaint: "#5B6270",
};

const STAGES = [
  { key: "imagen", label: "Imagen instalada", short: "Imagen" },
  { key: "dominio", label: "Subido a dominio", short: "Dominio" },
  { key: "encriptado", label: "Encriptado", short: "Encriptado" },
  { key: "logueado", label: "Logueado", short: "Logueo" },
  { key: "audio", label: "Audio configurado", short: "Audio" },
  { key: "listo", label: "Listo para envío", short: "Listo" },
  { key: "enviado", label: "Enviado / despachado", short: "Enviado" },
];

const EMPTY_FLAGS = { imagen: false, dominio: false, encriptado: false, logueado: false, audio: false, listo: false, enviado: false };
const TIPOS = ["Wave", "Reposición", "Pivot"];
const TIPO_COLOR = { Wave: C.amber, "Reposición": "#7AA6D6", Pivot: "#B98AE0" };

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};
const daysBetween = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

const currentStageIndex = (flags) => {
  let idx = -1;
  STAGES.forEach((s, i) => { if (flags[s.key]) idx = i; });
  return idx;
};
const currentStageLabel = (flags) => {
  const idx = currentStageIndex(flags);
  return idx === -1 ? "Recibido" : STAGES[idx].label;
};

/* ---------------------------------------------------------------
   Small UI atoms
---------------------------------------------------------------- */
function Badge({ color, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 4, fontSize: 11.5, fontWeight: 600,
      fontFamily: "Inter, sans-serif", letterSpacing: 0.2,
      background: `${color}22`, color, border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}

function StageDots({ flags, size = 7 }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {STAGES.map((s) => (
        <div key={s.key} title={s.label} style={{
          width: size, height: size, borderRadius: 2,
          background: flags[s.key] ? C.amber : C.border,
        }} />
      ))}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ width: "100%", height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? C.green : C.amber, transition: "width .3s ease" }} />
    </div>
  );
}

function Button({ children, onClick, variant = "default", style, disabled, title }) {
  const base = {
    fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13.5,
    padding: "8px 14px", borderRadius: 6, border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex",
    alignItems: "center", gap: 7, transition: "background .15s ease, opacity .15s",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    default: { background: C.raised, color: C.text, border: `1px solid ${C.borderLight}` },
    primary: { background: C.amber, color: "#1A140A" },
    ghost: { background: "transparent", color: C.textMuted },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.redDim}` },
  };
  return (
    <button title={title} disabled={disabled} onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   Main App
---------------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("dashboard");
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [tecnicoInput, setTecnicoInput] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const fetchEquipos = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("equipos")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError("No se pudo cargar el inventario: " + err.message);
    } else {
      setError("");
      setEquipos(data || []);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("tecnico-nombre");
    if (saved) { setTecnico(saved); setTecnicoInput(saved); }

    (async () => {
      setLoading(true);
      await fetchEquipos();
      setLoading(false);
    })();

    const channel = supabase
      .channel("equipos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipos" }, () => {
        fetchEquipos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchEquipos]);

  const saveTecnico = () => {
    const name = tecnicoInput.trim();
    if (!name) return;
    setTecnico(name);
    localStorage.setItem("tecnico-nombre", name);
  };

  const addEquipos = async (serials, tipo, lote, fecha) => {
    setSaving(true);
    const evento = "Equipo registrado en el sistema";
    const rows = serials.map((serial) => ({
      serial: serial.trim(),
      tipo,
      lote: lote.trim() || "—",
      fecha_ingreso: fecha,
      flags: EMPTY_FLAGS,
      notas: "",
      historial: [{ evento, fecha: new Date().toISOString(), tecnico: tecnico || "—" }],
    }));
    const { error: err } = await supabase.from("equipos").insert(rows);
    if (err) setError("No se pudo registrar: " + err.message);
    else { setError(""); await fetchEquipos(); }
    setSaving(false);
  };

  const toggleFlag = async (equipo, stageKey) => {
    const newVal = !equipo.flags[stageKey];
    const stageLabel = STAGES.find((s) => s.key === stageKey).label;
    const evento = `${newVal ? "Marcado" : "Desmarcado"}: ${stageLabel}`;
    const newFlags = { ...equipo.flags, [stageKey]: newVal };
    const newHistorial = [{ evento, fecha: new Date().toISOString(), tecnico: tecnico || "Sin identificar" }, ...equipo.historial];

    setEquipos((prev) => prev.map((e) => e.id === equipo.id ? { ...e, flags: newFlags, historial: newHistorial } : e));

    const { error: err } = await supabase
      .from("equipos")
      .update({ flags: newFlags, historial: newHistorial })
      .eq("id", equipo.id);
    if (err) { setError("No se pudo guardar el cambio: " + err.message); fetchEquipos(); }
  };

  const addNote = async (equipo, nota) => {
    if (!nota.trim()) return;
    const newHistorial = [{ evento: `Nota: ${nota.trim()}`, fecha: new Date().toISOString(), tecnico: tecnico || "Sin identificar" }, ...equipo.historial];
    setEquipos((prev) => prev.map((e) => e.id === equipo.id ? { ...e, historial: newHistorial } : e));
    const { error: err } = await supabase.from("equipos").update({ historial: newHistorial }).eq("id", equipo.id);
    if (err) { setError("No se pudo guardar la nota: " + err.message); fetchEquipos(); }
  };

  const removeEquipo = async (equipoId) => {
    setEquipos((prev) => prev.filter((e) => e.id !== equipoId));
    setSelectedId(null);
    const { error: err } = await supabase.from("equipos").delete().eq("id", equipoId);
    if (err) { setError("No se pudo eliminar: " + err.message); fetchEquipos(); }
  };

  const selected = equipos.find((e) => e.id === selectedId) || null;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, color: C.textMuted, fontFamily: "Inter, sans-serif" }}>
        <Loader2 className="animate-spin" size={18} style={{ marginRight: 8 }} /> Cargando inventario…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, sans-serif" }}>
      <Sidebar view={view} setView={setView} count={equipos.length} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar tecnico={tecnico} tecnicoInput={tecnicoInput} setTecnicoInput={setTecnicoInput}
          saveTecnico={saveTecnico} saving={saving} error={error} />
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {view === "dashboard" && <Dashboard equipos={equipos} setView={setView} />}
          {view === "inventario" && <Inventario equipos={equipos} onSelect={(e) => setSelectedId(e.id)} />}
          {view === "nuevo" && <NuevoIngreso onAdd={addEquipos} tecnico={tecnico} />}
          {view === "historial" && <HistorialFeed equipos={equipos} />}
        </div>
      </div>
      {selected && (
        <DetailDrawer
          equipo={selected}
          onClose={() => setSelectedId(null)}
          onToggle={toggleFlag}
          onNote={addNote}
          onDelete={removeEquipo}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Sidebar
---------------------------------------------------------------- */
function Sidebar({ view, setView, count }) {
  const items = [
    { key: "dashboard", label: "Panel", icon: LayoutGrid },
    { key: "inventario", label: "Inventario", icon: ListChecks },
    { key: "nuevo", label: "Nuevo ingreso", icon: PackagePlus },
    { key: "historial", label: "Trazabilidad", icon: History },
  ];
  return (
    <div style={{ width: 200, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 22px" }}>
        <Laptop size={19} color={C.amber} />
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: 0.3 }}>
          Control de Flota
        </div>
      </div>
      {items.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => setView(key)} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "9px 10px", marginBottom: 3, borderRadius: 7, border: "none",
          background: view === key ? C.raised : "transparent",
          color: view === key ? C.text : C.textMuted, cursor: "pointer",
          fontSize: 13.5, fontWeight: 500, fontFamily: "Inter, sans-serif", textAlign: "left",
        }}>
          <Icon size={16} />
          {label}
        </button>
      ))}
      <div style={{ marginTop: "auto", padding: "10px 8px", fontSize: 11, color: C.textFaint, borderTop: `1px solid ${C.border}` }}>
        {count} equipo{count !== 1 ? "s" : ""} en sistema
      </div>
    </div>
  );
}

function TopBar({ tecnico, tecnicoInput, setTecnicoInput, saveTecnico, saving, error }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
      <div style={{ fontSize: 12.5, color: C.textMuted }}>
        {error
          ? <span style={{ color: C.red, display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={13} /> {error}</span>
          : saving ? "Guardando…" : "Sincronizado en tiempo real con todo el equipo"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {tecnico && <span style={{ fontSize: 12.5, color: C.textFaint }}>Técnico:</span>}
        <input value={tecnicoInput} onChange={(e) => setTecnicoInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveTecnico()}
          placeholder="Tu nombre para registrar cambios"
          style={{
            background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text,
            borderRadius: 6, padding: "6px 10px", fontSize: 12.5, width: 220, outline: "none",
          }} />
        <Button variant="default" onClick={saveTecnico} style={{ padding: "6px 10px", fontSize: 12 }}>Guardar</Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Dashboard
---------------------------------------------------------------- */
function Dashboard({ equipos, setView }) {
  const total = equipos.length;
  const enviados = equipos.filter((e) => e.flags.enviado).length;
  const listos = equipos.filter((e) => e.flags.listo && !e.flags.enviado).length;
  const enProceso = total - enviados - listos;
  const promedioDias = total
    ? Math.round(equipos.filter((e) => !e.flags.enviado).reduce((a, e) => a + daysBetween(e.fecha_ingreso), 0) / Math.max(1, total - enviados))
    : 0;

  const porEtapa = STAGES.map((s, i) => ({
    ...s,
    count: equipos.filter((e) => !e.flags.enviado && currentStageIndex(e.flags) === i).length,
  }));
  const recibidosSinIniciar = equipos.filter((e) => currentStageIndex(e.flags) === -1).length;

  return (
    <div>
      <SectionTitle>Panel general</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total en sistema" value={total} />
        <KpiCard label="En proceso" value={enProceso} color={C.amber} />
        <KpiCard label="Listos para envío" value={listos} color={C.green} />
        <KpiCard label="Días promedio en piso" value={promedioDias} suffix=" d" />
      </div>

      <SectionTitle>Equipos por etapa (sin contar enviados)</SectionTitle>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 130 }}>
          <StageBar label="Recibido" count={recibidosSinIniciar} max={Math.max(1, total)} color={C.textFaint} />
          {porEtapa.map((s) => (
            <StageBar key={s.key} label={s.short} count={s.count} max={Math.max(1, total)} color={C.amber} />
          ))}
        </div>
      </div>

      <SectionTitle>Composición por tipo de entrega</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {TIPOS.map((tipo) => {
          const items = equipos.filter((e) => e.tipo === tipo);
          const done = items.filter((e) => e.flags.enviado).length;
          return (
            <div key={tipo} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <Badge color={TIPO_COLOR[tipo]}>{tipo}</Badge>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, marginTop: 10 }}>{items.length}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{done} despachados</div>
              <ProgressBar pct={items.length ? (done / items.length) * 100 : 0} />
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <EmptyState
          text="Aún no hay equipos registrados. Ingresa el primer lote para empezar la trazabilidad."
          action={() => setView("nuevo")}
          actionLabel="Registrar equipos"
        />
      )}
    </div>
  );
}

function StageBar({ label, count, max, color }) {
  const h = Math.max(4, (count / max) * 100);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "IBM Plex Mono, monospace" }}>{count}</div>
      <div style={{ width: "100%", height: 90, display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: "100%", height: `${h}%`, background: color, borderRadius: "3px 3px 0 0", opacity: count ? 1 : 0.25 }} />
      </div>
      <div style={{ fontSize: 10.5, color: C.textFaint, textAlign: "center" }}>{label}</div>
    </div>
  );
}

function KpiCard({ label, value, color = C.text, suffix = "" }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, color }}>{value}{suffix}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, letterSpacing: 0.3, color: C.textMuted, marginBottom: 12 }}>{children}</div>;
}

function EmptyState({ text, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
      <Circle size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
      <div style={{ fontSize: 13.5, marginBottom: 14 }}>{text}</div>
      {action && <Button variant="primary" onClick={action}>{actionLabel}</Button>}
    </div>
  );
}

/* ---------------------------------------------------------------
   Inventario (tabla + filtros)
---------------------------------------------------------------- */
function Inventario({ equipos, onSelect }) {
  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [loteFiltro, setLoteFiltro] = useState("Todos");
  const [etapaFiltro, setEtapaFiltro] = useState("Todas");

  const lotes = useMemo(() => ["Todos", ...Array.from(new Set(equipos.map((e) => e.lote)))], [equipos]);
  const etapas = ["Todas", "Recibido", ...STAGES.map((s) => s.label)];

  const filtrados = equipos.filter((e) => {
    if (q && !e.serial.toLowerCase().includes(q.toLowerCase())) return false;
    if (tipoFiltro !== "Todos" && e.tipo !== tipoFiltro) return false;
    if (loteFiltro !== "Todos" && e.lote !== loteFiltro) return false;
    if (etapaFiltro !== "Todas" && currentStageLabel(e.flags) !== etapaFiltro) return false;
    return true;
  });

  const descargarCSV = () => {
    const header = ["Serial", "Tipo", "Lote", "Fecha ingreso", "Etapa actual", "Días en piso", ...STAGES.map((s) => s.short)].join(",");
    const rows = filtrados.map((e) => [
      e.serial, e.tipo, e.lote, e.fecha_ingreso, currentStageLabel(e.flags), daysBetween(e.fecha_ingreso),
      ...STAGES.map((s) => (e.flags[s.key] ? "SI" : "NO")),
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <SectionTitle>Inventario ({filtrados.length})</SectionTitle>
        <Button variant="ghost" onClick={descargarCSV}><Download size={14} /> Descargar CSV</Button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: C.textFaint }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serial…"
            style={{ background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text, borderRadius: 6, padding: "7px 10px 7px 30px", fontSize: 13, width: 180 }} />
        </div>
        <Select value={tipoFiltro} setValue={setTipoFiltro} options={["Todos", ...TIPOS]} />
        <Select value={loteFiltro} setValue={setLoteFiltro} options={lotes} />
        <Select value={etapaFiltro} setValue={setEtapaFiltro} options={etapas} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState text="No hay equipos que coincidan con estos filtros." />
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surfaceAlt, textAlign: "left" }}>
                {["Serial", "Tipo", "Lote", "Ingreso", "Progreso", "Etapa actual", "Días", ""].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontWeight: 600, color: C.textMuted, fontSize: 11.5, letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} onClick={() => onSelect(e)} style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5 }}>{e.serial}</td>
                  <td style={{ padding: "10px 12px" }}><Badge color={TIPO_COLOR[e.tipo]}>{e.tipo}</Badge></td>
                  <td style={{ padding: "10px 12px", color: C.textMuted }}>{e.lote}</td>
                  <td style={{ padding: "10px 12px", color: C.textMuted, fontSize: 12 }}>{e.fecha_ingreso}</td>
                  <td style={{ padding: "10px 12px" }}><StageDots flags={e.flags} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: e.flags.enviado ? C.green : C.text, fontWeight: 500 }}>{currentStageLabel(e.flags)}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.textMuted }}>{daysBetween(e.fecha_ingreso)}</td>
                  <td style={{ padding: "10px 12px" }}><ChevronRight size={15} color={C.textFaint} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({ value, setValue, options }) {
  return (
    <select value={value} onChange={(e) => setValue(e.target.value)} style={{
      background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text,
      borderRadius: 6, padding: "7px 10px", fontSize: 13,
    }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ---------------------------------------------------------------
   Nuevo ingreso
---------------------------------------------------------------- */
function NuevoIngreso({ onAdd, tecnico }) {
  const [tipo, setTipo] = useState("Wave");
  const [lote, setLote] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [seriales, setSeriales] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const count = seriales.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;

  const submit = async () => {
    const lista = seriales.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (lista.length === 0) return;
    setSubmitting(true);
    await onAdd(lista, tipo, lote, fecha);
    setSubmitting(false);
    setConfirmMsg(`${lista.length} equipo(s) registrados en el lote "${lote || "—"}".`);
    setSeriales("");
    setLote("");
    setTimeout(() => setConfirmMsg(""), 4000);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle>Registrar ingreso de equipos</SectionTitle>
      {!tecnico && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: C.amberDim + "33", border: `1px solid ${C.amberDim}`, borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: C.amber }}>
          <AlertCircle size={14} /> Escribe tu nombre arriba para que quede registrado en la trazabilidad.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="Tipo de entrega">
          <Select value={tipo} setValue={setTipo} options={TIPOS} />
        </Field>
        <Field label="Fecha de ingreso">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            style={{ background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text, borderRadius: 6, padding: "7px 10px", fontSize: 13, width: "100%" }} />
        </Field>
      </div>
      <Field label="Nombre del lote / wave / pivot (ej. Wave-42, Pivot-Bogotá-Ago)">
        <input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ej: Wave 42"
          style={{ background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text, borderRadius: 6, padding: "8px 10px", fontSize: 13, width: "100%" }} />
      </Field>
      <Field label={`Seriales / asset tags — uno por línea (${count} detectado${count !== 1 ? "s" : ""})`}>
        <textarea value={seriales} onChange={(e) => setSeriales(e.target.value)} placeholder={"TP-00123\nTP-00124\nTP-00125"}
          style={{ background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text, borderRadius: 6, padding: 10, fontSize: 13, width: "100%", height: 140, fontFamily: "IBM Plex Mono, monospace", resize: "vertical" }} />
      </Field>
      <Button variant="primary" onClick={submit} disabled={count === 0 || submitting} style={{ marginTop: 4 }}>
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
        {submitting ? "Guardando…" : `Registrar ${count > 0 ? `${count} equipo${count !== 1 ? "s" : ""}` : "equipos"}`}
      </Button>
      {confirmMsg && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: C.green, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} /> {confirmMsg}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Historial global
---------------------------------------------------------------- */
function HistorialFeed({ equipos }) {
  const feed = useMemo(() => {
    const all = [];
    equipos.forEach((e) => (e.historial || []).forEach((h) => all.push({ ...h, serial: e.serial, lote: e.lote, tipo: e.tipo })));
    return all.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 200);
  }, [equipos]);

  return (
    <div>
      <SectionTitle>Trazabilidad general ({feed.length} eventos recientes)</SectionTitle>
      {feed.length === 0 ? (
        <EmptyState text="Todavía no hay eventos registrados." />
      ) : (
        <div style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 18, marginLeft: 6 }}>
          {feed.map((h, i) => (
            <div key={i} style={{ position: "relative", paddingBottom: 16 }}>
              <div style={{ position: "absolute", left: -23, top: 3, width: 8, height: 8, borderRadius: 4, background: C.amber }} />
              <div style={{ fontSize: 13, marginBottom: 2 }}>{h.evento}</div>
              <div style={{ fontSize: 11.5, color: C.textFaint, display: "flex", gap: 8, alignItems: "center" }}>
                <Clock size={11} /> {fmtDate(h.fecha)}
                <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>· {h.serial}</span>
                <span>· {h.lote}</span>
                <span>· {h.tecnico}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Detail Drawer
---------------------------------------------------------------- */
function DetailDrawer({ equipo, onClose, onToggle, onNote, onDelete }) {
  const [nota, setNota] = useState("");
  const pct = (Object.values(equipo.flags).filter(Boolean).length / STAGES.length) * 100;

  return (
    <div style={{ width: 350, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 15, fontWeight: 600 }}>{equipo.serial}</div>
          <div style={{ marginTop: 6 }}><Badge color={TIPO_COLOR[equipo.tipo]}>{equipo.tipo}</Badge> <span style={{ fontSize: 11.5, color: C.textFaint, marginLeft: 6 }}>{equipo.lote}</span></div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 6 }}>
          Ingresó hace {daysBetween(equipo.fecha_ingreso)} día{daysBetween(equipo.fecha_ingreso) !== 1 ? "s" : ""} · {equipo.fecha_ingreso}
        </div>
        <ProgressBar pct={pct} />
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 10 }}>Checklist de estado</div>
        {STAGES.map((s) => (
          <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={!!equipo.flags[s.key]} onChange={() => onToggle(equipo, s.key)}
              style={{ accentColor: C.amber, width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: equipo.flags[s.key] ? C.text : C.textMuted }}>{s.label}</span>
          </label>
        ))}
      </div>

      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>Agregar nota a la trazabilidad</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={nota} onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onNote(equipo, nota); setNota(""); } }}
            placeholder="Ej: pantalla con rayón leve"
            style={{ flex: 1, background: C.raised, border: `1px solid ${C.borderLight}`, color: C.text, borderRadius: 6, padding: "7px 9px", fontSize: 12.5 }} />
          <Button onClick={() => { onNote(equipo, nota); setNota(""); }} style={{ padding: "7px 10px" }}>Añadir</Button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 10 }}>Historial de este equipo</div>
        {(equipo.historial || []).map((h, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5 }}>{h.evento}</div>
            <div style={{ fontSize: 11, color: C.textFaint }}>{fmtDate(h.fecha)} · {h.tecnico}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}` }}>
        <Button variant="danger" onClick={() => { if (confirm(`¿Eliminar el registro de ${equipo.serial}? Esta acción no se puede deshacer.`)) onDelete(equipo.id); }} style={{ width: "100%", justifyContent: "center" }}>
          <Trash2 size={13} /> Eliminar equipo del sistema
        </Button>
      </div>
    </div>
  );
}
