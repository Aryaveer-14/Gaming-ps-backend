import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/auth': 'http://192.168.0.130:3001',
            '/socket.io': {
                target: 'http://192.168.0.130:3001',
                ws: true,
            },
        },
    },
})
