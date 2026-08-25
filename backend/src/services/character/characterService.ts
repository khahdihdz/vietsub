import { Character } from '../../types/subtitle.js';

export class CharacterService {
  private characters = new Map<string, Character>();

  upsert(character: Character): void {
    this.characters.set(character.id, character);
  }

  remove(id: string): void {
    this.characters.delete(id);
    // Dọn các tham chiếu xưng hô trỏ tới nhân vật vừa xóa
    for (const c of this.characters.values()) {
      if (c.addressing && id in c.addressing) {
        delete c.addressing[id];
      }
    }
  }

  /** Thiết lập cách nhân vật `fromId` xưng hô với nhân vật `toId`. */
  setAddressing(fromId: string, toId: string, term: string): void {
    const character = this.characters.get(fromId);
    if (!character) throw new Error(`Không tìm thấy nhân vật id="${fromId}".`);
    character.addressing = { ...(character.addressing ?? {}), [toId]: term };
  }

  list(): Character[] {
    return Array.from(this.characters.values());
  }

  get(id: string): Character | undefined {
    return this.characters.get(id);
  }
}
