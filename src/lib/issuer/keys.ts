import { promises as fs } from "node:fs";
import path from "node:path";
import {
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
} from "jose";

type KeyLike = CryptoKey;

const KEY_DIR = path.join(process.cwd(), "keys");
const PRIVATE_KEY_PATH = path.join(KEY_DIR, "issuer-ec-private.pem");
const PUBLIC_KEY_PATH = path.join(KEY_DIR, "issuer-ec-public.pem");

export const ISSUER_NAME = "agent-passport-authority";
export const ISSUER_ALG = "ES256";

interface KeyBundle {
  privateKey: KeyLike;
  publicKey: KeyLike;
}

let cached: KeyBundle | null = null;

async function loadFromDisk(): Promise<KeyBundle | null> {
  try {
    const [privPem, pubPem] = await Promise.all([
      fs.readFile(PRIVATE_KEY_PATH, "utf8"),
      fs.readFile(PUBLIC_KEY_PATH, "utf8"),
    ]);
    const privateKey = await importPKCS8(privPem, ISSUER_ALG);
    const publicKey = await importSPKI(pubPem, ISSUER_ALG);
    return { privateKey, publicKey };
  } catch {
    return null;
  }
}

async function persist(bundle: KeyBundle) {
  await fs.mkdir(KEY_DIR, { recursive: true });
  const [priv, pub] = await Promise.all([
    exportPKCS8(bundle.privateKey),
    exportSPKI(bundle.publicKey),
  ]);
  await Promise.all([
    fs.writeFile(PRIVATE_KEY_PATH, priv, { mode: 0o600 }),
    fs.writeFile(PUBLIC_KEY_PATH, pub),
  ]);
}

export async function getIssuerKeys(): Promise<KeyBundle> {
  if (cached) return cached;

  const onDisk = await loadFromDisk();
  if (onDisk) {
    cached = onDisk;
    return cached;
  }

  const generated = await generateKeyPair(ISSUER_ALG, { extractable: true });
  cached = generated;
  await persist(generated);
  return cached;
}

export async function regenerateKeys(): Promise<KeyBundle> {
  const generated = await generateKeyPair(ISSUER_ALG, { extractable: true });
  cached = generated;
  await persist(generated);
  return cached;
}
