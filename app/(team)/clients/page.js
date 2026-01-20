// clients/page.js


"use client";

import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [name, setName] = useState("");

  const fetchClients = async () => {
    const snap = await getDocs(collection(db, "clients"));
    setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const addClient = async () => {
    await addDoc(collection(db, "clients"), {
      name,
      assignedTo: user.email,
      status: "active",
      createdAt: serverTimestamp()
    });
    setName("");
    fetchClients();
  };

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Clients</h1>

      <div className="flex gap-2 mt-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Client name"
          className="border p-2 rounded"
        />
        <button
          onClick={addClient}
          className="bg-blue-600 text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {clients.map(c => (
          <li key={c.id} className="bg-white p-3 shadow rounded">
            {c.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
