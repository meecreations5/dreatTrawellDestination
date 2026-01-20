//components/destination/simpleListEditor.js

"use client";

export default function SimpleListEditor({
  title,
  items,
  onChange,
  fields
}) {
  const add = () => onChange([...(items || []), {}]);

  const update = (i, key, value) => {
    const copy = [...items];
    copy[i][key] = value;
    onChange(copy);
  };

  const remove = (i) =>
    onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h2 className="font-semibold">{title}</h2>

      {(items || []).map((item, i) => (
        <div key={i} className="border p-3 rounded space-y-2">
          {fields.map(f => (
            <input
              key={f.key}
              placeholder={f.label}
              className="border p-2 w-full"
              value={item[f.key] || ""}
              onChange={e =>
                update(i, f.key, e.target.value)
              }
            />
          ))}

          <button
            onClick={() => remove(i)}
            className="text-red-600 text-sm"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={add}
        className="text-blue-600 text-sm underline"
      >
        + Add {title}
      </button>
    </div>
  );
}
