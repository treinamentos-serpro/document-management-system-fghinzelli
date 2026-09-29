const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

function readPositiveInteger(name, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0 || parsedValue > maximum) {
    throw new Error(`${name} deve ser um número inteiro positivo válido.`);
  }

  return parsedValue;
}

const storageDirValue = process.env.STORAGE_DIR === undefined
  ? 'storage'
  : process.env.STORAGE_DIR.trim();

if (!storageDirValue) {
  throw new Error('STORAGE_DIR não pode ser vazio.');
}

const defaultOwner = process.env.DMS_DEFAULT_OWNER === undefined
  ? 'local-user'
  : process.env.DMS_DEFAULT_OWNER.trim();

if (!defaultOwner) {
  throw new Error('DMS_DEFAULT_OWNER não pode ser vazio.');
}

module.exports = {
  port: readPositiveInteger('PORT', 3000, 65535),
  storageDir: path.isAbsolute(storageDirValue)
    ? path.resolve(storageDirValue)
    : path.resolve(backendRoot, storageDirValue),
  maxFileSizeBytes: readPositiveInteger('MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024),
  defaultOwner,
};