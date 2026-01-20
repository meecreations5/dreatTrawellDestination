"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";
import TravelAgentPerformanceTable from "@/components/admin/dashboard/TravelAgentPerformanceTable";

export default function AgentPerformanceDashboard() {
    const [agents, setAgents] = useState([]);
    const [leads, setLeads] = useState([]);
    const [destinations, setDestinations] = useState([]);
    const [loading, setLoading] = useState(true);

    /* =========================
       LOAD DATA
    ========================= */
    useEffect(() => {
        const load = async () => {
            const [agentSnap, leadSnap, destSnap] = await Promise.all([
                getDocs(collection(db, "travelAgents")),
                getDocs(collection(db, "leads")),
                getDocs(collection(db, "destinations"))
            ]);

            setAgents(agentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLeads(leadSnap.docs.map(d => d.data()));
            setDestinations(destSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            setLoading(false);
        };

        load();
    }, []);

    if (loading) return <p className="p-6">Loading dashboard…</p>;

    /* =========================
       AGENT METRICS
    ========================= */
    const agentStats = agents.map(agent => {
        const agentLeads = leads.filter(l => l.agentId === agent.id);
        const converted = agentLeads.filter(l => l.status === "won");

        const revenue = converted.reduce(
            (sum, l) => sum + (Number(l.dealValue) || 0),
            0
        );

        return {
            id: agent.id,
            name: agent.agencyName,
            status: agent.status,
            totalLeads: agentLeads.length,
            converted: converted.length,
            conversionRate:
                agentLeads.length === 0
                    ? 0
                    : Math.round((converted.length / agentLeads.length) * 100),
            revenue,
            avgDeal:
                converted.length === 0
                    ? 0
                    : Math.round(revenue / converted.length)
        };
    });

    /* =========================
       SUMMARY
    ========================= */
    const totalRevenue = agentStats.reduce((s, a) => s + a.revenue, 0);
    const totalLeads = agentStats.reduce((s, a) => s + a.totalLeads, 0);
    const totalConverted = agentStats.reduce((s, a) => s + a.converted, 0);

    const overallConversion =
        totalLeads === 0
            ? 0
            : Math.round((totalConverted / totalLeads) * 100);

    const activeAgents = agents.filter(a => a.status === "active").length;

    /* =========================
       GEO + DESTINATION MAPS
    ========================= */
    const stateMap = {};
    const cityMap = {};
    const destinationMap = {};

    leads.forEach(l => {
        if (l.state) stateMap[l.state] = (stateMap[l.state] || 0) + 1;
        if (l.city) cityMap[l.city] = (cityMap[l.city] || 0) + 1;

        if (l.destinationId) {
            destinationMap[l.destinationId] =
                (destinationMap[l.destinationId] || 0) + 1;
        }
    });

    const stateChart = Object.entries(stateMap).map(([k, v]) => ({
        name: k,
        leads: v
    }));

    const cityChart = Object.entries(cityMap).map(([k, v]) => ({
        name: k,
        leads: v
    }));

    const destinationChart = Object.entries(destinationMap).map(
        ([id, v]) => ({
            name:
                destinations.find(d => d.id === id)?.name || id,
            leads: v
        })
    );

    return (
        <AdminGuard>
            <main className="p-6 w-full space-y-6">

                {/* HEADER */}
                <div className="flex justify-between items-center">
                    {/* HEADER */}
                    <h1 className="text-xl font-semibold">
                        Agent Dashboard
                    </h1>
                    <Link
                        href="/admin/travel-agents"
                        className="text-sm text-blue-600 underline"
                    >
                        ← Back to Agents
                    </Link>
                </div>

                {/* SUMMARY */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label="Total Agents" value={agents.length} />
                    <Stat label="Active Agents" value={activeAgents} />
                    <Stat label="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} />
                    <Stat label="Overall Conversion" value={`${overallConversion}%`} />
                </div>

                {/* AGENT GRAPHS */}
                <Grid>
                    <Chart title="Revenue by Agent" data={agentStats} dataKey="revenue" />
                    <Chart title="Conversion % by Agent" data={agentStats} dataKey="conversionRate" />
                </Grid>

                {/* GEO GRAPHS */}
                <Grid>
                    <Chart title="State-wise Leads" data={stateChart} dataKey="leads" />
                    <Chart title="City-wise Leads" data={cityChart} dataKey="leads" />
                </Grid>

                {/* DESTINATION */}
                <Chart title="Destination-wise Leads" data={destinationChart} dataKey="leads" />


                {/* ================= AGENT PERFORMANCE TABLE ================= */}
                
                    <TravelAgentPerformanceTable leads={leads} />
  

            </main>
        </AdminGuard>
    );
}

/* =========================
   HELPERS
========================= */

function Stat({ label, value }) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
        </div>
    );
}

function Chart({ title, data, dataKey }) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey={dataKey} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function Grid({ children }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {children}
        </div>
    );
}
