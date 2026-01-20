// components/UserForm.js

"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function UserForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "team"
  });

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();

    await setDoc(doc(db, "users", form.email), {
      ...form,
      active: true,
      createdAt: serverTimestamp()
    });

    setForm({ name: "", email: "", mobile: "", role: "team" });
    onSuccess();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded shadow mt-4 space-y-3"
    >
      <input
        name="name"
        placeholder="Full Name"
        value={form.name}
        onChange={handleChange}
        className="w-full border p-2 rounded"
        required
      />

      <input
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        className="w-full border p-2 rounded"
        required
      />

      <input
        name="mobile"
        placeholder="Mobile (with country code)"
        value={form.mobile}
        onChange={handleChange}
        className="w-full border p-2 rounded"
        required
      />

      <select
        name="role"
        value={form.role}
        onChange={handleChange}
        className="w-full border p-2 rounded"
      >
        <option value="team">Team</option>
        <option value="admin">Admin</option>
      </select>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Create User
      </button>
    </form>
  );
}
