import * as bitcoin from 'bitcoinjs-lib';

export const validateP2WPKH = (address: string, network: bitcoin.Network = bitcoin.networks.bitcoin) => {
    try {
        const decoded = bitcoin.address.fromBech32(address);
        // For regtest, the address length is typically 44 characters (bcrt1q...)
        // For mainnet, it's 42 characters (bc1q...)
        const expectedLength = network === bitcoin.networks.regtest ? 44 : 42;
        return decoded.version === 0 && address.length === expectedLength;
    } catch (error) {
        return false;
    }
};

export const validateP2SH = (address: string, network: bitcoin.Network = bitcoin.networks.bitcoin) => {
    try {
        const decoded = bitcoin.address.fromBase58Check(address);
        return decoded.version === network.scriptHash && address.length === 34;
    } catch (error) {
        return false;
    }
};

export const validateP2PKH = (address: string, network: bitcoin.Network = bitcoin.networks.bitcoin) => {
    try {
        const decoded = bitcoin.address.fromBase58Check(address);
        return decoded.version === network.pubKeyHash && address.length === 34;
    } catch (error) {
        return false;
    }
};

/* 
Test cases:
1Q6hWEbKDqg2rTQeNYGJBQJkMTyYHSWsVi => pass
3ABE84ndJVq8DPikrHRaqn4GRgm65NRJEn => pass
bc1q30vayz8nnq9rzq2km3ag0zplatts6vhq4m6gqc => pass
bc1qzvgz7jp6aylxyy4q39gw3q0ydyd44xhyk35djf7xlkur37hzv73syy45f9 => fail
bc1pqurpm7u6tu69e2859nhhv4r473uqp4zgn90d9d2p7kf4tkjsj39qstkfyd => fail
*/

// the circuits accept P2WPKH, P2PKH, P2SH
export const validateBitcoinPayoutAddress = (address: string, network?: bitcoin.Network): boolean => {
    try {
        // Auto-detect network if not provided
        let detectedNetwork = network;
        if (!detectedNetwork) {
            if (address.startsWith('bcrt1')) {
                detectedNetwork = bitcoin.networks.regtest;
            } else if (address.startsWith('tb1') || address.startsWith('m') || address.startsWith('n') || address.startsWith('2')) {
                detectedNetwork = bitcoin.networks.testnet;
            } else {
                detectedNetwork = bitcoin.networks.bitcoin;
            }
        }

        // address type => prefix
        // p2wpkh => bc1 (mainnet), bcrt1 (regtest), tb1 (testnet)
        // p2pkh => 1 (mainnet), m/n (testnet), similar for regtest
        // p2sh => 3 (mainnet), 2 (testnet), similar for regtest

        if (address.startsWith('bc1') || address.startsWith('bcrt1') || address.startsWith('tb1')) {
            return validateP2WPKH(address, detectedNetwork);
        } else if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) {
            return validateP2PKH(address, detectedNetwork);
        } else if (address.startsWith('3') || address.startsWith('2')) {
            return validateP2SH(address, detectedNetwork);
        }

        return false; // address doesn't match any known prefix
    } catch (error) {
        // decoding failed, address is invalid
        return false;
    }
};

export const validateBitcoinPayoutAddressWithNetwork = (
    address: string, 
    expectedNetworkType: "mainnet" | "regtest"
): { isValid: boolean; networkMismatch?: boolean; detectedNetwork?: string } => {
    try {
        // First, check if the address has a valid prefix
        const hasValidPrefix = address.startsWith('bc1') || address.startsWith('bcrt1') || 
                              address.startsWith('tb1') || address.startsWith('1') || 
                              address.startsWith('m') || address.startsWith('n') || 
                              address.startsWith('3') || address.startsWith('2');
        
        if (!hasValidPrefix) {
            // Invalid prefix means completely invalid address
            return {
                isValid: false,
                networkMismatch: false
            };
        }

        // Auto-detect network from address prefix
        let detectedNetwork: bitcoin.Network;
        let detectedNetworkName: string;
        
        if (address.startsWith('bcrt1')) {
            detectedNetwork = bitcoin.networks.regtest;
            detectedNetworkName = "regtest";
        } else if (address.startsWith('tb1') || address.startsWith('m') || address.startsWith('n') || address.startsWith('2')) {
            detectedNetwork = bitcoin.networks.testnet;
            detectedNetworkName = "testnet";
        } else {
            detectedNetwork = bitcoin.networks.bitcoin;
            detectedNetworkName = "mainnet";
        }

        // Validate the address format
        let isValidFormat = false;
        if (address.startsWith('bc1') || address.startsWith('bcrt1') || address.startsWith('tb1')) {
            isValidFormat = validateP2WPKH(address, detectedNetwork);
        } else if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) {
            isValidFormat = validateP2PKH(address, detectedNetwork);
        } else if (address.startsWith('3') || address.startsWith('2')) {
            isValidFormat = validateP2SH(address, detectedNetwork);
        }

        // If the format is invalid, don't show network mismatch
        if (!isValidFormat) {
            return {
                isValid: false,
                networkMismatch: false
            };
        }

        // Check if the detected network matches expected network
        const networkMismatch = detectedNetworkName !== expectedNetworkType;
        
        return {
            isValid: isValidFormat && !networkMismatch,
            networkMismatch,
            detectedNetwork: detectedNetworkName
        };
    } catch (error) {
        return {
            isValid: false,
            networkMismatch: false
        };
    }
};

