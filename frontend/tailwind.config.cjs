module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0f172a",
        day: "#f8fafc",
        mafia: "#ef4444",
        villager: "#10b981",
        neutral: "#94a3b8"
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'twinkle': 'twinkle 2s ease-in-out infinite alternate',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { 
            transform: 'translateY(0px) translateX(0px)',
          },
          '50%': { 
            transform: 'translateY(-20px) translateX(10px)',
          },
        },
        twinkle: {
          '0%': { 
            opacity: '0.3',
            transform: 'scale(0.8)',
          },
          '100%': { 
            opacity: '1',
            transform: 'scale(1.2)',
          },
        },
        glow: {
          '0%': { 
            boxShadow: '0 0 5px rgba(255, 255, 255, 0.2)',
          },
          '100%': { 
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
          },
        },
      }
    }
  },
  plugins: [],
};
