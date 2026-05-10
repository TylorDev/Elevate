import { execSync } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'

const dbPath = join(process.cwd(), 'prisma', 'template.db')
const schemaSqlPath = join(process.cwd(), 'prisma', 'template-schema.sql')

if (existsSync(dbPath)) {
  rmSync(dbPath)
  console.log('Removed old template.db')
}

if (existsSync(schemaSqlPath)) {
  rmSync(schemaSqlPath)
}

console.log('Generating fresh template.db...')
try {
  execSync(
    `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output "${schemaSqlPath}"`,
    {
      stdio: 'inherit',
      env: { ...process.env }
    }
  )
  execSync(`npx prisma db execute --file "${schemaSqlPath}"`, {
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
}
