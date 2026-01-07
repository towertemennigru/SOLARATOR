/*
 * UNIFIED FARCASTER FRAME v2 + SOLANA WALLET CONNECTIVITY SOLUTION
 * ----------------------------------------------------------------
 * This component implements a dual-strategy connection mechanism:
 * 1. Farcaster Context: Detects injected providers and offers a seamless
 *    "Connect Local" experience without modal friction.
 * 2. Browser Context: Provides a full multi-wallet selection modal supporting
 *    Phantom, Solflare, Backpack, and other standard wallets.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    ConnectionProvider,
    WalletProvider,
    useConnection,
    useWallet,
} from '@solana/wallet-adapter-react';
import {
    WalletModalProvider,
    WalletMultiButton,
    WalletDisconnectButton,
} from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { 
    WalletAdapterNetwork, 
    WalletReadyState 
} from '@solana/wallet-adapter-base';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import sdk, { type FrameContext } from '@farcaster/frame-sdk';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';

// Import standard styles for the wallet adapter UI
import '@solana/wallet-adapter-react-ui/styles.css';

// Configuration Constants
const NETWORK = WalletAdapterNetwork.Devnet; // Change to Mainnet-beta for production
const RPC_ENDPOINT = clusterApiUrl(NETWORK); // Recommmended: Replace with private RPC URL

// Type Definitions
interface FrameState {
    isSDKLoaded: boolean;
    context?: FrameContext;
    isInWarpcast: boolean;
}

// --- SUB-COMPONENT: Farcaster-Specific Connect Button ---
// This component is only rendered when running inside Warpcast.
// It bypasses the modal and attempts to connect to the injected wallet directly.
const FarcasterConnectButton = () => {
    const { connect, connected, connecting, wallet, wallets, select, publicKey } = useWallet();
    const = useState<string>('Idle');
    const [error, setError] = useState<string | null>(null);

    // Effect: Auto-detect and pre-select the injected wallet
    useEffect(() => {
        if (!connected &&!connecting &&!wallet) {
            // In the Warpcast webview, the host wallet injects itself.
            // We look for any wallet that reports as 'Installed'.
            // This filters out adapters that are just 'Loadable' (like standard extensions not present).
            const injectedWallet = wallets.find(
                (w) => w.readyState === WalletReadyState.Installed
            );

            if (injectedWallet) {
                console.log("Farcaster Environment: Injected wallet detected:", injectedWallet.adapter.name);
                select(injectedWallet.adapter.name);
            }
        }
    }, [connected, connecting, wallet, wallets, select]);

    const handleConnect = useCallback(async () => {
        setError(null);
        try {
            setStatus('Connecting...');
            
            // If no wallet is selected yet, try one last detection
            if (!wallet) {
                const injected = wallets.find(w => w.readyState === WalletReadyState.Installed);
                if (injected) {
                    select(injected.adapter.name);
                    // Allow a microtask cycle for selection to propagate before connecting
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                } else {
                    throw new Error("No Solana wallet injection detected. Please check your client settings.");
                }
            }
            
            await connect();
            setStatus('Connected');
        } catch (err: any) {
            console.error("Connection failed:", err);
            setStatus('Failed');
            setError(err.message |

| "Failed to connect");
        } finally {
            if (!connected) setStatus('Idle');
        }
    }, [wallet, wallets, select, connect, connected]);

    if (connected && publicKey) {
        return (
            <div className="flex flex-col items-center gap-3 p-4 bg-green-900/20 border border-green-500/30 rounded-xl w-full">
                <div className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="font-semibold text-sm">Wallet Active</span>
                </div>
                <div className="text-xs font-mono text-green-200 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 break-all w-full text-center">
                    {publicKey.toBase58()}
                </div>
                <WalletDisconnectButton className="!bg-red-500/10!text-red-400!border!border-red-500/30!text-sm!py-2!h-auto hover:!bg-red-500/20!rounded-lg!w-full!justify-center" />
            </div>
        );
    }

    return (
        <div className="w-full">
            <button
                onClick={handleConnect}
                disabled={connecting}
                className={`
                    w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg transition-all
                    flex items-center justify-center gap-3
                    ${connecting 
                       ? 'bg-purple-700 cursor-wait opacity-80' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98]'
                    }
                `}
            >
                {connecting? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <Wallet className="w-5 h-5" />
                        Connect Local Wallet
                    </>
                )}
            </button>
            
            {error && (
                <div className="mt-3 flex items-start gap-2 text-red-400 text-xs bg-red-950/30 p-3 rounded-lg border border-red-500/20">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

// --- SUB-COMPONENT: Adaptive Wallet Controls ---
// Switches UI based on environment
const AdaptiveWalletControls = ({ isInWarpcast }: { isInWarpcast: boolean }) => {
    return (
        <div className="w-full max-w-sm mx-auto">
            {isInWarpcast? (
                <div className="space-y-4">
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-white">Farcaster Access</h3>
                        <p className="text-sm text-gray-400">Connect your Warpcast linked wallet</p>
                    </div>
                    <FarcasterConnectButton />
                </div>
            ) : (
                <div className="space-y-4 text-center">
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-semibold text-white">Web Access</h3>
                        <p className="text-sm text-gray-400">Select your preferred Solana wallet</p>
                    </div>
                    {/* The standard MultiButton handles the modal logic for us */}
                    <div className="flex justify-center">
                        <WalletMultiButton style={{ 
                            backgroundColor: '#4F46E5',
                            height: '48px',
                            borderRadius: '0.75rem',
                            fontWeight: 600
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const FarcasterSolanaFrame = () => {
    const = useState<FrameState>({
        isSDKLoaded: false,
        isInWarpcast: false,
    });

    // Initialize Farcaster SDK
    useEffect(() => {
        const initFrame = async () => {
            try {
                // Attempt to load context. 
                // This promise resolves if we are in a Frame, and rejects/hangs if not.
                // We wrap it in a timeout to fallback to browser mode quickly if checking takes too long.
                const contextPromise = sdk.context;
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout")), 1000)
                );

                const context = await Promise.race([contextPromise, timeoutPromise]) as FrameContext;
                
                if (context) {
                    // CRITICAL: Tell Warpcast the frame is ready. 
                    // Without this, the 'Connect' button might be unreachable or the frame closes.
                    sdk.actions.ready();
                    
                    setFrameState({
                        isSDKLoaded: true,
                        context: context,
                        isInWarpcast: true,
                    });
                    console.log("Frame Context Initialized:", context);
                }
            } catch (error) {
                // Fallback to browser mode
                console.log("Running in standard browser mode (No Frame Context detected)");
                setFrameState({
                    isSDKLoaded: true,
                    isInWarpcast: false,
                });
            }
        };

        initFrame();
    },);

    // Configure Wallet Adapters
    const wallets = useMemo(() => {
        // We include a diverse set of adapters.
        // In Warpcast, the 'Standard' logic within these adapters will pick up the injected provider.
        // In Browser, these will populate the modal list.
        return;
    },);

    // Render Loading State
    if (!frameState.isSDKLoaded) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <ConnectionProvider endpoint={RPC_ENDPOINT}>
            <WalletProvider wallets={wallets} autoConnect={frameState.isInWarpcast}>
                <WalletModalProvider>
                    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6">
                        {/* Frame Header */}
                        <header className="mb-8 flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl mb-4 shadow-lg shadow-purple-500/20 flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-200">
                                Solana Connect
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Universal Frame v2 Integration
                            </p>
                        </header>

                        {/* Adaptive Controls */}
                        <div className="flex-1 flex flex-col items-center justify-start w-full">
                            <div className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
                                <AdaptiveWalletControls isInWarpcast={frameState.isInWarpcast} />
                            </div>

                            {/* Context Debug Info (Helpful for Verification) */}
                            <div className="mt-8 text-xs text-gray-600 font-mono text-center space-y-1">
                                <p>Environment: {frameState.isInWarpcast? 'Warpcast In-App' : 'Standard Browser'}</p>
                                {frameState.context?.user && (
                                    <p>FID: {frameState.context.user.fid}</p>
                                )}
                            </div>
                        </div>
                    </main>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

// Export dynamically to prevent SSR hydration issues with wallet adapters
export default dynamic(() => Promise.resolve(FarcasterSolanaFrame), {
    ssr: false,
});
