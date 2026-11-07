import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { statusTone } from "@/lib/format";

const BRAND = "#0d9488"; // teal
const GRID = "#e2e8f0";
const AXIS = "#94a3b8";

const TONE_COLOR: Record<string, string> = {
  gray: "#94a3b8", brand: "#0d9488", success: "#0d9488",
  warning: "#f59e0b", danger: "#f97316", info: "#06b6d4",
};

const axisProps = {
  stroke: AXIS,
  tick: { fontSize: 12, fill: AXIS },
  axisLine: { stroke: GRID },
  tickLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px -10px rgb(15 23 42 / 0.15)",
    fontSize: 13,
  },
};

export function RevenueLineChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} width={56} />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2.5}
          dot={{ r: 3, fill: BRAND }} activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusBarChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="status" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.status} fill={TONE_COLOR[statusTone(d.status)] || BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const DONUT = ["#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#f97316", "#06b6d4", "#0f766e", "#64748b"];

export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data} dataKey="count" nameKey="status"
          cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2}
        >
          {data.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
