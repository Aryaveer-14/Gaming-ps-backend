/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                pixel: ['"Press Start 2P"', 'monospace'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                pokemon: {
                    red: '#E3001B',
                    yellow: '#FFCB05',
                    blue: '#3B4CCA',
                    dark: '#1a1a2e',
                    darker: '#0f0f1a',
                    panel: '#16213e',
                    border: '#0f3460',
                    hp: {
                        high: '#4ade80',
                        mid: '#facc15',
                        low: '#ef4444',
                    },
                },
            },
            keyframes: {
                shake: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-4px)' },
                    '75%': { transform: 'translateX(4px)' },
                },
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                pulse: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
            },
            animation: {
                shake: 'shake 0.3s ease-in-out',
                fadeIn: 'fadeIn 0.4s ease-out',
                pulse: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
}
