/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          background: "var(--background)",
          surface: "var(--surface)",
          "surface-elevated": "var(--surface-elevated)",
          border: "var(--border)",
          text: {
             primary: "var(--text-primary)",
             secondary: "var(--text-secondary)",
          },
          primary: "var(--accent)",
          "primary-hover": "var(--accent-hover)",
          ai: "var(--accent-ai)",
          danger: "var(--danger)",
          warning: "var(--warning)",
          success: "var(--success)"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 10px var(--shadow-glow)' },
          '100%': { boxShadow: '0 0 25px var(--shadow-glow)' },
        }
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