export function convertLockingScriptToBitcoinAddress(lockingScript: string): string {
    // Remove '0x' prefix if present
    const script = lockingScript.startsWith('0x') ? lockingScript.slice(2) : lockingScript;
    const scriptBuffer = Buffer.from(script, 'hex');

    try {
        // P2PKH
        if (
            scriptBuffer.length === 25 &&
            scriptBuffer[0] === bitcoin.opcodes.OP_DUP &&
            scriptBuffer[1] === bitcoin.opcodes.OP_HASH160 &&
            scriptBuffer[2] === 0x14 &&
            scriptBuffer[23] === bitcoin.opcodes.OP_EQUALVERIFY &&
            scriptBuffer[24] === bitcoin.opcodes.OP_CHECKSIG
        ) {
            const pubKeyHash = scriptBuffer.slice(3, 23);
            return bitcoin.address.toBase58Check(pubKeyHash, bitcoin.networks.bitcoin.pubKeyHash);
        }

        // P2SH
        if (
            scriptBuffer.length === 23 &&
            scriptBuffer[0] === bitcoin.opcodes.OP_HASH160 &&
            scriptBuffer[1] === 0x14 &&
            scriptBuffer[22] === bitcoin.opcodes.OP_EQUAL
        ) {
            const scriptHash = scriptBuffer.slice(2, 22);
            return bitcoin.address.toBase58Check(scriptHash, bitcoin.networks.bitcoin.scriptHash);
        }

        // P2WPKH
        if (scriptBuffer.length === 22 && scriptBuffer[0] === bitcoin.opcodes.OP_0 && scriptBuffer[1] === 0x14) {
            const witnessProgram = scriptBuffer.slice(2);
            return bitcoin.address.toBech32(witnessProgram, 0, bitcoin.networks.bitcoin.bech32);
        }

        // P2WSH
        if (scriptBuffer.length === 34 && scriptBuffer[0] === bitcoin.opcodes.OP_0 && scriptBuffer[1] === 0x20) {
            const witnessProgram = scriptBuffer.slice(2);
            return bitcoin.address.toBech32(witnessProgram, 0, bitcoin.networks.bitcoin.bech32);
        }

        // P2TR (Taproot)
        if (scriptBuffer.length === 34 && scriptBuffer[0] === bitcoin.opcodes.OP_1 && scriptBuffer[1] === 0x20) {
            const witnessProgram = scriptBuffer.slice(2);
            return bitcoin.address.toBech32(witnessProgram, 1, bitcoin.networks.bitcoin.bech32);
        }

        throw new Error('Unsupported locking script type');
    } catch (error) {
        console.error('Error converting locking script to address:', error);
        throw error;
    }
}

export function convertToBitcoinLockingScript(address: string): string {
    // TODO - validate and test all address types with alpine
    try {
        let script: Buffer;

        // Handle Bech32 addresses (including P2WPKH, P2WSH, and P2TR)
        if (address.toLowerCase().startsWith('bc1')) {
            const { data, version } = bitcoin.address.fromBech32(address);
            if (version === 0) {
                if (data.length === 20) {
                    // P2WPKH
                    script = bitcoin.script.compile([bitcoin.opcodes.OP_0, data]);
                } else if (data.length === 32) {
                    // P2WSH
                    script = bitcoin.script.compile([bitcoin.opcodes.OP_0, data]);
                }
            } else if (version === 1 && data.length === 32) {
                // P2TR (Taproot)
                script = bitcoin.script.compile([bitcoin.opcodes.OP_1, data]);
            }
        } else {
            // Handle legacy addresses (P2PKH and P2SH)
            const { version, hash } = bitcoin.address.fromBase58Check(address);

            // P2PKH
            if (version === bitcoin.networks.bitcoin.pubKeyHash) {
                script = bitcoin.script.compile([
                    bitcoin.opcodes.OP_DUP,
                    bitcoin.opcodes.OP_HASH160,
                    hash,
                    bitcoin.opcodes.OP_EQUALVERIFY,
                    bitcoin.opcodes.OP_CHECKSIG,
                ]);
            }

            // P2SH
            else if (version === bitcoin.networks.bitcoin.scriptHash) {
                script = bitcoin.script.compile([bitcoin.opcodes.OP_HASH160, hash, bitcoin.opcodes.OP_EQUAL]);
            }
        }

        if (!script) {
            throw new Error('Unsupported address type');
        }

        const padded = Buffer.alloc(25);
        // Copy script into padded. If script is shorter than 25 bytes, the rest remains zero.
        // If script is longer than 25 bytes, only the first 25 bytes are copied.
        // @ts-ignore
        script.copy(padded, 0, 0, Math.min(script.length, 25));
        return '0x' + padded.toString('hex');
    } catch (error) {
        console.error('Error converting address to locking script:', error);
        throw error;
    }
}