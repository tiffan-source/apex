export abstract class IdGenerator {
  abstract generateId(): string;
}

export class SimpleIdGenerator extends IdGenerator {
  generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
