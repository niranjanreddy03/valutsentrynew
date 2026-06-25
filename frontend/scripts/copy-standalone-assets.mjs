import { cp, mkdir, stat } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const standaloneDir = path.join(root, ".next", "standalone")

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function copyIfPresent(source, destination) {
  if (!(await exists(source))) {
    return
  }

  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
}

await copyIfPresent(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"))
await copyIfPresent(path.join(root, "public"), path.join(standaloneDir, "public"))

