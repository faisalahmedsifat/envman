import crypto from "node:crypto";

import type { DecryptedProfileData, EncryptedProfile, WrappedKey } from "../types/index.js";

const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const WRAPPED_KEY_ID = "repo-passphrase";

function pbkdf2(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      passphrase,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      "sha256",
      (error, derivedKey) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

function encryptAesGcm(key: Buffer, plaintext: Buffer): { iv: string; tag: string; data: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

function decryptAesGcm(key: Buffer, iv: string, tag: string, data: string): Buffer {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final()
  ]);
}

async function wrapDataKey(passphrase: string, dataKey: Buffer): Promise<WrappedKey> {
  const salt = crypto.randomBytes(16);
  const wrappingKey = await pbkdf2(passphrase, salt);
  const wrapped = encryptAesGcm(wrappingKey, dataKey);

  return {
    id: WRAPPED_KEY_ID,
    kdf: "pbkdf2",
    salt: salt.toString("base64"),
    iv: wrapped.iv,
    tag: wrapped.tag,
    wrappedKey: wrapped.data
  };
}

async function unwrapDataKey(passphrase: string, wrappedKey: WrappedKey): Promise<Buffer> {
  const wrappingKey = await pbkdf2(passphrase, Buffer.from(wrappedKey.salt, "base64"));
  return decryptAesGcm(wrappingKey, wrappedKey.iv, wrappedKey.tag, wrappedKey.wrappedKey);
}

export async function encryptProfile(
  profile: DecryptedProfileData,
  passphrase: string
): Promise<EncryptedProfile> {
  const dataKey = crypto.randomBytes(KEY_LENGTH);
  const payload = Buffer.from(JSON.stringify(profile), "utf8");
  const encryptedPayload = encryptAesGcm(dataKey, payload);
  const wrappedKey = await wrapDataKey(passphrase, dataKey);

  return {
    v: 1,
    wrappedKeys: [wrappedKey],
    dataIv: encryptedPayload.iv,
    dataTag: encryptedPayload.tag,
    data: encryptedPayload.data
  };
}

export async function decryptProfile(
  encryptedProfile: EncryptedProfile,
  passphrase: string
): Promise<DecryptedProfileData> {
  const wrappedKey = encryptedProfile.wrappedKeys.find((entry) => entry.id === WRAPPED_KEY_ID);
  if (wrappedKey === undefined) {
    throw new Error("No repo-passphrase wrapped key found in profile");
  }

  const dataKey = await unwrapDataKey(passphrase, wrappedKey);
  const plaintext = decryptAesGcm(
    dataKey,
    encryptedProfile.dataIv,
    encryptedProfile.dataTag,
    encryptedProfile.data
  );

  return JSON.parse(plaintext.toString("utf8")) as DecryptedProfileData;
}

export async function rewrapEncryptedProfile(
  encryptedProfile: EncryptedProfile,
  currentPassphrase: string,
  nextPassphrase: string
): Promise<EncryptedProfile> {
  const wrappedKey = encryptedProfile.wrappedKeys.find((entry) => entry.id === WRAPPED_KEY_ID);
  if (wrappedKey === undefined) {
    throw new Error("No repo-passphrase wrapped key found in profile");
  }

  const dataKey = await unwrapDataKey(currentPassphrase, wrappedKey);
  const nextWrappedKey = await wrapDataKey(nextPassphrase, dataKey);

  return {
    ...encryptedProfile,
    wrappedKeys: [nextWrappedKey]
  };
}
