module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#5D87FF",
          dark: "#4570EA"
        },
        success: "#13DEB9",
        warning: "#FFAE1F",
        danger: "#FA896B",

        surface: "#FFFFFF",
        muted: "#F4F6F9",
        border: "#E5E7EB",
        text: {
          primary: "#111827",
          secondary: "#6B7280"
        }
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.05)"
      },
      borderRadius: {
        xl: "12px"
      }
    }
  },
  plugins: []
};
