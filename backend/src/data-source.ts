import { DataSource } from 'typeorm'

console.log('Initializing data source...')

// todo: course opt-in, nickname

export const db = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'greSQLdb',
  database: 'canvas_sync',
  synchronize: true,
  logging: false,
  entities: [],
  subscribers: [],
  migrations: [],
})

export default db
