import * as SQLite from "expo-sqlite";
import { Buffer } from "buffer";
import { PasswordProps } from "../utils/types/passwordType";
import { UpdateMasterKey } from "../utils/types/PasswordUpdate";

async function initializeDatabase() {
  const db = SQLite.openDatabaseAsync("keybunker.db");
  return db;
}

// DROP TABLE IF EXISTS passwords;
// DROP TABLE IF EXISTS passwordmaster;

export async function initializeTables() {
  const db = await initializeDatabase();
  await db.execAsync(`

    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS passwords (
      id INTEGER PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      passkey TEXT NOT NULL,
      login TEXT
    );
    CREATE TABLE IF NOT EXISTS passwordmaster (
      id INTEGER PRIMARY KEY NOT NULL,
      passkey TEXT NOT NULL
    );
  `);
}

export async function insertPasswords(data: PasswordProps) {
  const db = await initializeDatabase();
  if (data.login) {
    isSQLinjection(data.login);
  }
  isSQLinjection(data.label);
  isSQLinjection(data.passkey);

  const passkeycripto = encryptPassword(data.passkey);
  await db.execAsync(`
    INSERT INTO passwords (label, passkey, login) VALUES
     ('${data.label}', '${passkeycripto}', '${data.login}');
  `);
}

export async function deletePassword(id: number) {
  const db = await initializeDatabase();
  await db.execAsync(`
    DELETE FROM passwords WHERE id = ${id};
  `);
}

export async function updatePassword(data: PasswordProps) {
  const db = await initializeDatabase();
  const updates = [];
  const passkeycripto = encryptPassword(data.passkey);

  if (data.login) {
    isSQLinjection(data.login);
  }
  isSQLinjection(data.label);
  isSQLinjection(data.passkey);

  updates.push(`label = '${data.label}'`);
  updates.push(`passkey = '${passkeycripto}'`);
  if (data.login) updates.push(`login = '${data.login}'`);

  await db.execAsync(`
     UPDATE passwords SET ${updates.join(", ")} WHERE id = ${data.id};
  `);
}

export async function fetchAllPasswords(): Promise<PasswordProps[]> {
  const db = await initializeDatabase();
  const allRows = await db.getAllAsync("SELECT * FROM passwords");

  const passwords: PasswordProps[] = allRows.map((row: any) => ({
    id: row.id,
    label: row.label,
    passkey: decryptPassword(row.passkey),
    login: row.login,
  }));

  return passwords;
}

function isSQLinjection(input: string): boolean {
  const sqlInjectionRegex =
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|--|OR| AND)\b|'")/i;
  function testSqlInjection(input: string): boolean {
    return sqlInjectionRegex.test(input);
  }
  if (testSqlInjection(input)) {
    throw new Error('Entrada possivelmente contém comando malicioso');
  }
  return true;
}

function encryptPassword(password: string) {
  const buffer = Buffer.from(password, "utf-8");
  return buffer.toString("base64");
}

function decryptPassword(passkeycripto: string) {
  const buffer = Buffer.from(passkeycripto, "base64");
  return buffer.toString("utf-8");
}

export async function updatePasswordMaster(data: UpdateMasterKey) {
  isSQLinjection(data.passkey);
  const db = await initializeDatabase();
  const result = await db.getAllAsync(
    `SELECT * FROM passwordmaster WHERE id = 1;`
  );

  const passkeyhash = encryptPassword(data.passkey);

  if (result.length > 0) {
    await db.execAsync(`
      UPDATE passwordmaster SET passkey = '${passkeyhash}' WHERE id = 1;
    `);
  } else {
    await db.execAsync(`
      INSERT INTO passwordmaster (id, passkey) VALUES (1, '${passkeyhash}');
    `);
  }
}
export async function searchPasswordMaster(): Promise<boolean> {
  const db = await initializeDatabase();
  const result = await db.getAllAsync(
    `SELECT * FROM passwordmaster WHERE id = 1;`
  );
  if (result.length > 0) {
    return true;
  } else {
    return false;
  }
}

export async function comparePasswordMaster(
  password: string
): Promise<boolean> {
  const db = await initializeDatabase();
  isSQLinjection(password);

  const result = (await db.getAllAsync(
    "SELECT passkey FROM passwordmaster WHERE id = 1"
  )) as { passkey: string }[];

  if (result.length > 0 && result[0].passkey) {
    const storedHash = decryptPassword(result[0].passkey);

    if (storedHash === password) {
      return true;
    } else {
      return false;
    }
  } else {
    throw new Error("Não encontrado.");
  }
}
