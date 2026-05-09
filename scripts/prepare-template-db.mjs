import { execSync } from 'child_process'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'

const dbPath = join(process.cwd(), 'prisma', 'template.db')

if (existsSync(dbPath)) {
  rmSync(dbPath)
  console.log('Removed old template.db')
}

console.log('Generating fresh template.db...')
try {
  execSync('npx prisma db push --schema=prisma/schema.prisma', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:./prisma/template.db` }
  })
  console.log('Successfully generated template.db')
} catch (error) {
  console.error('Failed to generate template.db:', error)
  process.exit(1)
}
