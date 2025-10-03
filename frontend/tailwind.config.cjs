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
        'drift': 'drift 120s linear infinite',
        'phase-transition': 'phase-transition 8s ease-in-out',
        'typewriter': 'typewriter 2s steps(12, end) forwards',
        'blink-cursor': 'blink-cursor 1s infinite',
        'delete-text': 'delete-text 1s steps(12, end) forwards',
        'sun-rise': 'sun-rise 8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards',
        'sun-set': 'sun-set 8s cubic-bezier(0.64, 0, 0.78, 0.39) forwards',
        'moon-rise': 'moon-rise 8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards',
        'moon-set': 'moon-set 8s cubic-bezier(0.64, 0, 0.78, 0.39) forwards',
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
        drift: {
          '0%': { 
            transform: 'translateX(-20vw)',
          },
          '100%': { 
            transform: 'translateX(120vw)',
          },
        },
        'phase-transition': {
          '0%': { 
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '50%': { 
            opacity: '0.5',
            transform: 'scale(1.02)',
          },
          '100%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        typewriter: {
          '0%': { 
            width: '0',
          },
          '100%': { 
            width: '100%',
          },
        },
        'blink-cursor': {
          '0%, 50%': { 
            borderColor: 'transparent',
          },
          '51%, 100%': { 
            borderColor: 'currentColor',
          },
        },
        'delete-text': {
          '0%': { 
            width: '100%',
          },
          '100%': { 
            width: '0',
          },
        },
        'sun-rise': {
          '0%': {
            transform: 'rotate(-120deg) translateX(300px) rotate(120deg)',
            opacity: '0',
            scale: '0.8',
          },
          '10%': {
            opacity: '0.2',
          },
          '30%': {
            opacity: '0.7',
            scale: '0.9',
          },
          '100%': {
            transform: 'rotate(120deg) translateX(300px) rotate(-120deg)',
            opacity: '1',
            scale: '1',
          },
        },
        'sun-set': {
          '0%': {
            transform: 'rotate(120deg) translateX(300px) rotate(-120deg)',
            opacity: '1',
            scale: '1',
          },
          '70%': {
            opacity: '0.7',
            scale: '0.9',
          },
          '90%': {
            opacity: '0.2',
          },
          '100%': {
            transform: 'rotate(240deg) translateX(300px) rotate(-240deg)',
            opacity: '0',
            scale: '0.8',
          },
        },
        'moon-rise': {
          '0%': {
            transform: 'rotate(-120deg) translateX(250px) rotate(120deg)',
            opacity: '0',
            scale: '0.8',
          },
          '10%': {
            opacity: '0.3',
          },
          '30%': {
            opacity: '0.8',
            scale: '0.9',
          },
          '100%': {
            transform: 'rotate(120deg) translateX(250px) rotate(-120deg)',
            opacity: '1',
            scale: '1',
          },
        },
        'moon-set': {
          '0%': {
            transform: 'rotate(120deg) translateX(250px) rotate(-120deg)',
            opacity: '1',
            scale: '1',
          },
          '70%': {
            opacity: '0.8',
            scale: '0.9',
          },
          '90%': {
            opacity: '0.3',
          },
          '100%': {
            transform: 'rotate(240deg) translateX(250px) rotate(-240deg)',
            opacity: '0',
            scale: '0.8',
          },
        },
      }
    }
  },
  plugins: [],
};
