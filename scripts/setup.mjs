import { copyFile, access } from "node:fs/promises";
for (const path of [".env", "backend/.env"]) {
  try {
    await access(path);
    console.log(`${path} ya existe; conservado.`);
  } catch {
    await copyFile(path + ".example", path);
    console.log(`${path} creado. Configura sus credenciales.`);
  }
}
