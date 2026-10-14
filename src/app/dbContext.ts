import { createContext, useContext } from 'react';
import type { ZiniarzDb } from '../storage/db';

/** The open IndexedDB database; tests provide their own. */
export const DbContext = createContext<ZiniarzDb | null>(null);

export function useDb(): ZiniarzDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('DbContext is missing');
  return db;
}
