export interface EnvmanConfig {
  version: number;
  defaultProfile: string;
  include: string[];
  exclude: string[];
}

export interface ManifestProfile {
  name: string;
  updatedAt: string;
  file: string;
}

export interface Manifest {
  version: number;
  defaultProfile: string;
  profiles: ManifestProfile[];
}

export interface WrappedKey {
  id: string;
  kdf: "pbkdf2";
  salt: string;
  iv: string;
  tag: string;
  wrappedKey: string;
}

export interface TrackedEnvFile {
  path: string;
  content: string;
  hash: string;
  lastModified: string;
}

export interface DecryptedProfileData {
  profile: string;
  updatedAt: string;
  savedBy: string;
  files: TrackedEnvFile[];
}

export interface EncryptedProfile {
  v: number;
  wrappedKeys: WrappedKey[];
  dataIv: string;
  dataTag: string;
  data: string;
}
