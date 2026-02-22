import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useBattleStore } from '../store/battleStore'
import { getBattleSocket } from '../lib/battleSocket'

interface Props {
    onClose: () => void
}

export default function FriendsPanel({ onClose }: Props) {
    const { token, userId, username } = useAuthStore()
    const { phase } = useBattleStore()
    const [targetId, setTargetId] = useState('')
    const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
    const [statusMsg, setStatusMsg] = useState('')
    const [copied, setCopied] = useState(false)

    function copyMyId() {
        if (userId) {
            navigator.clipboard.writeText(userId).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            })
        }
    }

    function sendChallenge() {
        if (!token || !targetId.trim()) return
        if (targetId.trim() === userId) {
            setStatus('error')
            setStatusMsg("You can't challenge yourself!")
            setTimeout(() => { setStatus('idle'); setStatusMsg('') }, 3000)
            return
        }

        const socket = getBattleSocket(token)
        socket.emit('battle-request', { targetUserId: targetId.trim() })
        setStatus('sent')
        setStatusMsg('Challenge sent! Waiting for response...')
        setTimeout(() => { setStatus('idle'); setStatusMsg('') }, 6000)
    }

    return (
        <div className="w-80 rounded-xl overflow-hidden shadow-2xl shadow-black/60
            border border-blue-500/30 backdrop-blur-md bg-gray-900/95">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                bg-gradient-to-r from-blue-800/80 to-indigo-800/80 border-b border-blue-600/30">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🎮</span>
                    <span className="text-xs font-mono text-white font-bold">Play with Friends</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                    ✕
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* Your ID Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs">👤</span>
                        <span className="text-xs text-gray-400 font-mono">Your Info</span>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3 space-y-2 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-300 font-mono">{username}</span>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[10px] text-green-400">Online</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-[10px] text-blue-300 bg-black/50 px-2 py-1.5
                                rounded font-mono truncate select-all border border-gray-700/50">
                                {userId}
                            </code>
                            <button
                                onClick={copyMyId}
                                className="text-[10px] px-2 py-1.5 rounded
                                    bg-blue-600/40 hover:bg-blue-600/60
                                    text-blue-200 hover:text-white
                                    border border-blue-500/30
                                    transition-all font-mono shrink-0"
                            >
                                {copied ? '✓ Copied!' : '📋 Copy'}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            Share this ID with your friend so they can challenge you
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-700/50" />
                    <span className="text-[10px] text-gray-500 font-mono">⚔️ CHALLENGE</span>
                    <div className="flex-1 h-px bg-gray-700/50" />
                </div>

                {/* Challenge Section */}
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-mono block">
                        Opponent's User ID
                    </label>
                    <input
                        type="text"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChallenge()}
                        placeholder="Paste their ID here..."
                        className="w-full bg-black/50 border border-gray-600/50 rounded-lg
                            px-3 py-2.5 text-white text-xs font-mono
                            focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20
                            placeholder:text-gray-600 transition-all"
                    />
                    <button
                        onClick={sendChallenge}
                        disabled={!targetId.trim() || phase !== 'idle'}
                        className="w-full py-2.5 rounded-lg text-xs font-mono font-bold
                            bg-gradient-to-r from-yellow-500 to-amber-500
                            hover:from-yellow-400 hover:to-amber-400
                            disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400
                            text-gray-900 transition-all
                            shadow-md shadow-yellow-900/30
                            active:scale-[0.98]"
                    >
                        ⚔️ Send Challenge
                    </button>

                    {/* Status message */}
                    {statusMsg && (
                        <p className={`text-[11px] text-center animate-pulse font-mono ${
                            status === 'error' ? 'text-red-400' : 'text-green-400'
                        }`}>
                            {statusMsg}
                        </p>
                    )}
                </div>

                {/* Instructions */}
                <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-800/20">
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                        <span className="text-blue-300 font-bold">How to play:</span><br />
                        1. Share your ID with a friend<br />
                        2. Paste their ID above and hit Challenge<br />
                        3. Both players must be online<br />
                        4. Battle starts when they accept!
                    </p>
                </div>
            </div>
        </div>
    )
}
