import { createHash } from "node:crypto";
import { httpError } from "../utils/http-error.js";

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const chains = Object.freeze({
  TRON: Object.freeze({ id: "TRON", family: "TRON", status: "VALIDATION_ONLY", tokenContracts: Object.freeze({ USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }) }),
  ETHEREUM: Object.freeze({ id: "ETHEREUM", family: "EVM", status: "VALIDATION_ONLY", tokenContracts: Object.freeze({ USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7", USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }) }),
  BSC: Object.freeze({ id: "BSC", family: "EVM", status: "VALIDATION_ONLY", tokenContracts: Object.freeze({}) }),
});

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

function decodeBase58(value) {
  let number = 0n;
  for (const character of value) {
    const digit = base58Alphabet.indexOf(character);
    if (digit < 0) return null;
    number = number * 58n + BigInt(digit);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = number === 0n ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return Buffer.concat([Buffer.alloc(leadingZeroes), body]);
}

function encodeBase58(value) {
  let number = BigInt(`0x${value.toString("hex")}`);
  let encoded = "";
  while (number > 0n) {
    const remainder = Number(number % 58n);
    encoded = `${base58Alphabet[remainder]}${encoded}`;
    number /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === 0) leadingZeroes += 1;
  return `${"1".repeat(leadingZeroes)}${encoded}`;
}

function tronAddressToHex(address) {
  if (/^41[a-fA-F0-9]{40}$/.test(address)) return address.toLowerCase();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return null;
  const decoded = decodeBase58(address);
  if (!decoded || decoded.length !== 25) return null;
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  if (payload[0] !== 0x41) return null;
  const expected = sha256(sha256(payload)).subarray(0, 4);
  if (!expected.equals(checksum)) return null;
  return payload.toString("hex");
}

export function tronAddressToBase58(address) {
  const normalized = typeof address === "string" ? address.trim().replace(/^0x/i, "") : "";
  if (!/^41[a-fA-F0-9]{40}$/.test(normalized)) return null;
  const payload = Buffer.from(normalized, "hex");
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return encodeBase58(Buffer.concat([payload, checksum]));
}

export function normalizeAddress(chainId, input) {
  const chain = chains[String(chainId || "").toUpperCase()];
  const address = typeof input === "string" ? input.trim() : "";
  if (!chain || !address) throw httpError(400, "INVALID_ADDRESS", "A supported chain and wallet address are required");

  if (chain.family === "TRON") {
    const normalized = tronAddressToHex(address);
    if (!normalized) throw httpError(400, "INVALID_ADDRESS", "Enter a valid TRON Base58Check or 41-prefixed hexadecimal address");
    return { chain: chain.id, address: normalized };
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw httpError(400, "INVALID_ADDRESS", `Enter a valid ${chain.id} hexadecimal address`);
  }
  return { chain: chain.id, address: address.toLowerCase() };
}

export function isValidAddress(chainId, address) {
  try {
    normalizeAddress(chainId, address);
    return true;
  } catch {
    return false;
  }
}
