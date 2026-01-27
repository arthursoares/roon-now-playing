import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || '.';
const NAMES_FILE = path.join(DATA_DIR, 'client-names.json');

export class ClientNameStore {
  private names: Map<string, string> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(NAMES_FILE)) {
        const data = fs.readFileSync(NAMES_FILE, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, string>;
        this.names = new Map(Object.entries(parsed));
        logger.info(`Loaded ${this.names.size} client names from ${NAMES_FILE}`);
      }
    } catch (error) {
      logger.error(`Failed to load client names: ${error}`);
    }
  }

  private save(): void {
    try {
      const data = Object.fromEntries(this.names);
      fs.writeFileSync(NAMES_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save client names: ${error}`);
    }
  }

  get(clientId: string): string | null {
    return this.names.get(clientId) || null;
  }

  set(clientId: string, name: string | null): void {
    if (name) {
      this.names.set(clientId, name);
    } else {
      this.names.delete(clientId);
    }
    this.save();
  }

  getAll(): Map<string, string> {
    return new Map(this.names);
  }
}
