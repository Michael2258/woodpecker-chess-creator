import { db } from './storage/db'
import { createRepository } from './storage/repository'

/** The app-wide repository backed by the browser database. */
export const repo = createRepository(db)
