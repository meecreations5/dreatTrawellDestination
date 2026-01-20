//components/destination/ContentBlockEditor.js

"use client";

import MediaUploader from "./MediaUploader";

export default function ContentBlockEditor({
    title,
    items,
    onChange,
    basePath
}) {
    const addItem = () => {
        onChange([
            ...items,
            {
                name: "",
                photos: [],
                youtube: "",
                mapLink: "",
                sourceLink: ""
            }
        ]);
    };

    const updateItem = (index, field, value) => {
        const copy = [...items];
        copy[index][field] = value;
        onChange(copy);
    };

    const removeItem = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">{title}</h2>

            {items.map((item, index) => (
                <div
                    key={index}
                    className="border p-4 rounded space-y-3 bg-gray-50"
                >
                    <input
                        placeholder="Name"
                        className="border p-2 w-full"
                        value={item.name}
                        onChange={e =>
                            updateItem(index, "name", e.target.value)
                        }
                    />

                    <textarea
                        placeholder="Description / Cultural Notes (optional)"
                        className="border p-2 w-full"
                        rows={2}
                        value={item.description || ""}
                        onChange={e =>
                            updateItem(index, "description", e.target.value)
                        }
                    />

                    <MediaUploader
                        label="Photos"
                        multiple
                        path={`${basePath}/${index}/photos`}
                        value={item.photos}
                        onChange={(files) =>
                            updateItem(index, "photos", files)
                        }
                    />

                    <input
                        placeholder="YouTube Video Link"
                        className="border p-2 w-full"
                        value={item.youtube}
                        onChange={e =>
                            updateItem(index, "youtube", e.target.value)
                        }
                    />

                    <input
                        placeholder="Google Map Link"
                        className="border p-2 w-full"
                        value={item.mapLink}
                        onChange={e =>
                            updateItem(index, "mapLink", e.target.value)
                        }
                    />

                    <input
                        placeholder="Other Source Link"
                        className="border p-2 w-full"
                        value={item.sourceLink}
                        onChange={e =>
                            updateItem(index, "sourceLink", e.target.value)
                        }
                    />

                    <button
                        onClick={() => removeItem(index)}
                        className="text-red-600 text-sm"
                    >
                        Remove
                    </button>
                </div>
            ))}

            <button
                onClick={addItem}
                className="text-blue-600 underline text-sm"
            >
                + Add {title}
            </button>
        </div>
    );
}
