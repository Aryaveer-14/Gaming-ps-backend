import { useEffect, useRef } from 'react'
import { useBattleStore, CreatureInfo, MoveInfo } from '../store/battleStore'
import { getBattleSocket } from '../lib/battleSocket'
import { useAuthStore } from '../store/authStore'

// ─── Helper Components ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
    Fire: 'bg-orange-500',
    Water: 'bg-blue-500',
    Grass: 'bg-green-500',
    Electric: 'bg-yellow-400 text-black',
    Normal: 'bg-gray-500',
    Ground: 'bg-amber-700',
}

function TypeBadge({ type }: { type: string }) {
    return (
        <span className={`type-badge text-white ${TYPE_COLORS[type] ?? 'bg-gray-600'}`}>
            {type}
        </span>
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'none') return null
    return (
        <span className={`type-badge ${status === 'burn' ? 'bg-orange-600' : 'bg-yellow-500 text-black'}`}>
            {status === 'burn' ? '🔥 BRN' : '⚡ PAR'}
        </span>
    )
}

function HpBar({ current, max }: { current: number; max: number }) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100))
    const color =
        pct > 50 ? 'bg-pokemon-hp-high' : pct > 20 ? 'bg-pokemon-hp-mid' : 'bg-pokemon-hp-low'
    return (
        <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden">
            <div
                className={`hp-bar ${color}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

function CreatureCard({
    creature,
    isMine,
}: {
    creature: CreatureInfo
    isMine: boolean
}) {
    return (
        <div className={`pokemon-panel p-4 space-y-2 flex-1 ${isMine ? 'border-blue-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between">
                <div>
                    <span className="font-pixel text-xs text-pokemon-yellow">
                        {isMine ? '▶ YOU' : '◀ OPPONENT'}
                    </span>
                    <h3 className="font-pixel text-sm text-white mt-0.5">{creature.creatureName}</h3>
                    <span className="text-xs text-gray-400">Lv.{creature.level}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={creature.status} />
                    <span className="text-xs text-gray-300 font-mono">
                        {creature.currentHp}/{creature.maxHp} HP
                    </span>
                </div>
            </div>
            <HpBar current={creature.currentHp} max={creature.maxHp} />
            {/* Sprite placeholder / letter avatar */}
            <div className="flex justify-center py-2">
                <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-2xl ${isMine
                        ? 'bg-gradient-to-br from-blue-500 to-blue-800'
                        : 'bg-gradient-to-br from-red-500 to-red-800'
                        }`}
                >
                    {creature.creatureName[0]}
                </div>
            </div>
        </div>
    )
}

function MoveButton({
    move,
    ppLeft,
    disabled,
    onSelect,
}: {
    move: MoveInfo
    ppLeft: number
    disabled: boolean
    onSelect: (moveId: string) => void
}) {
    const noPP = ppLeft <= 0
    return (
        <button
            id={`move-btn-${move.id}`}
            onClick={() => onSelect(move.id)}
            disabled={disabled || noPP}
            className={`flex flex-col gap-1 p-3 rounded-xl border transition-all duration-150 text-left
        ${noPP
                    ? 'border-gray-700 bg-gray-900/60 opacity-40 cursor-not-allowed'
                    : disabled
                        ? 'border-gray-700 bg-gray-900/60 opacity-60 cursor-not-allowed'
                        : 'border-pokemon-border bg-pokemon-panel hover:bg-blue-900/30 hover:border-blue-400 active:scale-95 cursor-pointer'
                }`}
        >
            <div className="flex items-center justify-between w-full">
                <span className="font-pixel text-xs text-white truncate">{move.name}</span>
                <TypeBadge type={move.type} />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
                {move.power ? <span>PWR {move.power}</span> : <span>STATUS</span>}
                <span>•</span>
                <span>ACC {move.accuracy}</span>
                <span className="ml-auto font-mono text-pokemon-yellow">PP {ppLeft}/{move.pp}</span>
            </div>
        </button>
    )
}

// ─── Main BattleUI ────────────────────────────────────────────────────────────

export default function BattleUI() {
    const {
        phase,
        myCreature,
        opponentCreature,
        battleLog,
        turnNumber,
        pendingMoveId,
        incomingChallenge,
        winnerUserId,
        xpAwarded,
        endReason,
        setPendingMove,
        setIncomingChallenge,
        reset,
        addLog,
    } = useBattleStore()

    const { token, userId } = useAuthStore()
    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight
        }
    }, [battleLog])

    const socket = token ? getBattleSocket(token) : null

    function handleMoveSelect(moveId: string) {
        if (!socket || phase !== 'selecting') return
        setPendingMove(moveId)
        socket.emit('battle-action', { moveId })
    }

    function handleForfeit() {
        if (!socket) return
        if (confirm('Are you sure you want to forfeit?')) {
            socket.emit('forfeit')
        }
    }

    function handleAcceptChallenge() {
        if (!socket || !incomingChallenge) return
        socket.emit('battle-accept', { fromUserId: incomingChallenge.fromUserId })
        setIncomingChallenge(null)
    }

    function handleDeclineChallenge() {
        if (!socket || !incomingChallenge) return
        socket.emit('battle-decline', { fromUserId: incomingChallenge.fromUserId })
        setIncomingChallenge(null)
    }

    // ── Incoming challenge overlay ─────────────────────────────────────────────
    if (phase === 'incoming' && incomingChallenge) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fadeIn">
                <div className="pokemon-panel p-8 max-w-sm w-full mx-4 text-center space-y-4">
                    <div className="text-4xl">⚔️</div>
                    <h2 className="font-pixel text-pokemon-yellow text-sm">Battle Challenge!</h2>
                    <p className="text-gray-300">
                        <strong className="text-white">{incomingChallenge.fromUsername}</strong> wants to battle!
                    </p>
                    <div className="flex gap-3 mt-4">
                        <button id="btn-accept-challenge" onClick={handleAcceptChallenge} className="pokemon-btn flex-1">
                            Accept
                        </button>
                        <button id="btn-decline-challenge" onClick={handleDeclineChallenge} className="pokemon-btn-red flex-1">
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Waiting for accept ─────────────────────────────────────────────────────
    if (phase === 'waiting-accept') {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="pokemon-panel p-8 max-w-sm w-full mx-4 text-center space-y-4">
                    <div className="text-4xl animate-pulse">⏳</div>
                    <h2 className="font-pixel text-pokemon-yellow text-sm">Waiting...</h2>
                    <p className="text-gray-400 text-sm">Waiting for opponent to accept the challenge</p>
                    <button
                        id="btn-cancel-challenge"
                        onClick={() => { useBattleStore.getState().reset() }}
                        className="pokemon-btn-red text-xs"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    // ── Battle ended ───────────────────────────────────────────────────────────
    if (phase === 'ended') {
        const isWinner = winnerUserId === userId
        return (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fadeIn">
                <div className="pokemon-panel p-8 max-w-md w-full mx-4 text-center space-y-6">
                    <div className="text-5xl">{isWinner ? '🏆' : winnerUserId ? '💀' : '🤝'}</div>
                    <h2 className={`font-pixel text-lg ${isWinner ? 'text-pokemon-yellow' : 'text-red-400'}`}>
                        {isWinner ? 'Victory!' : winnerUserId ? 'Defeated!' : 'Draw!'}
                    </h2>
                    {endReason === 'disconnect' && (
                        <p className="text-gray-400 text-sm">Opponent disconnected</p>
                    )}
                    {endReason === 'forfeit' && (
                        <p className="text-gray-400 text-sm">Opponent forfeited</p>
                    )}
                    {endReason === 'timeout' && (
                        <p className="text-gray-400 text-sm">Timed out due to inactivity</p>
                    )}
                    {isWinner && xpAwarded > 0 && (
                        <div className="pokemon-panel bg-pokemon-yellow/10 border-pokemon-yellow p-4 rounded-xl">
                            <p className="font-pixel text-pokemon-yellow text-sm">+{xpAwarded} XP earned!</p>
                        </div>
                    )}
                    <button id="btn-return-lobby" onClick={reset} className="pokemon-btn w-full mt-2">
                        Return to Lobby
                    </button>
                </div>
            </div>
        )
    }

    // ── Active battle ─────────────────────────────────────────────────────────
    if ((phase === 'selecting' || phase === 'resolving') && myCreature && opponentCreature) {
        const isSelecting = phase === 'selecting'
        const myPpLeft = myCreature.ppLeft ?? {}

        return (
            <div className="h-screen w-screen bg-pokemon-darker flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-pokemon-dark border-b border-pokemon-border">
                    <span className="font-pixel text-xs text-gray-400">Turn {turnNumber + 1}</span>
                    <span className="font-pixel text-xs text-pokemon-yellow">⚔️ BATTLE</span>
                    <button id="btn-forfeit" onClick={handleForfeit} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Forfeit
                    </button>
                </div>

                {/* Arena */}
                <div className="flex gap-3 p-3 flex-shrink-0">
                    <CreatureCard creature={myCreature} isMine={true} />
                    <div className="flex items-center text-2xl font-pixel text-gray-500 self-center">VS</div>
                    <CreatureCard creature={opponentCreature} isMine={false} />
                </div>

                {/* Battle Log */}
                <div
                    ref={logRef}
                    className="flex-1 overflow-y-auto px-4 py-2 space-y-1 font-mono text-sm min-h-0"
                >
                    {battleLog.map((entry, i) => (
                        <p key={i} className="battle-log-entry text-gray-300">
                            {entry}
                        </p>
                    ))}
                    {phase === 'resolving' && (
                        <p className="text-pokemon-yellow animate-pulse text-xs font-pixel mt-1">
                            ⚔️ Waiting for opponent...
                        </p>
                    )}
                </div>

                {/* Move Grid */}
                <div className="p-3 border-t border-pokemon-border flex-shrink-0">
                    {isSelecting ? (
                        <>
                            <p className="font-pixel text-xs text-gray-400 mb-2">Choose your move:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {myCreature.moves.map((move) => (
                                    <MoveButton
                                        key={move.id}
                                        move={move}
                                        ppLeft={myPpLeft[move.id] ?? move.pp}
                                        disabled={!isSelecting}
                                        onSelect={handleMoveSelect}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-3">
                            <p className="font-pixel text-xs text-pokemon-yellow animate-pulse">
                                ⏳ Waiting for opponent to choose...
                            </p>
                            {pendingMoveId && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Your move: <strong>{myCreature.moves.find(m => m.id === pendingMoveId)?.name}</strong>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return null
}
