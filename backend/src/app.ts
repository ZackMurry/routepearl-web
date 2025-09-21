import express from 'express'
import cors from 'cors'
import 'reflect-metadata'
import 'dotenv/config'
import db from './data-source.js'
import session from 'express-session'
import './types/types.js'

await db
  .initialize()
  .then(() => console.log('Data source initialized!'))
  .catch(err => {
    console.error('Error during Data Source initialization:', err)
  })

const app = express()
const port = process.env.PORT ?? 8080
app.use(
  cors({
    origin: ['http://localhost'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Location'],
    credentials: true,
  }),
)

app.use(express.json())

app.set('trust proxy', 1) // trust first proxy
app.use(
  session({
    name: 'notionSession',
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // This will only work if you have https enabled!
      maxAge: 6000000, // 100 min
    },
  }),
)

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', reason => {
  console.error('Unhandled Rejection:', reason)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
