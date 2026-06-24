import { execSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const dbPath = join(process.cwd(), 'prisma', 'template.db')
const schemaSqlPath = join(process.cwd(), 'prisma', 'template-schema.sql')
const schemaRoot = mkdtempSync(join(tmpdir(), 'elevate-template-schema-'))
const schemaPath = join(schemaRoot, 'schema.prisma')

if (existsSync(dbPath)) {
  rmSync(dbPath)
  console.log('Removed old template.db')
}

if (existsSync(schemaSqlPath)) {
  rmSync(schemaSqlPath)
}

console.log('Generating fresh template.db...')
try {
  const projectSchema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
  const schemaWithUrl = projectSchema.replace(
    /datasource db\s*\{\s*provider\s*=\s*"sqlite"\s*\}/,
    'datasource db {\n  provider = "sqlite"\n  url      = "file:./template-placeholder.db"\n}'
  )
  writeFileSync(schemaPath, schemaWithUrl, 'utf8')

  execSync(
    `npx prisma migrate diff --from-empty --to-schema-datamodel "${schemaPath}" --script --output "${schemaSqlPath}"`,
    {
      stdio: 'inherit',
      env: { ...process.env }
    }
  )
  execSync(`npx prisma db execute --url "file:./prisma/template.db" --file "${schemaSqlPath}"`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./prisma/template.db' }
  })
  console.log('Successfully generated template.db')
} catch (error) {
  console.error('Failed to generate template.db:', error)
  process.exit(1)
} finally {
  if (existsSync(schemaSqlPath)) {
    rmSync(schemaSqlPath)
  }
  rmSync(schemaRoot, { recursive: true, force: true })
}
